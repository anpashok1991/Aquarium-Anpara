const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', (req, res) => {
  try {
    const categories = db.prepare(`SELECT c.*, 
      (SELECT COUNT(*) FROM products WHERE category_id = c.id AND is_active = 1) as product_count
      FROM categories c WHERE c.is_active = 1 ORDER BY c.sort_order, c.name`).all();
    
    const tree = categories.filter(c => !c.parent_id).map(c => ({
      ...c,
      subcategories: categories.filter(sc => sc.parent_id === c.id)
    }));
    
    res.json({ categories: tree, flat: categories });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:slug', (req, res) => {
  try {
    const category = db.prepare('SELECT * FROM categories WHERE slug = ?').get(req.params.slug);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    category.subcategories = db.prepare('SELECT * FROM categories WHERE parent_id = ? AND is_active = 1').all(category.id);
    res.json({ category });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, (req, res) => {
  try {
    const { name, description, image, parent_id, sort_order } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let finalSlug = slug;
    let counter = 1;
    while (db.prepare('SELECT id FROM categories WHERE slug = ?').get(finalSlug)) {
      finalSlug = `${slug}-${counter++}`;
    }
    const result = db.prepare('INSERT INTO categories (name, slug, description, image, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, finalSlug, description, image, parent_id || null, sort_order || 0);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ category });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, adminOnly, (req, res) => {
  try {
    const { name, description, image, parent_id, sort_order, is_active } = req.body;
    db.prepare('UPDATE categories SET name=COALESCE(?,name), description=COALESCE(?,description), image=COALESCE(?,image), parent_id=COALESCE(?,parent_id), sort_order=COALESCE(?,sort_order), is_active=COALESCE(?,is_active) WHERE id=?')
      .run(name, description, image, parent_id, sort_order, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    res.json({ category });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, (req, res) => {
  try {
    db.prepare('UPDATE categories SET parent_id = NULL WHERE parent_id = ?').run(req.params.id);
    db.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').run(req.params.id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
