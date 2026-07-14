const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly, optionalAuth, staffOrAdmin, requireWritePermission } = require('../middleware/auth');

async function recalcProductRating(productId) {
  const agg = await prisma.reviews.aggregate({
    _avg: { rating: true },
    _count: { id: true },
    where: { product_id: productId, is_approved: 1 }
  });
  await prisma.products.update({
    where: { id: productId },
    data: { rating: agg._avg.rating || 0, review_count: agg._count.id }
  });
}

router.get('/product/:productId', async (req, res) => {
  try {
    const reviews = await prisma.reviews.findMany({
      where: { product_id: Number(req.params.productId), is_approved: 1 },
      include: { users: { select: { name: true } } },
      orderBy: { created_at: 'desc' }
    });
    const mapped = reviews.map(r => ({ ...r, user_name: r.users?.name || null, users: undefined, images: r.images ? JSON.parse(r.images) : null }));
    res.json({ reviews: mapped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/my', auth, async (req, res) => {
  try {
    const productIds = req.query.product_ids ? req.query.product_ids.split(',').map(Number) : [];
    if (!productIds.length) return res.json({ reviews: [] });
    const reviews = await prisma.reviews.findMany({
      where: { user_id: req.user.id, product_id: { in: productIds } },
      orderBy: { created_at: 'desc' }
    });
    const mapped = reviews.map(r => ({ ...r, images: r.images ? JSON.parse(r.images) : null }));
    res.json({ reviews: mapped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { product_id, rating, title, comment, customer_name, images } = req.body;
    if (!product_id || !rating) return res.status(400).json({ error: 'Product and rating required' });
    const review = await prisma.reviews.create({
      data: {
        product_id: Number(product_id), rating: Number(rating),
        user_id: req.user?.id || null,
        customer_name: customer_name || req.user?.name || 'Anonymous',
        title, comment, is_approved: 1,
        images: images && images.length ? JSON.stringify(images) : null
      }
    });
    await recalcProductRating(Number(product_id));
    res.status(201).json({ review });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const existing = await prisma.reviews.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ error: 'Review not found' });
    if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    const { rating, title, comment, images } = req.body;
    await prisma.reviews.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(rating !== undefined && { rating: Number(rating) }),
        ...(title !== undefined && { title }),
        ...(comment !== undefined && { comment }),
        ...(images !== undefined && { images: images.length ? JSON.stringify(images) : null })
      }
    });
    await recalcProductRating(existing.product_id);
    res.json({ message: 'Review updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/pending', auth, staffOrAdmin, requireWritePermission('reviews'), async (req, res) => {
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

router.put('/:id/approve', auth, staffOrAdmin, requireWritePermission('reviews'), async (req, res) => {
  try {
    const review = await prisma.reviews.findUnique({ where: { id: Number(req.params.id) } });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    await prisma.reviews.update({ where: { id: Number(req.params.id) }, data: { is_approved: 1 } });
    await recalcProductRating(review.product_id);
    res.json({ message: 'Review approved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/reply', auth, staffOrAdmin, requireWritePermission('reviews'), async (req, res) => {
  try {
    await prisma.reviews.update({ where: { id: Number(req.params.id) }, data: { admin_reply: req.body.reply } });
    res.json({ message: 'Reply added' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, staffOrAdmin, requireWritePermission('reviews'), async (req, res) => {
  try {
    const review = await prisma.reviews.findUnique({ where: { id: Number(req.params.id) } });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    await prisma.reviews.delete({ where: { id: Number(req.params.id) } });
    await recalcProductRating(review.product_id);
    res.json({ message: 'Review deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
