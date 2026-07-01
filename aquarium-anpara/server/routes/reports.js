const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/dashboard', auth, adminOnly, (req, res) => {
  try {
    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get().count;
    const totalCategories = db.prepare('SELECT COUNT(*) as count FROM categories WHERE is_active = 1').get().count;
    const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
    const todayOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = DATE('now')").get().count;
    const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
    
    const totalRevenue = db.prepare('SELECT COALESCE(SUM(total), 0) as sum FROM orders WHERE order_status != "cancelled"').get().sum;
    const monthlyRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as sum FROM orders WHERE order_status != 'cancelled' AND created_at >= date('now', 'start of month')").get().sum;
    
    const lowStockProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND stock_quantity <= low_stock_threshold').get().count;
    const outOfStockProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND stock_quantity = 0').get().count;
    
    const recentOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5').all();
    const topProducts = db.prepare(`SELECT p.name, p.sold_count, p.price, p.rating,
      (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
      FROM products p WHERE p.is_active = 1 ORDER BY p.sold_count DESC LIMIT 5`).all();

    const dailySales = db.prepare(`SELECT DATE(created_at) as date, COUNT(*) as orders, SUM(total) as revenue
      FROM orders WHERE order_status != 'cancelled' AND created_at >= date('now', '-30 days')
      GROUP BY DATE(created_at) ORDER BY date`).all();

    res.json({ totalProducts, totalCategories, totalOrders, todayOrders, totalCustomers,
      totalRevenue, monthlyRevenue, lowStockProducts, outOfStockProducts,
      recentOrders, topProducts, dailySales });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/sales', auth, adminOnly, (req, res) => {
  try {
    const { period = 'daily', start_date, end_date } = req.query;
    let groupBy, dateFormat;
    switch (period) {
      case 'weekly': groupBy = "strftime('%Y-W%W', created_at)"; dateFormat = 'weekly'; break;
      case 'monthly': groupBy = "strftime('%Y-%m', created_at)"; dateFormat = 'monthly'; break;
      case 'yearly': groupBy = "strftime('%Y', created_at)"; dateFormat = 'yearly'; break;
      default: groupBy = "DATE(created_at)"; dateFormat = 'daily';
    }
    let where = ["order_status != 'cancelled'"];
    let params = [];
    if (start_date) { where.push("created_at >= ?"); params.push(start_date); }
    if (end_date) { where.push("created_at <= ?"); params.push(end_date); }
    
    const sales = db.prepare(`SELECT ${groupBy} as period, COUNT(*) as orders, SUM(subtotal) as subtotal,
      SUM(discount) as discount, SUM(shipping_charge) as shipping, SUM(total) as revenue
      FROM orders WHERE ${where.join(' AND ')} GROUP BY ${groupBy} ORDER BY period DESC`).all(...params);
    res.json({ sales, period: dateFormat });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/products', auth, adminOnly, (req, res) => {
  try {
    const products = db.prepare(`SELECT p.*, c.name as category_name, b.name as brand_name,
      (p.price - p.cost_price) as profit_per_unit, (p.sold_count * (p.price - p.cost_price)) as total_profit
      FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.is_active = 1 ORDER BY p.sold_count DESC`).all();
    res.json({ products });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/customers', auth, adminOnly, (req, res) => {
  try {
    const customers = db.prepare('SELECT * FROM customers ORDER BY total_spent DESC').all();
    res.json({ customers });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/orders', auth, adminOnly, (req, res) => {
  try {
    const { status } = req.query;
    let where = status ? ['order_status = ?'] : [];
    let params = status ? [status] : [];
    const orders = db.prepare(`SELECT * FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`).all(...params);
    res.json({ orders });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stock', auth, adminOnly, (req, res) => {
  try {
    const products = db.prepare(`SELECT p.id, p.name, p.sku, p.stock_quantity, p.cost_price, p.price, c.name as category_name,
      (p.stock_quantity * p.cost_price) as stock_value
      FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_active = 1 ORDER BY p.stock_quantity`).all();
    const totalValue = products.reduce((sum, p) => sum + p.stock_value, 0);
    res.json({ products, totalValue });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
