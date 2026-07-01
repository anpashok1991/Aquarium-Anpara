const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', auth, adminOnly, (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    let where = ['1=1'];
    let params = [];
    if (search) { where.push("(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    const whereClause = 'WHERE ' + where.join(' AND ');
    const offset = (Number(page) - 1) * Number(limit);
    const total = db.prepare(`SELECT COUNT(*) as total FROM customers c ${whereClause}`).get(...params).total;
    const customers = db.prepare(`SELECT c.* FROM customers c ${whereClause} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
    res.json({ customers, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, adminOnly, (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    customer.orders = db.prepare('SELECT * FROM orders WHERE customer_phone = ? ORDER BY created_at DESC LIMIT 10').all(customer.phone);
    res.json({ customer });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
