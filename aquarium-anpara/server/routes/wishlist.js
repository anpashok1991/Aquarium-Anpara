const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth } = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  try {
    const items = db.prepare(`SELECT w.*, p.name, p.slug, p.price, p.discount_price, p.is_active,
      (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
      FROM wishlists w JOIN products p ON w.product_id = p.id WHERE w.user_id = ? ORDER BY w.created_at DESC`).all(req.user.id);
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, (req, res) => {
  try {
    const { product_id } = req.body;
    const existing = db.prepare('SELECT * FROM wishlists WHERE user_id = ? AND product_id = ?').get(req.user.id, product_id);
    if (existing) {
      db.prepare('DELETE FROM wishlists WHERE id = ?').run(existing.id);
      res.json({ message: 'Removed from wishlist', active: false });
    } else {
      db.prepare('INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)').run(req.user.id, product_id);
      res.json({ message: 'Added to wishlist', active: true });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/check/:productId', auth, (req, res) => {
  try {
    const exists = db.prepare('SELECT * FROM wishlists WHERE user_id = ? AND product_id = ?').get(req.user.id, req.params.productId);
    res.json({ isWishlisted: !!exists });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
