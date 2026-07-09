const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', auth, adminOnly, (req, res) => {
  try {
    const coupons = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all();
    res.json({ coupons });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/validate', (req, res) => {
  try {
    const { code, subtotal } = req.body;
    const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').get(code);
    if (!coupon) return res.status(404).json({ error: 'Invalid coupon code' });
    if (coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit) return res.status(400).json({ error: 'Coupon usage limit reached' });
    if (coupon.start_date && new Date(coupon.start_date) > new Date()) return res.status(400).json({ error: 'Coupon not yet valid' });
    if (coupon.end_date && new Date(coupon.end_date) < new Date()) return res.status(400).json({ error: 'Coupon expired' });
    if (subtotal < coupon.min_order) return res.status(400).json({ error: `Minimum order ₹${coupon.min_order} required` });
    
    let discount = coupon.discount_type === 'percentage' ? (subtotal * coupon.discount_value / 100) : coupon.discount_value;
    if (coupon.max_discount > 0) discount = Math.min(discount, coupon.max_discount);
    res.json({ code: coupon.code, discount_type: coupon.discount_type, discount_value: coupon.discount_value, discount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, (req, res) => {
  try {
    const { code, description, discount_type, discount_value, min_order, max_discount, usage_limit, start_date, end_date } = req.body;
    const result = db.prepare('INSERT INTO coupons (code, description, discount_type, discount_value, min_order, max_discount, usage_limit, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(code.toUpperCase(), description, discount_type || 'percentage', discount_value, min_order || 0, max_discount || 0, usage_limit || 0, start_date, end_date);
    res.status(201).json({ coupon: db.prepare('SELECT * FROM coupons WHERE id = ?').get(result.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, adminOnly, (req, res) => {
  try {
    const { code, description, discount_type, discount_value, min_order, max_discount, usage_limit, start_date, end_date, is_active } = req.body;
    db.prepare('UPDATE coupons SET code=COALESCE(?,code), description=COALESCE(?,description), discount_type=COALESCE(?,discount_type), discount_value=COALESCE(?,discount_value), min_order=COALESCE(?,min_order), max_discount=COALESCE(?,max_discount), usage_limit=COALESCE(?,usage_limit), start_date=COALESCE(?,start_date), end_date=COALESCE(?,end_date), is_active=COALESCE(?,is_active) WHERE id=?')
      .run(code?.toUpperCase(), description, discount_type, discount_value, min_order, max_discount, usage_limit, start_date, end_date, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);
    res.json({ coupon: db.prepare('SELECT * FROM coupons WHERE id = ?').get(req.params.id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, (req, res) => {
  try {
    db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
    res.json({ message: 'Coupon deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
