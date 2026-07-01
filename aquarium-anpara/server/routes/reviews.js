const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, adminOnly, optionalAuth } = require('../middleware/auth');

router.get('/product/:productId', (req, res) => {
  try {
    const reviews = db.prepare(`SELECT r.*, u.name as user_name FROM reviews r LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ? AND r.is_approved = 1 ORDER BY r.created_at DESC`).all(req.params.productId);
    res.json({ reviews });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', optionalAuth, (req, res) => {
  try {
    const { product_id, rating, title, comment, customer_name } = req.body;
    if (!product_id || !rating) return res.status(400).json({ error: 'Product and rating required' });
    const result = db.prepare('INSERT INTO reviews (product_id, user_id, customer_name, rating, title, comment) VALUES (?, ?, ?, ?, ?, ?)')
      .run(product_id, req.user?.id || null, customer_name || req.user?.name || 'Anonymous', rating, title, comment);

    const avg = db.prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM reviews WHERE product_id = ? AND is_approved = 1').get(product_id);
    db.prepare('UPDATE products SET rating = ?, review_count = ? WHERE id = ?').run(avg.avg_rating || 0, avg.count, product_id);

    res.status(201).json({ review: db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/pending', auth, adminOnly, (req, res) => {
  try {
    const reviews = db.prepare(`SELECT r.*, p.name as product_name FROM reviews r LEFT JOIN products p ON r.product_id = p.id
      WHERE r.is_approved = 0 ORDER BY r.created_at DESC`).all();
    res.json({ reviews });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/approve', auth, adminOnly, (req, res) => {
  try {
    db.prepare('UPDATE reviews SET is_approved = 1 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Review approved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/reply', auth, adminOnly, (req, res) => {
  try {
    db.prepare('UPDATE reviews SET admin_reply = ? WHERE id = ?').run(req.body.reply, req.params.id);
    res.json({ message: 'Reply added' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, (req, res) => {
  try {
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
    if (review) {
      const avg = db.prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM reviews WHERE product_id = ? AND is_approved = 1').get(review.product_id);
      db.prepare('UPDATE products SET rating = ?, review_count = ? WHERE id = ?').run(avg.avg_rating || 0, avg.count, review.product_id);
    }
    res.json({ message: 'Review deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
