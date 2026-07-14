const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly, staffOrAdmin, requireWritePermission } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const where = {};
    if (category) where.category = category;
    const images = await prisma.gallery.findMany({ where, orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }] });
    res.json({ images });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, staffOrAdmin, requireWritePermission('gallery'), async (req, res) => {
  try {
    const { title, image, category, sort_order } = req.body;
    const result = await prisma.gallery.create({ data: { title, image, category, sort_order: sort_order || 0 } });
    res.status(201).json({ image: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, staffOrAdmin, requireWritePermission('gallery'), async (req, res) => {
  try {
    await prisma.gallery.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Image deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
