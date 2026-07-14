const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly, staffOrAdmin, requireWritePermission } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const banners = await prisma.banners.findMany({
      where: { is_active: 1 },
      orderBy: { sort_order: 'asc' }
    });
    res.json({ banners });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/all', auth, adminOnly, async (req, res) => {
  try {
    const banners = await prisma.banners.findMany({ orderBy: { sort_order: 'asc' } });
    res.json({ banners });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, staffOrAdmin, requireWritePermission('banners'), async (req, res) => {
  try {
    const { title, subtitle, image, link, sort_order } = req.body;
    const result = await prisma.banners.create({
      data: { title, subtitle, image, link, sort_order: sort_order || 0 }
    });
    res.status(201).json({ banner: await prisma.banners.findUnique({ where: { id: result.id } }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, staffOrAdmin, requireWritePermission('banners'), async (req, res) => {
  try {
    const paramId = Number(req.params.id);
    const { title, subtitle, image, link, sort_order, is_active } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (subtitle !== undefined) data.subtitle = subtitle;
    if (image !== undefined) data.image = image;
    if (link !== undefined) data.link = link;
    if (sort_order !== undefined) data.sort_order = sort_order;
    if (is_active !== undefined) data.is_active = is_active ? 1 : 0;
    await prisma.banners.update({ where: { id: paramId }, data });
    res.json({ banner: await prisma.banners.findUnique({ where: { id: paramId } }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, staffOrAdmin, requireWritePermission('banners'), async (req, res) => {
  try {
    await prisma.banners.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Banner deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
