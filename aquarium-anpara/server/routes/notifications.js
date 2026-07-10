const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const notifications = await prisma.notifications.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
      take: 50
    });
    const unread = await prisma.notifications.count({
      where: { user_id: req.user.id, is_read: 0 }
    });
    res.json({ notifications, unread });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/read', auth, async (req, res) => {
  try {
    await prisma.notifications.updateMany({
      where: { id: Number(req.params.id), user_id: req.user.id },
      data: { is_read: 1 }
    });
    res.json({ message: 'Marked as read' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/read-all', auth, async (req, res) => {
  try {
    await prisma.notifications.updateMany({
      where: { user_id: req.user.id },
      data: { is_read: 1 }
    });
    res.json({ message: 'All marked as read' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { user_id, title, message, type } = req.body;
    const notification = await prisma.notifications.create({
      data: {
        user_id,
        title,
        message,
        type: type || 'info'
      }
    });
    res.status(201).json({ notification });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
