const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly, staffOrAdmin, requireWritePermission } = require('../middleware/auth');

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !message) return res.status(400).json({ error: 'Name and message required' });
    await prisma.contact_messages.create({ data: { name, email, phone, subject, message } });
    res.status(201).json({ message: 'Message sent successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const messages = await prisma.contact_messages.findMany({ orderBy: { created_at: 'desc' } });
    res.json({ messages });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/read', auth, staffOrAdmin, requireWritePermission('messages'), async (req, res) => {
  try {
    await prisma.contact_messages.update({ where: { id: Number(req.params.id) }, data: { is_read: 1 } });
    res.json({ message: 'Marked as read' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, staffOrAdmin, requireWritePermission('messages'), async (req, res) => {
  try {
    await prisma.contact_messages.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
