const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', auth, adminOnly, (req, res) => {
  try {
    const { search, low_stock } = req.query;
    let where = ['p.is_active = 1'];
    let params = [];
    if (search) { where.push("(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (low_stock === '1') { where.push("p.stock_quantity <= p.low_stock_threshold"); }
    
    const products = db.prepare(`SELECT p.id, p.name, p.sku, p.barcode, p.stock_quantity, p.low_stock_threshold, p.cost_price, p.price,
      c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${where.join(' AND ')} ORDER BY p.stock_quantity ASC`).all(...params);
    res.json({ products });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/adjust', auth, adminOnly, (req, res) => {
  try {
    const { product_id, type, quantity, reference, notes } = req.body;
    if (!product_id || !type || quantity === undefined) return res.status(400).json({ error: 'Product, type and quantity required' });
    
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    let newStock = product.stock_quantity;
    switch (type) {
      case 'purchase': case 'return': newStock += Math.abs(quantity); break;
      case 'sale': case 'damage': newStock -= Math.abs(quantity); break;
      case 'adjustment': newStock = Math.abs(quantity); break;
      case 'transfer': newStock -= Math.abs(quantity); break;
    }
    if (newStock < 0) return res.status(400).json({ error: 'Stock cannot be negative' });

    db.prepare('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, product_id);
    db.prepare('INSERT INTO inventory_logs (product_id, type, quantity, reference, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .run(product_id, type, quantity, reference || null, notes || null, req.user.id);
    
    res.json({ message: 'Stock adjusted', new_stock: newStock });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/logs', auth, adminOnly, (req, res) => {
  try {
    const { product_id, type, page = 1, limit = 50 } = req.query;
    let where = ['1=1'];
    let params = [];
    if (product_id) { where.push("il.product_id = ?"); params.push(product_id); }
    if (type) { where.push("il.type = ?"); params.push(type); }
    
    const offset = (Number(page) - 1) * Number(limit);
    const total = db.prepare(`SELECT COUNT(*) as total FROM inventory_logs il WHERE ${where.join(' AND ')}`).get(...params).total;
    const logs = db.prepare(`SELECT il.*, p.name as product_name, u.name as created_by_name
      FROM inventory_logs il LEFT JOIN products p ON il.product_id = p.id LEFT JOIN users u ON il.created_by = u.id
      WHERE ${where.join(' AND ')} ORDER BY il.created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/alerts', auth, adminOnly, (req, res) => {
  try {
    const lowStock = db.prepare(`SELECT p.id, p.name, p.sku, p.stock_quantity, p.low_stock_threshold, c.name as category_name
      FROM products p LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1 AND p.stock_quantity <= p.low_stock_threshold ORDER BY p.stock_quantity ASC`).all();
    const outOfStock = db.prepare(`SELECT p.id, p.name, p.sku, p.stock_quantity, c.name as category_name
      FROM products p LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1 AND p.stock_quantity = 0`).all();
    res.json({ lowStock, outOfStock });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
