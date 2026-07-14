const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly, staffOrAdmin, requireWritePermission } = require('../middleware/auth');

router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const coupons = await prisma.coupons.findMany({ orderBy: { created_at: 'desc' } });
    res.json({ coupons });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/validate', async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    const coupon = await prisma.coupons.findFirst({ where: { code, is_active: 1 } });
    if (!coupon) return res.status(404).json({ error: 'Invalid coupon code' });
    if (coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit) return res.status(400).json({ error: 'Coupon usage limit reached' });
    if (coupon.start_date && new Date(coupon.start_date) > new Date()) return res.status(400).json({ error: 'Coupon not yet valid' });
    if (coupon.end_date && new Date(coupon.end_date) < new Date()) return res.status(400).json({ error: 'Coupon expired' });
    if (subtotal < coupon.min_order) return res.status(400).json({ error: `Minimum order \u20B9${coupon.min_order} required` });

    let discount = coupon.discount_type === 'percentage' ? (subtotal * coupon.discount_value / 100) : coupon.discount_value;
    if (coupon.max_discount > 0) discount = Math.min(discount, coupon.max_discount);
    res.json({ code: coupon.code, discount_type: coupon.discount_type, discount_value: coupon.discount_value, discount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, staffOrAdmin, requireWritePermission('coupons'), async (req, res) => {
  try {
    const { code, description, discount_type, discount_value, min_order, max_discount, usage_limit, start_date, end_date } = req.body;
    const coupon = await prisma.coupons.create({
      data: { code: code.toUpperCase(), description, discount_type: discount_type || 'percentage', discount_value, min_order: min_order || 0, max_discount: max_discount || 0, usage_limit: usage_limit || 0, start_date, end_date }
    });
    res.status(201).json({ coupon });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, staffOrAdmin, requireWritePermission('coupons'), async (req, res) => {
  try {
    const { code, description, discount_type, discount_value, min_order, max_discount, usage_limit, start_date, end_date, is_active } = req.body;
    const data = {};
    if (code !== undefined) data.code = code.toUpperCase();
    if (description !== undefined) data.description = description;
    if (discount_type !== undefined) data.discount_type = discount_type;
    if (discount_value !== undefined) data.discount_value = discount_value;
    if (min_order !== undefined) data.min_order = min_order;
    if (max_discount !== undefined) data.max_discount = max_discount;
    if (usage_limit !== undefined) data.usage_limit = usage_limit;
    if (start_date !== undefined) data.start_date = start_date;
    if (end_date !== undefined) data.end_date = end_date;
    if (is_active !== undefined) data.is_active = is_active ? 1 : 0;
    const coupon = await prisma.coupons.update({ where: { id: Number(req.params.id) }, data });
    res.json({ coupon });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, staffOrAdmin, requireWritePermission('coupons'), async (req, res) => {
  try {
    await prisma.coupons.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Coupon deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
