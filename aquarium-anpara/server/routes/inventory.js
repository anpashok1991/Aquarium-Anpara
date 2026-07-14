const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly, staffOrAdmin, requireWritePermission } = require('../middleware/auth');

router.get('/', auth, staffOrAdmin, async (req, res) => {
  try {
    const { search, low_stock } = req.query;
    let where = { is_active: 1 };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } }
      ];
    }

    let products = await prisma.products.findMany({
      where,
      include: { categories: { select: { name: true } } },
      orderBy: { stock_quantity: 'asc' }
    });

    if (low_stock === '1') {
      products = products.filter(p => p.stock_quantity <= p.low_stock_threshold);
    }

    const mapped = products.map(p => ({
      id: p.id, name: p.name, sku: p.sku, barcode: p.barcode,
      stock_quantity: p.stock_quantity, low_stock_threshold: p.low_stock_threshold,
      cost_price: p.cost_price, price: p.price,
      category_name: p.categories?.name || null
    }));

    res.json({ products: mapped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/adjust', auth, staffOrAdmin, requireWritePermission('inventory'), async (req, res) => {
  try {
    const { product_id, type, quantity, reference, notes } = req.body;
    if (!product_id || !type || quantity === undefined) return res.status(400).json({ error: 'Product, type and quantity required' });

    const product = await prisma.products.findFirst({ where: { id: product_id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    let newStock = product.stock_quantity;
    switch (type) {
      case 'purchase': case 'return': newStock += Math.abs(quantity); break;
      case 'sale': case 'damage': newStock -= Math.abs(quantity); break;
      case 'adjustment': newStock = Math.abs(quantity); break;
      case 'transfer': newStock -= Math.abs(quantity); break;
    }
    if (newStock < 0) return res.status(400).json({ error: 'Stock cannot be negative' });

    await prisma.products.update({
      where: { id: product_id },
      data: { stock_quantity: newStock, updated_at: new Date() }
    });
    await prisma.inventory_logs.create({
      data: {
        product_id,
        type,
        quantity,
        reference: reference || null,
        notes: notes || null,
        created_by: req.user.id
      }
    });

    res.json({ message: 'Stock adjusted', new_stock: newStock });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/logs', auth, staffOrAdmin, async (req, res) => {
  try {
    const { product_id, type, page = 1, limit = 50 } = req.query;
    let where = {};
    if (product_id) where.product_id = Number(product_id);
    if (type) where.type = type;

    const offset = (Number(page) - 1) * Number(limit);
    const total = await prisma.inventory_logs.count({ where });
    const logs = await prisma.inventory_logs.findMany({
      where,
      include: {
        products: { select: { name: true } },
        users: { select: { name: true } }
      },
      orderBy: { created_at: 'desc' },
      take: Number(limit),
      skip: offset
    });

    const mapped = logs.map(l => ({
      ...l,
      product_name: l.products?.name || null,
      created_by_name: l.users?.name || null,
      products: undefined,
      users: undefined
    }));

    res.json({ logs: mapped, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/alerts', auth, staffOrAdmin, async (req, res) => {
  try {
    const allProducts = await prisma.products.findMany({
      where: { is_active: 1 },
      include: { categories: { select: { name: true } } }
    });

    const lowStock = allProducts
      .filter(p => p.stock_quantity <= p.low_stock_threshold)
      .map(p => ({
        id: p.id, name: p.name, sku: p.sku,
        stock_quantity: p.stock_quantity, low_stock_threshold: p.low_stock_threshold,
        category_name: p.categories?.name || null
      }));

    const outOfStock = allProducts
      .filter(p => p.stock_quantity === 0)
      .map(p => ({
        id: p.id, name: p.name, sku: p.sku, stock_quantity: p.stock_quantity,
        category_name: p.categories?.name || null
      }));

    res.json({ lowStock, outOfStock });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
