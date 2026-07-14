const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly, staffOrAdmin, requireWritePermission } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const brands = await prisma.brands.findMany({
      where: { is_active: 1 },
      include: {
        _count: {
          select: {
            products: { where: { is_active: 1 } }
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json({
      brands: brands.map(b => ({
        ...b,
        product_count: b._count.products,
        _count: undefined
      }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, staffOrAdmin, requireWritePermission('brands'), async (req, res) => {
  try {
    const { name, logo, description } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let finalSlug = slug, counter = 1;
    while (await prisma.brands.findUnique({ where: { slug: finalSlug }, select: { id: true } })) finalSlug = `${slug}-${counter++}`;
    const result = await prisma.brands.create({
      data: { name, slug: finalSlug, logo, description }
    });
    res.status(201).json({ brand: await prisma.brands.findUnique({ where: { id: result.id } }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, staffOrAdmin, requireWritePermission('brands'), async (req, res) => {
  try {
    const paramId = Number(req.params.id);
    const { name, logo, description, is_active } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (logo !== undefined) data.logo = logo;
    if (description !== undefined) data.description = description;
    if (is_active !== undefined) data.is_active = is_active ? 1 : 0;
    await prisma.brands.update({ where: { id: paramId }, data });
    res.json({ brand: await prisma.brands.findUnique({ where: { id: paramId } }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, staffOrAdmin, requireWritePermission('brands'), async (req, res) => {
  try {
    const paramId = Number(req.params.id);
    await prisma.products.updateMany({ where: { brand_id: paramId }, data: { brand_id: null } });
    await prisma.brands.delete({ where: { id: paramId } });
    res.json({ message: 'Brand deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
