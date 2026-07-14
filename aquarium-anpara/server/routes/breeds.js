const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly, staffOrAdmin, requireWritePermission } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { category_id } = req.query;
    const where = { is_active: 1 };
    if (category_id) where.category_id = Number(category_id);
    const breeds = await prisma.breeds.findMany({
      where,
      include: { categories: { select: { name: true, is_live: true } } },
      orderBy: { name: 'asc' }
    });
    res.json({
      breeds: breeds.map(b => ({
        ...b,
        category_name: b.categories?.name,
        categories: undefined
      }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/all', auth, adminOnly, async (req, res) => {
  try {
    const breeds = await prisma.breeds.findMany({
      include: {
        categories: { select: { name: true } },
        _count: { select: { products: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json({
      breeds: breeds.map(b => ({
        ...b,
        category_name: b.categories?.name,
        product_count: b._count.products,
        categories: undefined,
        _count: undefined
      }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, staffOrAdmin, requireWritePermission('categories'), async (req, res) => {
  try {
    const { name, category_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let finalSlug = slug, counter = 1;
    while (await prisma.breeds.findUnique({ where: { slug: finalSlug }, select: { id: true } })) finalSlug = `${slug}-${counter++}`;
    const result = await prisma.breeds.create({
      data: { name, slug: finalSlug, category_id: category_id ? Number(category_id) : null }
    });
    res.status(201).json({ breed: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, staffOrAdmin, requireWritePermission('categories'), async (req, res) => {
  try {
    const paramId = Number(req.params.id);
    const { name, category_id, is_active } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (category_id !== undefined) data.category_id = category_id ? Number(category_id) : null;
    if (is_active !== undefined) data.is_active = is_active ? 1 : 0;
    await prisma.breeds.update({ where: { id: paramId }, data });
    res.json({ breed: await prisma.breeds.findUnique({ where: { id: paramId } }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, staffOrAdmin, requireWritePermission('categories'), async (req, res) => {
  try {
    const paramId = Number(req.params.id);
    await prisma.products.updateMany({ where: { breed_id: paramId }, data: { breed_id: null } });
    await prisma.breeds.delete({ where: { id: paramId } });
    res.json({ message: 'Breed deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
