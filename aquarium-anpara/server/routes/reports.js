const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/dashboard', auth, adminOnly, async (req, res) => {
  try {
    const totalProducts = await prisma.products.count({ where: { is_active: 1 } });
    const totalCategories = await prisma.categories.count({ where: { is_active: 1 } });
    const totalOrders = await prisma.orders.count();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayOrders = await prisma.orders.count({ where: { created_at: { gte: todayStart } } });
    const totalCustomers = await prisma.customers.count();

    const totalRevenueAgg = await prisma.orders.aggregate({
      _sum: { total: true },
      where: { order_status: { not: 'cancelled' } }
    });
    const totalRevenue = totalRevenueAgg._sum.total || 0;

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthlyRevenueAgg = await prisma.orders.aggregate({
      _sum: { total: true },
      where: { order_status: { not: 'cancelled' }, created_at: { gte: monthStart } }
    });
    const monthlyRevenue = monthlyRevenueAgg._sum.total || 0;

    const allActive = await prisma.products.findMany({ where: { is_active: 1 }, select: { stock_quantity: true, low_stock_threshold: true } });
    const lowStockProducts = allActive.filter(p => p.stock_quantity <= p.low_stock_threshold).length;
    const outOfStockProducts = allActive.filter(p => p.stock_quantity === 0).length;

    const recentOrders = await prisma.orders.findMany({ orderBy: { created_at: 'desc' }, take: 5 });

    const topProducts = await prisma.products.findMany({
      where: { is_active: 1 },
      orderBy: { sold_count: 'desc' },
      take: 5,
      select: {
        name: true, sold_count: true, price: true, rating: true,
        product_images: { where: { is_primary: 1 }, take: 1, select: { image_url: true } }
      }
    });
    const topProductsMapped = topProducts.map(p => ({
      name: p.name, sold_count: p.sold_count, price: p.price, rating: p.rating,
      image: p.product_images[0]?.image_url || null
    }));

    const dailySales = await prisma.$queryRaw`
      SELECT DATE(created_at) as date, COUNT(*) as orders, SUM(total) as revenue
      FROM orders WHERE order_status != 'cancelled' AND created_at >= datetime('now', '-30 days')
      GROUP BY DATE(created_at) ORDER BY date
    `;

    res.json({ totalProducts, totalCategories, totalOrders, todayOrders, totalCustomers,
      totalRevenue, monthlyRevenue, lowStockProducts, outOfStockProducts,
      recentOrders, topProducts: topProductsMapped, dailySales });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/sales', auth, adminOnly, async (req, res) => {
  try {
    const { period = 'daily', start_date, end_date } = req.query;
    let groupBy, dateFormat;
    switch (period) {
      case 'weekly': groupBy = "strftime('%Y-W%W', created_at)"; dateFormat = 'weekly'; break;
      case 'monthly': groupBy = "strftime('%Y-%m', created_at)"; dateFormat = 'monthly'; break;
      case 'yearly': groupBy = "strftime('%Y', created_at)"; dateFormat = 'yearly'; break;
      default: groupBy = "DATE(created_at)"; dateFormat = 'daily';
    }
    let whereClause = "order_status != 'cancelled'";
    let params = [];
    if (start_date) { whereClause += " AND created_at >= ?"; params.push(start_date); }
    if (end_date) { whereClause += " AND created_at <= ?"; params.push(end_date); }

    const sales = await prisma.$queryRawUnsafe(
      `SELECT ${groupBy} as period, COUNT(*) as orders, SUM(subtotal) as subtotal,
       SUM(discount) as discount, SUM(shipping_charge) as shipping, SUM(total) as revenue
       FROM orders WHERE ${whereClause} GROUP BY ${groupBy} ORDER BY period DESC`,
      ...params
    );
    res.json({ sales, period: dateFormat });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/products', auth, adminOnly, async (req, res) => {
  try {
    const products = await prisma.products.findMany({
      where: { is_active: 1 },
      include: { categories: { select: { name: true } }, brands: { select: { name: true } } },
      orderBy: { sold_count: 'desc' }
    });
    const mapped = products.map(p => ({
      ...p,
      category_name: p.categories?.name || null,
      brand_name: p.brands?.name || null,
      profit_per_unit: (p.price || 0) - (p.cost_price || 0),
      total_profit: (p.sold_count || 0) * ((p.price || 0) - (p.cost_price || 0)),
      categories: undefined, brands: undefined
    }));
    res.json({ products: mapped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/customers', auth, adminOnly, async (req, res) => {
  try {
    const customers = await prisma.customers.findMany({ orderBy: { total_spent: 'desc' } });
    res.json({ customers });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/orders', auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { order_status: status } : {};
    const orders = await prisma.orders.findMany({ where, orderBy: { created_at: 'desc' } });
    res.json({ orders });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stock', auth, adminOnly, async (req, res) => {
  try {
    const products = await prisma.products.findMany({
      where: { is_active: 1 },
      include: { categories: { select: { name: true } } },
      orderBy: { stock_quantity: 'asc' }
    });
    const mapped = products.map(p => ({
      id: p.id, name: p.name, sku: p.sku, stock_quantity: p.stock_quantity,
      cost_price: p.cost_price, price: p.price,
      category_name: p.categories?.name || null,
      stock_value: (p.stock_quantity || 0) * (p.cost_price || 0)
    }));
    const totalValue = mapped.reduce((sum, p) => sum + p.stock_value, 0);
    res.json({ products: mapped, totalValue });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
