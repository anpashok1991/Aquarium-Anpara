const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly, staffOrAdmin, requireWritePermission } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const categories = await prisma.categories.findMany({
      where: { is_active: 1 },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }]
    });
    const categoriesWithCount = await Promise.all(categories.map(async (c) => {
      const product_count = await prisma.products.count({
        where: { category_id: c.id, is_active: 1 }
      });
      return { ...c, product_count };
    }));
    const tree = categoriesWithCount.filter(c => !c.parent_id).map(c => ({
      ...c,
      subcategories: categoriesWithCount.filter(sc => sc.parent_id === c.id)
    }));
    res.json({ categories: tree, flat: categoriesWithCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:slug', async (req, res) => {
  try {
    const category = await prisma.categories.findFirst({ where: { slug: req.params.slug } });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    category.subcategories = await prisma.categories.findMany({ where: { parent_id: category.id, is_active: 1 } });
    res.json({ category });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, staffOrAdmin, requireWritePermission('categories'), async (req, res) => {
  try {
    const { name, description, image, icon, parent_id, sort_order, is_live } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let finalSlug = slug;
    let counter = 1;
    while (await prisma.categories.findFirst({ where: { slug: finalSlug }, select: { id: true } })) {
      finalSlug = `${slug}-${counter++}`;
    }
    const category = await prisma.categories.create({
      data: { name, slug: finalSlug, description, image, icon: icon || null, parent_id: parent_id || null, sort_order: sort_order || 0, is_live: is_live !== undefined ? (is_live ? 1 : 0) : 0 }
    });
    res.status(201).json({ category });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, staffOrAdmin, requireWritePermission('categories'), async (req, res) => {
  try {
    const { name, description, image, icon, parent_id, sort_order, is_active, is_live } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (image !== undefined) data.image = image;
    if (icon !== undefined) data.icon = icon;
    if (parent_id !== undefined) data.parent_id = parent_id;
    if (sort_order !== undefined) data.sort_order = sort_order;
    if (is_active !== undefined) data.is_active = is_active ? 1 : 0;
    if (is_live !== undefined) data.is_live = is_live ? 1 : 0;
    const category = await prisma.categories.update({ where: { id: Number(req.params.id) }, data });
    res.json({ category });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, staffOrAdmin, requireWritePermission('categories'), async (req, res) => {
  try {
    await prisma.categories.updateMany({ where: { parent_id: Number(req.params.id) }, data: { parent_id: null } });
    await prisma.products.updateMany({ where: { category_id: Number(req.params.id) }, data: { category_id: null } });
    await prisma.categories.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Category deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
