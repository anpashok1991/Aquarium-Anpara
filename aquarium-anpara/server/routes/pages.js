const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdminPage } = require('../middleware/auth');

router.get('/', (req, res) => {
  try {
    const featured = db.prepare(`SELECT p.*, (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM products p WHERE p.is_active = 1 AND p.is_featured = 1 ORDER BY p.sold_count DESC LIMIT 8`).all();
    const bestSellers = db.prepare(`SELECT p.*, (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM products p WHERE p.is_active = 1 AND p.is_best_seller = 1 ORDER BY p.sold_count DESC LIMIT 8`).all();
    const newArrivals = db.prepare(`SELECT p.*, (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM products p WHERE p.is_active = 1 AND p.is_new_arrival = 1 ORDER BY p.created_at DESC LIMIT 8`).all();
    const categories = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products WHERE category_id = c.id AND is_active = 1) as product_count
      FROM categories c WHERE c.is_active = 1 AND c.parent_id IS NULL ORDER BY c.sort_order, c.name LIMIT 12`).all();
    const banners = db.prepare('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order').all();
    const reviews = db.prepare(`SELECT r.*, p.name as product_name FROM reviews r LEFT JOIN products p ON r.product_id = p.id
      WHERE r.is_approved = 1 ORDER BY r.created_at DESC LIMIT 6`).all();
    res.render('index', { title: 'Home', featured, bestSellers, newArrivals, categories, banners, reviews });
  } catch (e) { res.render('index', { title: 'Home', featured: [], bestSellers: [], newArrivals: [], categories: [], banners: [], reviews: [] }); }
});

router.get('/about', (req, res) => { res.render('about', { title: 'About Us' }); });

router.get('/shop', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories WHERE is_active = 1 AND parent_id IS NULL ORDER BY name').all();
    const brands = db.prepare('SELECT * FROM brands WHERE is_active = 1 ORDER BY name').all();
    res.render('shop', { title: 'Shop', categories, brands, selectedCategory: '' });
  } catch (e) { res.render('shop', { title: 'Shop', categories: [], brands: [], selectedCategory: '' }); }
});

router.get('/product/:slug', (req, res) => {
  try {
    const product = db.prepare(`SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name
      FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.slug = ? AND p.is_active = 1`).get(req.params.slug);
    if (!product) return res.status(404).render('error', { title: 'Not Found', error: 'Product not found' });
    product.images = db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order').all(product.id);
    product.reviews = db.prepare(`SELECT r.*, u.name as user_name FROM reviews r LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ? AND r.is_approved = 1 ORDER BY r.created_at DESC`).all(product.id);
    product.related = db.prepare(`SELECT p.*, (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM products p WHERE p.category_id = ? AND p.id != ? AND p.is_active = 1 LIMIT 4`).all(product.category_id, product.id);
    res.render('product', { title: product.name, product });
  } catch (e) { res.status(500).render('error', { title: 'Error', error: e.message }); }
});

router.get('/category/:slug', (req, res) => {
  try {
    const category = db.prepare('SELECT * FROM categories WHERE slug = ?').get(req.params.slug);
    if (!category) return res.status(404).render('error', { title: 'Not Found', error: 'Category not found' });
    const categories = db.prepare('SELECT * FROM categories WHERE is_active = 1 AND parent_id IS NULL ORDER BY name').all();
    const brands = db.prepare('SELECT * FROM brands WHERE is_active = 1 ORDER BY name').all();
    res.render('shop', { title: category.name, categories, brands, selectedCategory: req.params.slug });
  } catch (e) { res.render('shop', { title: 'Shop', categories: [], brands: [], selectedCategory: '' }); }
});

router.get('/cart', (req, res) => { res.render('cart', { title: 'Shopping Cart' }); });
router.get('/checkout', (req, res) => { res.render('checkout', { title: 'Checkout' }); });
router.get('/order-confirmation/:orderNumber', (req, res) => { res.render('order-confirmation', { title: 'Order Confirmed', orderNumber: req.params.orderNumber }); });
router.get('/orders', (req, res) => { res.render('orders', { title: 'My Orders' }); });
router.get('/wishlist', (req, res) => { res.render('wishlist', { title: 'Wishlist' }); });
router.get('/gallery', (req, res) => { res.render('gallery', { title: 'Gallery' }); });
router.get('/contact', (req, res) => { res.render('contact', { title: 'Contact Us' }); });
router.get('/login', (req, res) => { res.render('login', { title: 'Login' }); });
router.get('/register', (req, res) => { res.render('register', { title: 'Register' }); });
router.get('/track-order', (req, res) => { res.render('track-order', { title: 'Track Order' }); });

router.get('/admin', requireAdminPage, (req, res) => { res.render('admin/dashboard', { title: 'Admin Dashboard' }); });
router.get('/admin/products', requireAdminPage, (req, res) => { res.render('admin/products', { title: 'Manage Products' }); });
router.get('/admin/products/new', requireAdminPage, (req, res) => { res.render('admin/product-form', { title: 'Add Product', product: null }); });
router.get('/admin/products/edit/:id', requireAdminPage, (req, res) => {
  try {
    const product = db.prepare(`SELECT p.*, (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image FROM products p WHERE p.id = ?`).get(req.params.id);
    if (!product) return res.redirect('/admin/products');
    res.render('admin/product-form', { title: 'Edit Product', product, productId: req.params.id });
  } catch (e) { res.redirect('/admin/products'); }
});
router.get('/admin/categories', requireAdminPage, (req, res) => { res.render('admin/categories', { title: 'Manage Categories' }); });
router.get('/admin/brands', requireAdminPage, (req, res) => { res.render('admin/brands', { title: 'Manage Brands' }); });
router.get('/admin/orders', requireAdminPage, (req, res) => { res.render('admin/orders', { title: 'Manage Orders' }); });
router.get('/admin/customers', requireAdminPage, (req, res) => { res.render('admin/customers', { title: 'Manage Customers' }); });
router.get('/admin/inventory', requireAdminPage, (req, res) => { res.render('admin/inventory', { title: 'Inventory Management' }); });
router.get('/admin/coupons', requireAdminPage, (req, res) => { res.render('admin/coupons', { title: 'Manage Coupons' }); });
router.get('/admin/reviews', requireAdminPage, (req, res) => { res.render('admin/reviews', { title: 'Manage Reviews' }); });
router.get('/admin/reports', requireAdminPage, (req, res) => { res.render('admin/reports', { title: 'Reports' }); });
router.get('/admin/banners', requireAdminPage, (req, res) => { res.render('admin/banners', { title: 'Manage Banners' }); });
router.get('/admin/gallery', requireAdminPage, (req, res) => { res.render('admin/gallery', { title: 'Manage Gallery' }); });
router.get('/admin/settings', requireAdminPage, (req, res) => { res.render('admin/settings', { title: 'Settings' }); });
router.get('/admin/messages', requireAdminPage, (req, res) => { res.render('admin/messages', { title: 'Contact Messages' }); });
router.get('/admin/users', requireAdminPage, (req, res) => { res.render('admin/users', { title: 'Manage Users' }); });

module.exports = router;
