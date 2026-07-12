const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, optionalAuth } = require('../middleware/auth');

const getSessionId = (req) => req.headers['x-session-id'] || req.query.session || 'guest';

router.get('/', optionalAuth, async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const userId = req.user?.id;
    let items;
    if (userId) {
      const cartItems = await prisma.cart.findMany({
        where: { user_id: userId, saved_for_later: 0 },
        include: {
          products: {
            include: {
              product_images: { where: { is_primary: 1 }, take: 1, select: { image_url: true } }
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });
      items = cartItems.map(c => {
        const { products, ...cartFields } = c;
        return {
          ...cartFields,
          name: products.name,
          slug: products.slug,
          price: products.price,
          discount_price: products.discount_price,
          stock_quantity: products.stock_quantity,
          is_active: products.is_active,
          image: products.product_images[0]?.image_url || null
        };
      });
    } else {
      const cartItems = await prisma.cart.findMany({
        where: { session_id: sessionId, user_id: null, saved_for_later: 0 },
        include: {
          products: {
            include: {
              product_images: { where: { is_primary: 1 }, take: 1, select: { image_url: true } }
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });
      items = cartItems.map(c => {
        const { products, ...cartFields } = c;
        return {
          ...cartFields,
          name: products.name,
          slug: products.slug,
          price: products.price,
          discount_price: products.discount_price,
          stock_quantity: products.stock_quantity,
          is_active: products.is_active,
          image: products.product_images[0]?.image_url || null
        };
      });
    }
    let subtotal = 0;
    items.forEach(item => {
      item.unit_price = item.discount_price > 0 ? item.discount_price : item.price;
      item.item_total = item.unit_price * item.quantity;
      subtotal += item.item_total;
    });
    res.json({ items, subtotal, count: items.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/add', optionalAuth, async (req, res) => {
  try {
    const product_id = Number(req.body.product_id);
    const quantity = Number(req.body.quantity) || 1;
    const sessionId = getSessionId(req);
    const userId = req.user?.id;
    const product = await prisma.products.findFirst({ where: { id: product_id, is_active: 1 } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.stock_quantity < quantity) return res.status(400).json({ error: 'Only ' + product.stock_quantity + ' in stock' });

    let existing;
    if (userId) {
      existing = await prisma.cart.findFirst({
        where: { user_id: userId, product_id, saved_for_later: 0 }
      });
    } else {
      existing = await prisma.cart.findFirst({
        where: { session_id: sessionId, user_id: null, product_id, saved_for_later: 0 }
      });
    }

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > product.stock_quantity) return res.status(400).json({ error: 'Only ' + product.stock_quantity + ' available, you already have ' + existing.quantity + ' in cart' });
      await prisma.cart.update({ where: { id: existing.id }, data: { quantity: newQty } });
    } else {
      await prisma.cart.create({
        data: { session_id: sessionId, user_id: userId || null, product_id, quantity }
      });
    }
    res.json({ message: 'Added to cart' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', optionalAuth, async (req, res) => {
  try {
    const quantity = Number(req.body.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      await prisma.cart.delete({ where: { id: Number(req.params.id) } });
      return res.json({ message: 'Cart updated' });
    }
    const item = await prisma.cart.findUnique({
      where: { id: Number(req.params.id) },
      include: { products: { select: { stock_quantity: true } } }
    });
    if (!item) return res.status(404).json({ error: 'Cart item not found' });
    if (quantity > item.products.stock_quantity) return res.status(400).json({ error: 'Insufficient stock' });
    await prisma.cart.update({ where: { id: item.id }, data: { quantity } });
    res.json({ message: 'Cart updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    await prisma.cart.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Removed from cart' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/saved', optionalAuth, async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const userId = req.user?.id;
    let items;
    if (userId) {
      const cartItems = await prisma.cart.findMany({
        where: { user_id: userId, saved_for_later: 1 },
        include: {
          products: {
            include: {
              product_images: { where: { is_primary: 1 }, take: 1, select: { image_url: true } }
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });
      items = cartItems.map(c => {
        const { products, ...cartFields } = c;
        return {
          ...cartFields,
          name: products.name,
          slug: products.slug,
          price: products.price,
          discount_price: products.discount_price,
          stock_quantity: products.stock_quantity,
          is_active: products.is_active,
          image: products.product_images[0]?.image_url || null
        };
      });
    } else {
      const cartItems = await prisma.cart.findMany({
        where: { session_id: sessionId, user_id: null, saved_for_later: 1 },
        include: {
          products: {
            include: {
              product_images: { where: { is_primary: 1 }, take: 1, select: { image_url: true } }
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });
      items = cartItems.map(c => {
        const { products, ...cartFields } = c;
        return {
          ...cartFields,
          name: products.name,
          slug: products.slug,
          price: products.price,
          discount_price: products.discount_price,
          stock_quantity: products.stock_quantity,
          is_active: products.is_active,
          image: products.product_images[0]?.image_url || null
        };
      });
    }
    items.forEach(item => { item.unit_price = item.discount_price > 0 ? item.discount_price : item.price; });
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/save-later/:id', optionalAuth, async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (req.user) {
      await prisma.cart.updateMany({
        where: { id: Number(req.params.id), user_id: req.user.id },
        data: { saved_for_later: 1 }
      });
    } else {
      await prisma.cart.updateMany({
        where: { id: Number(req.params.id), session_id: sessionId, user_id: null },
        data: { saved_for_later: 1 }
      });
    }
    res.json({ message: 'Saved for later' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/move-to-cart/:id', optionalAuth, async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (req.user) {
      await prisma.cart.updateMany({
        where: { id: Number(req.params.id), user_id: req.user.id },
        data: { saved_for_later: 0 }
      });
    } else {
      await prisma.cart.updateMany({
        where: { id: Number(req.params.id), session_id: sessionId, user_id: null },
        data: { saved_for_later: 0 }
      });
    }
    res.json({ message: 'Moved to cart' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/clear', optionalAuth, async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (req.user) {
      await prisma.cart.deleteMany({ where: { user_id: req.user.id } });
    } else {
      await prisma.cart.deleteMany({ where: { session_id: sessionId, user_id: null } });
    }
    res.json({ message: 'Cart cleared' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
