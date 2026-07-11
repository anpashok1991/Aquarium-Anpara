const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const staff = await prisma.users.findMany({
      where: { role: 'staff' },
      select: { id: true, name: true, email: true, is_active: true, permissions: true }
    });
    res.json({ staff });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/permissions', auth, adminOnly, async (req, res) => {
  try {
    const { permissions } = req.body;
    const permStr = permissions ? JSON.stringify(permissions) : null;
    await prisma.users.update({
      where: { id: Number(req.params.id) },
      data: { permissions: permStr }
    });
    res.json({ message: 'Permissions updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
