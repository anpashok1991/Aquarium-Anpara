const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, adminOnly, optionalAuth } = require('../middleware/auth');

router.get('/', (req, res) => {
  try {
    const { search, category, brand, min_price, max_price, sort, page = 1, limit = 20, featured, best_seller, new_arrival, in_stock } = req.query;
    let where = ['p.is_active = 1'];
    let params = [];

    if (search) { where.push("(p.name LIKE ? OR p.description LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
    if (category) { where.push("c.slug = ?"); params.push(category); }
    if (brand) { where.push("b.slug = ?"); params.push(brand); }
    if (min_price) { where.push("p.price >= ?"); params.push(Number(min_price)); }
    if (max_price) { where.push("p.price <= ?"); params.push(Number(max_price)); }
    if (featured === '1') { where.push("p.is_featured = 1"); }
    if (best_seller === '1') { where.push("p.is_best_seller = 1"); }
    if (new_arrival === '1') { where.push("p.is_new_arrival = 1"); }
    if (in_stock === '1') { where.push("p.stock_quantity > 0"); }

    let orderBy = 'p.created_at DESC';
    if (sort === 'price_asc') orderBy = 'p.price ASC';
    else if (sort === 'price_desc') orderBy = 'p.price DESC';
    else if (sort === 'name') orderBy = 'p.name ASC';
    else if (sort === 'rating') orderBy = 'p.rating DESC';
    else if (sort === 'popular') orderBy = 'p.sold_count DESC';
    else if (sort === 'newest') orderBy = 'p.created_at DESC';

    const offset = (Number(page) - 1) * Number(limit);
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countQuery = `SELECT COUNT(*) as total FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN brands b ON p.brand_id = b.id ${whereClause}`;
    const total = db.prepare(countQuery).get(...params).total;

    const query = `SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name, b.slug as brand_slug,
      (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN brands b ON p.brand_id = b.id
      ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    
    const products = db.prepare(query).all(...params, Number(limit), offset);
    res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/featured', (req, res) => {
  try {
    const products = db.prepare(`SELECT p.*, c.name as category_name,
      (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM products p LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1 AND p.is_featured = 1 ORDER BY p.sold_count DESC LIMIT 8`).all();
    res.json({ products });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/best-sellers', (req, res) => {
  try {
    const products = db.prepare(`SELECT p.*, c.name as category_name,
      (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM products p LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1 AND p.is_best_seller = 1 ORDER BY p.sold_count DESC LIMIT 8`).all();
    res.json({ products });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/new-arrivals', (req, res) => {
  try {
    const products = db.prepare(`SELECT p.*, c.name as category_name,
      (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM products p LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1 AND p.is_new_arrival = 1 ORDER BY p.created_at DESC LIMIT 8`).all();
    res.json({ products });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:slug', (req, res) => {
  try {
    const product = db.prepare(`SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name
      FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.slug = ? AND p.is_active = 1`).get(req.params.slug);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    product.images = db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order').all(product.id);
    product.reviews = db.prepare(`SELECT r.*, u.name as user_name FROM reviews r LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ? AND r.is_approved = 1 ORDER BY r.created_at DESC`).all(product.id);
    product.related = db.prepare(`SELECT p.*, (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM products p WHERE p.category_id = ? AND p.id != ? AND p.is_active = 1 LIMIT 4`).all(product.category_id, product.id);
    
    res.json({ product });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, (req, res) => {
  try {
    const { name, description, short_description, sku, barcode, price, discount_price, cost_price, category_id, brand_id,
      stock_quantity, low_stock_threshold, weight, is_featured, is_best_seller, is_new_arrival, meta_title, meta_description, images } = req.body;
    
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let finalSlug = slug;
    let counter = 1;
    while (db.prepare('SELECT id FROM products WHERE slug = ?').get(finalSlug)) {
      finalSlug = `${slug}-${counter++}`;
    }

    const result = db.prepare(`INSERT INTO products (name, slug, description, short_description, sku, barcode, price, discount_price, cost_price,
      category_id, brand_id, stock_quantity, low_stock_threshold, weight, is_featured, is_best_seller, is_new_arrival, meta_title, meta_description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      name, finalSlug, description, short_description, sku, barcode, price || 0, discount_price || 0, cost_price || 0,
      category_id, brand_id, stock_quantity || 0, low_stock_threshold || 5, weight || 0,
      is_featured ? 1 : 0, is_best_seller ? 1 : 0, is_new_arrival ? 1 : 0, meta_title, meta_description
    );

    if (images && images.length) {
      const stmt = db.prepare('INSERT INTO product_images (product_id, image_url, is_primary, sort_order) VALUES (?, ?, ?, ?)');
      images.forEach((img, i) => stmt.run(result.lastInsertRowid, img.url || img, i === 0 ? 1 : 0, i));
    }

    if (stock_quantity > 0) {
      db.prepare('INSERT INTO inventory_logs (product_id, type, quantity, reference, notes) VALUES (?, ?, ?, ?, ?)')
        .run(result.lastInsertRowid, 'purchase', stock_quantity, 'INITIAL', 'Initial stock');
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ product });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, adminOnly, (req, res) => {
  try {
    const { name, description, short_description, sku, barcode, price, discount_price, cost_price, category_id, brand_id,
      stock_quantity, low_stock_threshold, weight, is_featured, is_best_seller, is_new_arrival, is_active, meta_title, meta_description } = req.body;
    
    db.prepare(`UPDATE products SET name=COALESCE(?,name), description=COALESCE(?,description), short_description=COALESCE(?,short_description),
      sku=COALESCE(?,sku), barcode=COALESCE(?,barcode), price=COALESCE(?,price), discount_price=COALESCE(?,discount_price),
      cost_price=COALESCE(?,cost_price), category_id=COALESCE(?,category_id), brand_id=COALESCE(?,brand_id),
      stock_quantity=COALESCE(?,stock_quantity), low_stock_threshold=COALESCE(?,low_stock_threshold), weight=COALESCE(?,weight),
      is_featured=COALESCE(?,is_featured), is_best_seller=COALESCE(?,is_best_seller), is_new_arrival=COALESCE(?,is_new_arrival),
      is_active=COALESCE(?,is_active), meta_title=COALESCE(?,meta_title), meta_description=COALESCE(?,meta_description),
      updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
      name, description, short_description, sku, barcode, price, discount_price, cost_price,
      category_id, brand_id, stock_quantity, low_stock_threshold, weight,
      is_featured !== undefined ? (is_featured ? 1 : 0) : null,
      is_best_seller !== undefined ? (is_best_seller ? 1 : 0) : null,
      is_new_arrival !== undefined ? (is_new_arrival ? 1 : 0) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      meta_title, meta_description, req.params.id
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json({ product });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, (req, res) => {
  try {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
