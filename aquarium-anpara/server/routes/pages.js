const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { requireAdminPage } = require('../middleware/auth');
const { enc, dec } = require('../url-helper');

function buildBreadcrumb(items) {
  return items.map((item, i) => ({
    "@type": "ListItem",
    "position": i + 1,
    "name": item.name,
    "item": item.url
  }));
}

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
    const brandsWithCount = await prisma.brands.findMany({
      where: { is_active: 1 },
      include: { _count: { select: { products: { where: { is_active: 1 } } } } },
      orderBy: { name: 'asc' }
    });
    const brandsData = brandsWithCount.map(b => ({ ...b, product_count: b._count.products }));
    const featuredMapped = featured.map(p => ({ ...p, primary_image: p.product_images[0]?.image_url || null, _encUrl: enc(p.id) }));
    const bestMapped = bestSellers.map(p => ({ ...p, primary_image: p.product_images[0]?.image_url || null, _encUrl: enc(p.id) }));
    const newMapped = newArrivals.map(p => ({ ...p, primary_image: p.product_images[0]?.image_url || null }));
    const reviewsMapped = reviews.map(r => { const o = { ...r, product_name: r.products?.name }; delete o.products; return o; });
    const seo = {
      title: 'Home',
      description: `${res.locals.shopName} - Premium pet and aquarium store in Anpara. Shop aquarium fish, dogs, cats, birds, pet food, aquarium supplies, decorations, and accessories with doorstep delivery.`,
      keywords: 'aquarium shop Anpara, pet store, aquarium fish, tropical fish, pet supplies, aquarium tanks, fish food, pet food, aquarium plants, aquarium accessories, pet store near me',
      breadcrumb: buildBreadcrumb([{ name: 'Home', url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/' }])
    };
    res.render('index', { title: 'Home', seo, featured: featuredMapped, bestSellers: bestMapped, newArrivals: newMapped, categories: catWithCount, brands: brandsData, banners, reviews: reviewsMapped });
  } catch (e) { res.render('index', { title: 'Home', seo: { title: 'Home' }, featured: [], bestSellers: [], newArrivals: [], categories: [], brands: [], banners: [], reviews: [] }); }
});

