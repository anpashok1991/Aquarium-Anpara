const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', (req, res) => {
  try {
    const brands = db.prepare(`SELECT b.*, (SELECT COUNT(*) FROM products WHERE brand_id = b.id AND is_active = 1) as product_count
      FROM brands b WHERE b.is_active = 1 ORDER BY b.name`).all();
    res.json({ brands });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, (req, res) => {
  try {
    const { name, logo, description } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let finalSlug = slug, counter = 1;
    while (db.prepare('SELECT id FROM brands WHERE slug = ?').get(finalSlug)) finalSlug = `${slug}-${counter++}`;
    const result = db.prepare('INSERT INTO brands (name, slug, logo, description) VALUES (?, ?, ?, ?)').run(name, finalSlug, logo, description);
    res.status(201).json({ brand: db.prepare('SELECT * FROM brands WHERE id = ?').get(result.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, adminOnly, (req, res) => {
  try {
    const { name, logo, description, is_active } = req.body;
    db.prepare('UPDATE brands SET name=COALESCE(?,name), logo=COALESCE(?,logo), description=COALESCE(?,description), is_active=COALESCE(?,is_active) WHERE id=?')
      .run(name, logo, description, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);
    res.json({ brand: db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, (req, res) => {
  try {
    db.prepare('UPDATE products SET brand_id = NULL WHERE brand_id = ?').run(req.params.id);
    db.prepare('DELETE FROM brands WHERE id = ?').run(req.params.id);
    res.json({ message: 'Brand deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
