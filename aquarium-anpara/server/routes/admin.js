const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/users', auth, adminOnly, (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, email, phone, role, is_active, created_at FROM users ORDER BY created_at DESC').all();
    res.json({ users });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/users/:id/role', auth, adminOnly, (req, res) => {
  try {
    db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.body.role, req.params.id);
    res.json({ message: 'Role updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/users/:id/status', auth, adminOnly, (req, res) => {
  try {
    db.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.body.is_active ? 1 : 0, req.params.id);
    res.json({ message: 'Status updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/audit-logs', auth, adminOnly, (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const total = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get().count;
    const logs = db.prepare(`SELECT al.*, u.name as user_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC LIMIT ? OFFSET ?`).all(Number(limit), offset);
    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/backup', auth, adminOnly, (req, res) => {
  try {
    res.json({ message: 'Backup feature - use database file directly for SQLite backup' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