router.get('/about', (req, res) => {
  const seo = {
    title: 'About Us',
    description: `Learn more about ${res.locals.shopName} - your trusted pet and aquarium store in Anpara. Discover our story, mission, and commitment to quality pet care and aquarium supplies.`,
    breadcrumb: buildBreadcrumb([
      { name: 'Home', url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/' },
      { name: 'About Us', url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/about' }
    ])
  };
  res.render('about', { title: 'About Us', seo });
});

router.get('/shop', async (req, res) => {
  try {
    const [categories, brands, allBreeds] = await Promise.all([
      prisma.categories.findMany({ where: { is_active: 1 }, orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] }),
      prisma.brands.findMany({ where: { is_active: 1 }, orderBy: { name: 'asc' } }),
      prisma.breeds.findMany({ where: { is_active: 1 }, include: { categories: { select: { is_live: true } } }, orderBy: { name: 'asc' } })
    ]);
    const breeds = allBreeds.filter(b => b.categories?.is_live).map(b => ({ ...b, categories: undefined }));
    const seo = {
      title: 'Shop',
      description: `Browse our wide selection of pet and aquarium products at ${res.locals.shopName}. Shop aquarium fish, pet food, accessories, medicines, decorations, and more with easy online ordering and doorstep delivery.`,
      breadcrumb: buildBreadcrumb([
        { name: 'Home', url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/' },
        { name: 'Shop', url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/shop' }
      ])
    };
    res.render('shop', { title: 'Shop', seo, categories, brands, breeds, selectedCategory: '' });
  } catch (e) { res.render('shop', { title: 'Shop', seo: { title: 'Shop' }, categories: [], brands: [], breeds: [], selectedCategory: '' }); }
});

router.get('/product/:param', async (req, res) => {
  try {
    let productId = dec(req.params.param);
    const where = productId ? { id: productId, is_active: 1 } : { slug: req.params.param, is_active: 1 };
    const product = await prisma.products.findFirst({
      where,
      include: {
        categories: { select: { name: true, slug: true, is_live: true } },
        brands: { select: { name: true } },
        breeds: { select: { name: true } }
      }
    });
    if (!product) return res.status(404).render('error', { title: 'Not Found', seo: { title: 'Not Found', robots: 'noindex' }, error: 'Product not found' });
    const [images, reviews, related] = await Promise.all([
      prisma.product_images.findMany({ where: { product_id: product.id }, orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }] }),
      prisma.reviews.findMany({ where: { product_id: product.id, is_approved: 1 }, orderBy: { created_at: 'desc' }, include: { users: { select: { name: true } } } }),
      prisma.products.findMany({ where: { category_id: product.category_id, id: { not: product.id }, is_active: 1 }, take: 4, include: { product_images: { where: { is_primary: 1 }, take: 1 } } })
    ]);
    const primaryImage = images.find(i => i.is_primary)?.image_url || images[0]?.image_url || null;
    const productSeo = {
      name: product.name,
      description: (product.meta_description || product.description || '').replace(/<[^>]*>/g, '').substring(0, 200),
      sku: product.sku || '',
      brand: product.brands?.name || '',
      images: images.length ? images.map(i => 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + i.image_url) : ['/images/no-image.png'],
      slug: product.slug,
      _encUrl: enc(product.id),
      price: product.discount_price > 0 ? product.discount_price : product.price,
      stock: product.stock_quantity
    };
    const seo = {
      title: product.meta_title || product.name,
      description: (product.meta_description || product.description || '').replace(/<[^>]*>/g, '').substring(0, 200),
      og_image: primaryImage,
      og_type: 'product',
      keywords: `${product.name}, ${product.categories?.name || ''}, buy ${product.name} online, aquarium products, pet supplies`,
      product: productSeo,
      breadcrumb: buildBreadcrumb([
        { name: 'Home', url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/' },
        { name: product.categories?.name || 'Shop', url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + (product.categories?.slug ? '/category/' + product.categories.slug : '/shop') },
        { name: product.name, url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/product/' + enc(product.id) }
      ])
    };
    const productData = {
      ...product,
      _encUrl: enc(product.id),
      category_name: product.categories?.name,
      category_slug: product.categories?.slug,
      is_live: product.categories?.is_live ? true : false,
      brand_name: product.brands?.name,
      breed_name: product.breeds?.name,
      images,
      reviews: reviews.map(r => ({ ...r, user_name: r.users?.name })),
      related: related.map(p => ({ ...p, primary_image: p.product_images[0]?.image_url || null, _encUrl: enc(p.id) }))
    };
    delete productData.categories;
    delete productData.brands;
    delete productData.breeds;
    res.render('product', { title: product.name, seo, product: productData });
  } catch (e) { res.status(500).render('error', { title: 'Error', seo: { title: 'Error' }, error: e.message }); }
});

router.get('/category/:slug', async (req, res) => {
  try {
    const category = await prisma.categories.findFirst({ where: { slug: req.params.slug } });
    if (!category) return res.status(404).render('error', { title: 'Not Found', seo: { title: 'Not Found', robots: 'noindex' }, error: 'Category not found' });
    const [categories, brands, allBreeds] = await Promise.all([
      prisma.categories.findMany({ where: { is_active: 1 }, orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] }),
      prisma.brands.findMany({ where: { is_active: 1 }, orderBy: { name: 'asc' } }),
      prisma.breeds.findMany({ where: { is_active: 1 }, include: { categories: { select: { is_live: true } } }, orderBy: { name: 'asc' } })
    ]);
    const breeds = allBreeds.filter(b => b.categories?.is_live).map(b => ({ ...b, categories: undefined }));
    const seo = {
      title: category.name,
      description: `Shop ${category.name} at ${res.locals.shopName}. ${category.description || `Browse our collection of ${category.name} products with easy online ordering and doorstep delivery.`}`,
      keywords: `${category.name}, buy ${category.name} online, ${category.name} products, aquarium shop, pet supplies`,
      og_image: category.image || null,
      breadcrumb: buildBreadcrumb([
        { name: 'Home', url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/' },
        { name: 'Shop', url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/shop' },
        { name: category.name, url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/category/' + category.slug }
      ])
    };
    res.render('shop', { title: category.name, seo, categories, brands, breeds, selectedCategory: req.params.slug });
  } catch (e) { res.render('shop', { title: 'Shop', seo: { title: 'Shop' }, categories: [], brands: [], breeds: [], selectedCategory: '' }); }
});

router.get('/cart', (req, res) => {
  const seo = { title: 'Shopping Cart', robots: 'noindex' };
  res.render('cart', { title: 'Shopping Cart', seo });
});
router.get('/checkout', (req, res) => {
  const seo = { title: 'Checkout', robots: 'noindex' };
  res.render('checkout', { title: 'Checkout', seo });
});
router.get('/order-confirmation/:orderNumber', (req, res) => {
  const seo = { title: 'Order Confirmed', robots: 'noindex' };
  res.render('order-confirmation', { title: 'Order Confirmed', seo, orderNumber: req.params.orderNumber, paymentMethod: req.query.pay || '' });
});
router.get('/orders', (req, res) => {
  const seo = { title: 'My Orders', robots: 'noindex' };
  res.render('orders', { title: 'My Orders', seo });
});
router.get('/orders/:orderNumber', (req, res) => {
  const seo = { title: 'Order Details', robots: 'noindex' };
  res.render('order-detail', { title: 'Order Details', seo, orderNumber: req.params.orderNumber });
});
router.get('/invoice/:orderNumber', async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber.toUpperCase();
    const order = await prisma.orders.findFirst({ where: { order_number: orderNumber } });
    if (!order) return res.status(404).render('error', { title: 'Not Found', seo: { title: 'Not Found' }, error: 'Order not found' });
    if (order.order_status !== 'delivered' && order.order_status !== 'completed') {
      if (order.sale_type !== 'offline') {
        return res.status(403).render('error', { title: 'Not Available', seo: { title: 'Not Available' }, error: 'Invoice will be available once the order is delivered.' });
      }
    }
    order.items = await prisma.order_items.findMany({
      where: { order_id: order.id },
      include: { products: { select: { hsn_code: true, barcode: true } } }
    });
    const seo = { title: 'Invoice ' + order.order_number, robots: 'noindex' };
    res.render('invoice', { title: 'Invoice', seo, order });
  } catch (e) { res.status(500).render('error', { title: 'Error', seo: { title: 'Error' }, error: e.message }); }
});

router.get('/admin/offline-sale', requireAdminPage, (req, res) => { res.render('admin/offline-sale', { title: 'Offline Sale', seo: { robots: 'noindex' } }); });

router.get('/admin/staff', requireAdminPage, (req, res) => { res.render('admin/staff', { title: 'Manage Staff', seo: { robots: 'noindex' } }); });

router.get('/profile', (req, res) => {
  const seo = { title: 'My Profile', robots: 'noindex' };
  res.render('profile', { title: 'My Profile', seo });
});
router.get('/wishlist', (req, res) => {
  const seo = { title: 'Wishlist', robots: 'noindex' };
  res.render('wishlist', { title: 'Wishlist', seo });
});
router.get('/gallery', (req, res) => {
  const seo = {
    title: 'Gallery',
    description: `Browse our photo gallery at ${res.locals.shopName}. See our aquarium setups, pets, products, and customer highlights.`,
    breadcrumb: buildBreadcrumb([
      { name: 'Home', url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/' },
      { name: 'Gallery', url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/gallery' }
    ])
  };
  res.render('gallery', { title: 'Gallery', seo });
});
router.get('/contact', (req, res) => {
  const seo = {
    title: 'Contact Us',
    description: `Get in touch with ${res.locals.shopName}. Visit our store in Anpara, call us, or send us a message. We're here to help with all your pet and aquarium needs.`,
    breadcrumb: buildBreadcrumb([
      { name: 'Home', url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/' },
      { name: 'Contact Us', url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/contact' }
    ])
  };
  res.render('contact', { title: 'Contact Us', seo });
});
router.get('/login', (req, res) => {
  const seo = { title: 'Login', robots: 'noindex' };
  res.render('login', { title: 'Login', seo });
});
router.get('/register', (req, res) => {
  const seo = { title: 'Register', robots: 'noindex' };
  res.render('register', { title: 'Register', seo });
});
router.get('/track-order', (req, res) => {
  const seo = {
    title: 'Track Order',
    description: `Track your order at ${res.locals.shopName}. Enter your order number to check the status and delivery updates.`,
    breadcrumb: buildBreadcrumb([
      { name: 'Home', url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/' },
      { name: 'Track Order', url: 'https://' + (res.locals.shopDomain || 'aquarium-anpara.com') + '/track-order' }
    ])
  };
  res.render('track-order', { title: 'Track Order', seo });
});

// Sitemap
router.get('/sitemap.xml', async (req, res) => {
  try {
    const domain = res.locals.shopDomain || 'aquarium-anpara.com';
    const [products, categories] = await Promise.all([
      prisma.products.findMany({ where: { is_active: 1 }, select: { id: true, updated_at: true } }),
      prisma.categories.findMany({ where: { is_active: 1 }, select: { slug: true } })
    ]);
    const staticPages = ['/', '/shop', '/about', '/gallery', '/contact', '/track-order'];
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    staticPages.forEach(p => {
      xml += `  <url><loc>https://${domain}${p}</loc><priority>${p === '/' ? '1.0' : '0.8'}</priority></url>\n`;
    });
    categories.forEach(c => {
      xml += `  <url><loc>https://${domain}/category/${c.slug}</loc><priority>0.7</priority></url>\n`;
    });
    products.forEach(p => {
      xml += `  <url><loc>https://${domain}/product/${enc(p.id)}</loc><priority>0.6</priority><lastmod>${(p.updated_at || new Date()).toISOString()}</lastmod></url>\n`;
    });
    xml += '</urlset>';
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (e) {
    res.status(500).send('Error generating sitemap');
  }
});

// robots.txt
router.get('/robots.txt', (req, res) => {
  const domain = res.locals.shopDomain || 'aquarium-anpara.com';
  res.header('Content-Type', 'text/plain');
  res.send(`User-agent: *\nAllow: /\nSitemap: https://${domain}/sitemap.xml\n`);
});

router.get('/admin', requireAdminPage, (req, res) => { res.render('admin/dashboard', { title: 'Admin Dashboard', seo: { robots: 'noindex' } }); });
router.get('/admin/products', requireAdminPage, (req, res) => { res.render('admin/products', { title: 'Manage Products', seo: { robots: 'noindex' } }); });
router.get('/admin/products/new', requireAdminPage, (req, res) => { res.render('admin/product-form', { title: 'Add Product', seo: { robots: 'noindex' }, product: null }); });
router.get('/admin/products/edit/:id', requireAdminPage, async (req, res) => {
  try {
    const product = await prisma.products.findFirst({ where: { id: Number(req.params.id) }, include: { product_images: { orderBy: { sort_order: 'asc' } } } });
    if (!product) return res.redirect('/admin/products');
    const p = { ...product, primary_image: product.product_images[0]?.image_url || null };
    res.render('admin/product-form', { title: 'Edit Product', seo: { robots: 'noindex' }, product: p, productId: req.params.id });
  } catch (e) { res.redirect('/admin/products'); }
});
router.get('/admin/categories', requireAdminPage, (req, res) => { res.render('admin/categories', { title: 'Manage Categories', seo: { robots: 'noindex' } }); });
router.get('/admin/brands', requireAdminPage, (req, res) => { res.render('admin/brands', { title: 'Manage Brands', seo: { robots: 'noindex' } }); });
router.get('/admin/breeds', requireAdminPage, async (req, res) => {
  const categories = await prisma.categories.findMany({ where: { is_active: 1, is_live: 1 }, orderBy: { name: 'asc' } });
  res.render('admin/breeds', { title: 'Manage Breeds', seo: { robots: 'noindex' }, categories });
});
router.get('/admin/orders', requireAdminPage, (req, res) => { res.render('admin/orders', { title: 'Manage Orders', seo: { robots: 'noindex' } }); });
router.get('/admin/customers', requireAdminPage, (req, res) => { res.render('admin/customers', { title: 'Manage Customers', seo: { robots: 'noindex' } }); });
router.get('/admin/inventory', requireAdminPage, (req, res) => { res.render('admin/inventory', { title: 'Inventory Management', seo: { robots: 'noindex' } }); });
router.get('/admin/barcode-labels', requireAdminPage, (req, res) => { res.render('admin/barcode-labels', { title: 'Barcode Labels', seo: { robots: 'noindex' } }); });
router.get('/admin/coupons', requireAdminPage, (req, res) => { res.render('admin/coupons', { title: 'Manage Coupons', seo: { robots: 'noindex' } }); });
router.get('/admin/reviews', requireAdminPage, (req, res) => { res.render('admin/reviews', { title: 'Manage Reviews', seo: { robots: 'noindex' } }); });
router.get('/admin/reports', requireAdminPage, (req, res) => { res.render('admin/reports', { title: 'Reports', seo: { robots: 'noindex' } }); });
router.get('/admin/banners', requireAdminPage, (req, res) => { res.render('admin/banners', { title: 'Manage Banners', seo: { robots: 'noindex' } }); });
router.get('/admin/gallery', requireAdminPage, (req, res) => { res.render('admin/gallery', { title: 'Manage Gallery', seo: { robots: 'noindex' } }); });
router.get('/admin/settings', requireAdminPage, (req, res) => { res.render('admin/settings', { title: 'Settings', seo: { robots: 'noindex' } }); });
router.get('/admin/messages', requireAdminPage, (req, res) => { res.render('admin/messages', { title: 'Contact Messages', seo: { robots: 'noindex' } }); });
router.get('/admin/users', requireAdminPage, (req, res) => { res.render('admin/users', { title: 'Manage Users', seo: { robots: 'noindex' } }); });

module.exports = router;
