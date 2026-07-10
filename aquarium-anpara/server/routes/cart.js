const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, optionalAuth } = require('../middleware/auth');

const getSessionId = (req) => req.headers['x-session-id'] || req.query.session || 'guest';

router.get('/', optionalAuth, (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const userId = req.user?.id;
    let items;
    if (userId) {
      items = db.prepare(`SELECT c.*, p.name, p.slug, p.price, p.discount_price, p.stock_quantity, p.is_active,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
        FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ? AND c.saved_for_later = 0 ORDER BY c.created_at DESC`).all(userId);
    } else {
      items = db.prepare(`SELECT c.*, p.name, p.slug, p.price, p.discount_price, p.stock_quantity, p.is_active,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
        FROM cart c JOIN products p ON c.product_id = p.id WHERE c.session_id = ? AND c.user_id IS NULL AND c.saved_for_later = 0 ORDER BY c.created_at DESC`).all(sessionId);
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

router.post('/add', optionalAuth, (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    const sessionId = getSessionId(req);
    const userId = req.user?.id;
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(product_id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.stock_quantity < quantity) return res.status(400).json({ error: 'Insufficient stock' });

    let existing;
    if (userId) {
      existing = db.prepare('SELECT * FROM cart WHERE user_id = ? AND product_id = ? AND saved_for_later = 0').get(userId, product_id);
    } else {
      existing = db.prepare('SELECT * FROM cart WHERE session_id = ? AND user_id IS NULL AND product_id = ? AND saved_for_later = 0').get(sessionId, product_id);
    }

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > product.stock_quantity) return res.status(400).json({ error: 'Insufficient stock' });
      db.prepare('UPDATE cart SET quantity = ? WHERE id = ?').run(newQty, existing.id);
    } else {
      db.prepare('INSERT INTO cart (session_id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)').run(sessionId, userId || null, product_id, quantity);
    }
    res.json({ message: 'Added to cart' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', optionalAuth, (req, res) => {
  try {
    const { quantity } = req.body;
    const item = db.prepare('SELECT c.*, p.stock_quantity FROM cart c JOIN products p ON c.product_id = p.id WHERE c.id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Cart item not found' });
    if (quantity > item.stock_quantity) return res.status(400).json({ error: 'Insufficient stock' });
    if (quantity <= 0) {
      db.prepare('DELETE FROM cart WHERE id = ?').run(req.params.id);
    } else {
      db.prepare('UPDATE cart SET quantity = ? WHERE id = ?').run(quantity, req.params.id);
    }
    res.json({ message: 'Cart updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', optionalAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM cart WHERE id = ?').run(req.params.id);
    res.json({ message: 'Removed from cart' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/saved', optionalAuth, (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const userId = req.user?.id;
    let items;
    if (userId) {
      items = db.prepare(`SELECT c.*, p.name, p.slug, p.price, p.discount_price, p.stock_quantity, p.is_active,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
        FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ? AND c.saved_for_later = 1 ORDER BY c.created_at DESC`).all(userId);
    } else {
      items = db.prepare(`SELECT c.*, p.name, p.slug, p.price, p.discount_price, p.stock_quantity, p.is_active,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
        FROM cart c JOIN products p ON c.product_id = p.id WHERE c.session_id = ? AND c.user_id IS NULL AND c.saved_for_later = 1 ORDER BY c.created_at DESC`).all(sessionId);
    }
    items.forEach(item => { item.unit_price = item.discount_price > 0 ? item.discount_price : item.price; });
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/save-later/:id', optionalAuth, (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (req.user) {
      db.prepare('UPDATE cart SET saved_for_later = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    } else {
      db.prepare('UPDATE cart SET saved_for_later = 1 WHERE id = ? AND session_id = ? AND user_id IS NULL').run(req.params.id, sessionId);
    }
    res.json({ message: 'Saved for later' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/move-to-cart/:id', optionalAuth, (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (req.user) {
      db.prepare('UPDATE cart SET saved_for_later = 0 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    } else {
      db.prepare('UPDATE cart SET saved_for_later = 0 WHERE id = ? AND session_id = ? AND user_id IS NULL').run(req.params.id, sessionId);
    }
    res.json({ message: 'Moved to cart' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/clear', optionalAuth, (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (req.user) {
      db.prepare('DELETE FROM cart WHERE user_id = ?').run(req.user.id);
    } else {
      db.prepare('DELETE FROM cart WHERE session_id = ? AND user_id IS NULL').run(sessionId);
    }
    res.json({ message: 'Cart cleared' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
