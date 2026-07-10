const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../database');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      select: { id: true, name: true, email: true, phone: true, role: true, is_active: true, created_at: true },
      orderBy: { created_at: 'desc' }
    });
    res.json({ users });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/users', auth, adminOnly, async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    if (!['admin', 'staff', 'customer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const existing = await prisma.users.findUnique({ where: { email }, select: { id: true } });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const hash = bcrypt.hashSync(password, 10);
    const user = await prisma.users.create({
      data: { name, email, phone: phone || null, password: hash, role },
      select: { id: true, name: true, email: true, phone: true, role: true, is_active: true, created_at: true }
    });
    res.json({ user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/users/:id/role', auth, adminOnly, async (req, res) => {
  try {
    await prisma.users.update({ where: { id: Number(req.params.id) }, data: { role: req.body.role } });
    res.json({ message: 'Role updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/users/:id/status', auth, adminOnly, async (req, res) => {
  try {
    await prisma.users.update({ where: { id: Number(req.params.id) }, data: { is_active: req.body.is_active ? 1 : 0 } });
    res.json({ message: 'Status updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/audit-logs', auth, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = Number(page), limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;
    const total = await prisma.audit_logs.count();
    const logs = await prisma.audit_logs.findMany({
      skip: offset, take: limitNum,
      include: { users: { select: { name: true } } },
      orderBy: { created_at: 'desc' }
    });
    const mapped = logs.map(l => ({ ...l, user_name: l.users?.name || null, users: undefined }));
    res.json({ logs: mapped, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/backup', auth, adminOnly, (req, res) => {
  try {
    res.json({ message: 'Backup feature - use database file directly for SQLite backup' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
