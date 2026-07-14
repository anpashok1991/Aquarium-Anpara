const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly, staffOrAdmin, requireWritePermission } = require('../middleware/auth');

router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const { search, is_active, page = 1, limit = 20 } = req.query;
    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } }
      ];
    }
    if (is_active !== undefined && is_active !== '') {
      where.is_active = Number(is_active);
    }
    const offset = (Number(page) - 1) * Number(limit);
    const total = await prisma.customers.count({ where });
    const customers = await prisma.customers.findMany({ where, orderBy: { created_at: 'desc' }, skip: offset, take: Number(limit) });
    res.json({ customers, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, adminOnly, async (req, res) => {
  try {
    const customer = await prisma.customers.findUnique({ where: { id: Number(req.params.id) } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    customer.orders = await prisma.orders.findMany({ where: { customer_phone: customer.phone }, orderBy: { created_at: 'desc' }, take: 10 });
    res.json({ customer });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/status', auth, staffOrAdmin, requireWritePermission('customers'), async (req, res) => {
  try {
    const { is_active } = req.body;
    const customer = await prisma.customers.findUnique({ where: { id: Number(req.params.id) } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    await prisma.customers.update({ where: { id: Number(req.params.id) }, data: { is_active: is_active ? 1 : 0 } });
    res.json({ success: true, message: is_active ? 'Customer activated' : 'Customer deactivated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, staffOrAdmin, requireWritePermission('customers'), async (req, res) => {
  try {
    const customer = await prisma.customers.findUnique({ where: { id: Number(req.params.id) } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    await prisma.customers.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true, message: 'Customer deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
