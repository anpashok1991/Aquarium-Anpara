const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', (req, res) => {
  try {
    const banners = db.prepare('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order').all();
    res.json({ banners });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/all', auth, adminOnly, (req, res) => {
  try {
    const banners = db.prepare('SELECT * FROM banners ORDER BY sort_order').all();
    res.json({ banners });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, (req, res) => {
  try {
    const { title, subtitle, image, link, sort_order } = req.body;
    const result = db.prepare('INSERT INTO banners (title, subtitle, image, link, sort_order) VALUES (?, ?, ?, ?, ?)')
      .run(title, subtitle, image, link, sort_order || 0);
    res.status(201).json({ banner: db.prepare('SELECT * FROM banners WHERE id = ?').get(result.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, adminOnly, (req, res) => {
  try {
    const { title, subtitle, image, link, sort_order, is_active } = req.body;
    db.prepare('UPDATE banners SET title=COALESCE(?,title), subtitle=COALESCE(?,subtitle), image=COALESCE(?,image), link=COALESCE(?,link), sort_order=COALESCE(?,sort_order), is_active=COALESCE(?,is_active) WHERE id=?')
      .run(title, subtitle, image, link, sort_order, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);
    res.json({ banner: db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, (req, res) => {
  try {
    db.prepare('DELETE FROM banners WHERE id = ?').run(req.params.id);
    res.json({ message: 'Banner deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
