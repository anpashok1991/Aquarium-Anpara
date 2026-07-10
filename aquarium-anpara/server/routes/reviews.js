const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly, optionalAuth } = require('../middleware/auth');

router.get('/product/:productId', async (req, res) => {
  try {
    const reviews = await prisma.reviews.findMany({
      where: { product_id: Number(req.params.productId), is_approved: 1 },
      include: { users: { select: { name: true } } },
      orderBy: { created_at: 'desc' }
    });
    const mapped = reviews.map(r => ({ ...r, user_name: r.users?.name || null, users: undefined }));
    res.json({ reviews: mapped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { product_id, rating, title, comment, customer_name } = req.body;
    if (!product_id || !rating) return res.status(400).json({ error: 'Product and rating required' });
    const review = await prisma.reviews.create({
      data: {
        product_id: Number(product_id), rating: Number(rating),
        user_id: req.user?.id || null,
        customer_name: customer_name || req.user?.name || 'Anonymous',
        title, comment
      }
    });

    const agg = await prisma.reviews.aggregate({
      _avg: { rating: true },
      _count: { id: true },
      where: { product_id: Number(product_id), is_approved: 1 }
    });
    await prisma.products.update({
      where: { id: Number(product_id) },
      data: { rating: agg._avg.rating || 0, review_count: agg._count.id }
    });

    res.status(201).json({ review });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/pending', auth, adminOnly, async (req, res) => {
  try {
    const reviews = await prisma.reviews.findMany({
      where: { is_approved: 0 },
      include: { products: { select: { name: true } } },
      orderBy: { created_at: 'desc' }
    });
    const mapped = reviews.map(r => ({ ...r, product_name: r.products?.name || null, products: undefined }));
    res.json({ reviews: mapped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/approve', auth, adminOnly, async (req, res) => {
  try {
    await prisma.reviews.update({ where: { id: Number(req.params.id) }, data: { is_approved: 1 } });
    res.json({ message: 'Review approved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/reply', auth, adminOnly, async (req, res) => {
  try {
    await prisma.reviews.update({ where: { id: Number(req.params.id) }, data: { admin_reply: req.body.reply } });
    res.json({ message: 'Reply added' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const review = await prisma.reviews.findUnique({ where: { id: Number(req.params.id) } });
    await prisma.reviews.delete({ where: { id: Number(req.params.id) } });
    if (review) {
      const agg = await prisma.reviews.aggregate({
        _avg: { rating: true },
        _count: { id: true },
        where: { product_id: review.product_id, is_approved: 1 }
      });
      await prisma.products.update({
        where: { id: review.product_id },
        data: { rating: agg._avg.rating || 0, review_count: agg._count.id }
      });
    }
    res.json({ message: 'Review deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
