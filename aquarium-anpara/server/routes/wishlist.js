const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const items = await prisma.wishlists.findMany({
      where: { user_id: req.user.id },
      include: {
        products: {
          select: {
            name: true, slug: true, price: true, discount_price: true, is_active: true,
            product_images: { where: { is_primary: 1 }, take: 1, select: { image_url: true } }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    const mapped = items.map(item => ({
      id: item.id, user_id: item.user_id, product_id: item.product_id, created_at: item.created_at,
      name: item.products.name, slug: item.products.slug,
      price: item.products.price, discount_price: item.products.discount_price,
      is_active: item.products.is_active,
      image: item.products.product_images[0]?.image_url || null
    }));
    res.json({ items: mapped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { product_id } = req.body;
    const existing = await prisma.wishlists.findFirst({
      where: { user_id: req.user.id, product_id: Number(product_id) }
    });
    if (existing) {
      await prisma.wishlists.delete({ where: { id: existing.id } });
      res.json({ message: 'Removed from wishlist', active: false });
    } else {
      await prisma.wishlists.create({ data: { user_id: req.user.id, product_id: Number(product_id) } });
      res.json({ message: 'Added to wishlist', active: true });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/check/:productId', auth, async (req, res) => {
  try {
    const exists = await prisma.wishlists.findFirst({
      where: { user_id: req.user.id, product_id: Number(req.params.productId) }
    });
    res.json({ isWishlisted: !!exists });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
