const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM gallery';
    let params = [];
    if (category) { query += ' WHERE category = ?'; params.push(category); }
    query += ' ORDER BY sort_order, created_at DESC';
    const images = db.prepare(query).all(...params);
    res.json({ images });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, (req, res) => {
  try {
    const { title, image, category, sort_order } = req.body;
    const result = db.prepare('INSERT INTO gallery (title, image, category, sort_order) VALUES (?, ?, ?, ?)').run(title, image, category, sort_order || 0);
    res.status(201).json({ image: db.prepare('SELECT * FROM gallery WHERE id = ?').get(result.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, (req, res) => {
  try {
    db.prepare('DELETE FROM gallery WHERE id = ?').run(req.params.id);
    res.json({ message: 'Image deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
