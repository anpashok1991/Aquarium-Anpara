const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { requireAdminPage } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const [featured, bestSellers, newArrivals, categories, banners, reviews] = await Promise.all([
      prisma.products.findMany({ where: { is_active: 1, is_featured: 1 }, orderBy: { sold_count: 'desc' }, take: 8, include: { product_images: { where: { is_primary: 1 }, take: 1 } } }),
      prisma.products.findMany({ where: { is_active: 1, is_best_seller: 1 }, orderBy: { sold_count: 'desc' }, take: 8, include: { product_images: { where: { is_primary: 1 }, take: 1 } } }),
      prisma.products.findMany({ where: { is_active: 1, is_new_arrival: 1 }, orderBy: { created_at: 'desc' }, take: 8, include: { product_images: { where: { is_primary: 1 }, take: 1 } } }),
      prisma.categories.findMany({ where: { is_active: 1, parent_id: null }, orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] }),
      prisma.banners.findMany({ where: { is_active: 1 }, orderBy: { sort_order: 'asc' } }),
      prisma.reviews.findMany({ where: { is_approved: 1 }, orderBy: { created_at: 'desc' }, take: 6, include: { products: { select: { name: true } } } })
    ]);
    const catWithCount = await Promise.all(categories.map(async c => {
      const subIds = await prisma.categories.findMany({ where: { parent_id: c.id, is_active: 1 }, select: { id: true } });
      const ids = [c.id, ...subIds.map(s => s.id)];
      const product_count = await prisma.products.count({ where: { category_id: { in: ids }, is_active: 1 } });
      return { ...c, product_count };
    }));
    const featuredMapped = featured.map(p => ({ ...p, primary_image: p.product_images[0]?.image_url || null }));
    const bestMapped = bestSellers.map(p => ({ ...p, primary_image: p.product_images[0]?.image_url || null }));
    const newMapped = newArrivals.map(p => ({ ...p, primary_image: p.product_images[0]?.image_url || null }));
    const reviewsMapped = reviews.map(r => { const o = { ...r, product_name: r.products?.name }; delete o.products; return o; });
    res.render('index', { title: 'Home', featured: featuredMapped, bestSellers: bestMapped, newArrivals: newMapped, categories: catWithCount, banners, reviews: reviewsMapped });
  } catch (e) { res.render('index', { title: 'Home', featured: [], bestSellers: [], newArrivals: [], categories: [], banners: [], reviews: [] }); }
});

router.get('/about', (req, res) => { res.render('about', { title: 'About Us' }); });

router.get('/shop', async (req, res) => {
  try {
    const [categories, brands] = await Promise.all([
      prisma.categories.findMany({ where: { is_active: 1 }, orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] }),
      prisma.brands.findMany({ where: { is_active: 1 }, orderBy: { name: 'asc' } })
    ]);
    res.render('shop', { title: 'Shop', categories, brands, selectedCategory: '' });
  } catch (e) { res.render('shop', { title: 'Shop', categories: [], brands: [], selectedCategory: '' }); }
});

router.get('/product/:slug', async (req, res) => {
  try {
    const product = await prisma.products.findFirst({
      where: { slug: req.params.slug, is_active: 1 },
      include: {
        categories: { select: { name: true, slug: true } },
        brands: { select: { name: true } }
      }
    });
    if (!product) return res.status(404).render('error', { title: 'Not Found', error: 'Product not found' });
    const [images, reviews, related] = await Promise.all([
      prisma.product_images.findMany({ where: { product_id: product.id }, orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }] }),
      prisma.reviews.findMany({ where: { product_id: product.id, is_approved: 1 }, orderBy: { created_at: 'desc' }, include: { users: { select: { name: true } } } }),
      prisma.products.findMany({ where: { category_id: product.category_id, id: { not: product.id }, is_active: 1 }, take: 4, include: { product_images: { where: { is_primary: 1 }, take: 1 } } })
    ]);
    const productData = {
      ...product,
      category_name: product.categories?.name,
      category_slug: product.categories?.slug,
      brand_name: product.brands?.name,
      images,
      reviews: reviews.map(r => ({ ...r, user_name: r.users?.name })),
      related: related.map(p => ({ ...p, primary_image: p.product_images[0]?.image_url || null }))
    };
    delete productData.categories;
    delete productData.brands;
    res.render('product', { title: product.name, product: productData });
  } catch (e) { res.status(500).render('error', { title: 'Error', error: e.message }); }
});

router.get('/category/:slug', async (req, res) => {
  try {
    const category = await prisma.categories.findFirst({ where: { slug: req.params.slug } });
    if (!category) return res.status(404).render('error', { title: 'Not Found', error: 'Category not found' });
    const [categories, brands] = await Promise.all([
      prisma.categories.findMany({ where: { is_active: 1 }, orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] }),
      prisma.brands.findMany({ where: { is_active: 1 }, orderBy: { name: 'asc' } })
    ]);
    res.render('shop', { title: category.name, categories, brands, selectedCategory: req.params.slug });
  } catch (e) { res.render('shop', { title: 'Shop', categories: [], brands: [], selectedCategory: '' }); }
});

router.get('/cart', (req, res) => { res.render('cart', { title: 'Shopping Cart' }); });
router.get('/checkout', (req, res) => { res.render('checkout', { title: 'Checkout' }); });
router.get('/order-confirmation/:orderNumber', (req, res) => { res.render('order-confirmation', { title: 'Order Confirmed', orderNumber: req.params.orderNumber }); });
router.get('/orders', (req, res) => { res.render('orders', { title: 'My Orders' }); });
router.get('/orders/:orderNumber', (req, res) => { res.render('order-detail', { title: 'Order Details', orderNumber: req.params.orderNumber }); });
router.get('/profile', (req, res) => { res.render('profile', { title: 'My Profile' }); });
router.get('/wishlist', (req, res) => { res.render('wishlist', { title: 'Wishlist' }); });
router.get('/gallery', (req, res) => { res.render('gallery', { title: 'Gallery' }); });
router.get('/contact', (req, res) => { res.render('contact', { title: 'Contact Us' }); });
router.get('/login', (req, res) => { res.render('login', { title: 'Login' }); });
router.get('/register', (req, res) => { res.render('register', { title: 'Register' }); });
router.get('/track-order', (req, res) => { res.render('track-order', { title: 'Track Order' }); });

router.get('/admin', requireAdminPage, (req, res) => { res.render('admin/dashboard', { title: 'Admin Dashboard' }); });
router.get('/admin/products', requireAdminPage, (req, res) => { res.render('admin/products', { title: 'Manage Products' }); });
router.get('/admin/products/new', requireAdminPage, (req, res) => { res.render('admin/product-form', { title: 'Add Product', product: null }); });
router.get('/admin/products/edit/:id', requireAdminPage, async (req, res) => {
  try {
    const product = await prisma.products.findFirst({ where: { id: Number(req.params.id) }, include: { product_images: { orderBy: { sort_order: 'asc' } } } });
    if (!product) return res.redirect('/admin/products');
    const p = { ...product, primary_image: product.product_images[0]?.image_url || null };
    res.render('admin/product-form', { title: 'Edit Product', product: p, productId: req.params.id });
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
