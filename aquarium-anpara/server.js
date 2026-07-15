require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const fs = require('fs');

if (typeof BigInt !== 'undefined' && !BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () { return Number(this); };
  console.log('✅ BigInt.prototype.toJSON patched');
}

const prisma = require('./server/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, 'uploads');
['products', 'banners', 'gallery', 'settings', 'categories', 'general', 'videos', 'payments'].forEach(dir => {
  const p = path.join(uploadsDir, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.query.folder || 'general';
    const dir = path.join(uploadsDir, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload endpoint
const { auth, adminOnly } = require('./server/middleware/auth');
app.post('/api/upload', auth, adminOnly, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded or invalid file type' });
  const folder = req.query.folder || 'general';
  const url = `/uploads/${folder}/${req.file.filename}`;
  res.json({ url });
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('view cache');

// Visitor counter middleware — counts unique devices once per day via cookie
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/images/') || req.path.startsWith('/css/') || req.path.startsWith('/js/')) return next();
  if (!req.cookies._v) {
    res.cookie('_v', '1', { maxAge: 86400000, httpOnly: true, sameSite: 'lax' });
    prisma.$executeRawUnsafe(`UPDATE settings SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'visitor_count'`).catch(() => {});
  }
  next();
});

// Auto-seed default settings on first run
(async () => {
  try {
    const settingCount = await prisma.settings.count();
    if (settingCount === 0) {
      const defaults = [
        { key: 'shop_name', value: 'Aquarium Anpara' },
        { key: 'shop_phone', value: '+91 98765 43210' },
        { key: 'shop_email', value: 'info@aquariumanpara.com' },
        { key: 'shop_address', value: 'Aquarium Anpara, Main Road, Anpara, India' },
        { key: 'whatsapp_number', value: '919876543210' },
        { key: 'shop_logo', value: '/images/logo.png' },
        { key: 'min_order_free_delivery', value: '500' },
        { key: 'delivery_charge', value: '50' },
        { key: 'visitor_count', value: '100000' }
      ];
      for (const s of defaults) {
        await prisma.settings.upsert({
          where: { key: s.key },
          update: {},
          create: s
        });
      }
      console.log('✅ Default settings seeded');
    }
  } catch (e) { console.log('ℹ️ Settings check deferred:', e.message); }
})();

// Auto-migrate: add token_version column for existing databases
(async () => {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0`);
    console.log('✅ token_version column added to users table');
  } catch (e) { /* column already exists */ }
})();

// Auto-migrate: add permissions column for staff role-based access
(async () => {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN permissions TEXT`);
    console.log('✅ permissions column added to users table');
  } catch (e) { /* column already exists */ }
})();

// Auto-migrate: add images column to reviews table
(async () => {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE reviews ADD COLUMN images TEXT`);
    console.log('✅ images column added to reviews table');
  } catch (e) { /* column already exists */ }
})();

// Auto-migrate: add gst_percent column to products table
(async () => {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE products ADD COLUMN gst_percent REAL DEFAULT 0`);
    console.log('✅ gst_percent column added to products table');
  } catch (e) { /* column already exists */ }
})();

// Auto-migrate: add payment_screenshot and transaction_id columns to orders table
(async () => {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN payment_screenshot TEXT DEFAULT NULL`);
    console.log('✅ payment_screenshot column added to orders table');
  } catch (e) { /* column already exists */ }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN transaction_id TEXT DEFAULT NULL`);
    console.log('✅ transaction_id column added to orders table');
  } catch (e) { /* column already exists */ }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN platform_fee REAL DEFAULT 0`);
    console.log('✅ platform_fee column added to orders table');
  } catch (e) { /* column already exists */ }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN cancel_charge REAL DEFAULT 0`);
    console.log('✅ cancel_charge column added to orders table');
  } catch (e) { /* column already exists */ }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN refund_status TEXT DEFAULT NULL`);
    console.log('✅ refund_status column added to orders table');
  } catch (e) { /* column already exists */ }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN refund_amount REAL DEFAULT 0`);
    console.log('✅ refund_amount column added to orders table');
  } catch (e) { /* column already exists */ }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE products ADD COLUMN hsn_code TEXT DEFAULT NULL`);
    console.log('✅ hsn_code column added to products table');
  } catch (e) { /* column already exists */ }
})();

// Auto-migrate: update payment_method CHECK constraint to include 'scan_pay'
(async () => {
  try {
    await prisma.$executeRawUnsafe(`INSERT INTO orders (order_number, customer_name, customer_phone, shipping_address, shipping_city, shipping_state, shipping_pincode, subtotal, total, payment_method, created_at) VALUES ('__ck_scan_pay','_test','0000000000','_test','_test','_test','000000',0,0,'scan_pay','2000-01-01')`);
    // If inserted, constraint already allows scan_pay — clean up test row
    await prisma.$executeRawUnsafe(`DELETE FROM orders WHERE order_number = '__ck_scan_pay'`);
  } catch (e) {
    // Constraint needs updating
    console.log('🔄 Updating payment_method CHECK to allow scan_pay...');
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = OFF`);
    // Must recreate all tables that reference orders since SQLite FK refs follow table renames
    const backupOrderItems = await prisma.$queryRawUnsafe(`SELECT sql FROM sqlite_master WHERE type='table' AND name='order_items'`);
    const backupOrderTracking = await prisma.$queryRawUnsafe(`SELECT sql FROM sqlite_master WHERE type='table' AND name='order_tracking'`);
    const backupPayments = await prisma.$queryRawUnsafe(`SELECT sql FROM sqlite_master WHERE type='table' AND name='payments'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE order_items RENAME TO order_items_old`);
    await prisma.$executeRawUnsafe(`ALTER TABLE order_tracking RENAME TO order_tracking_old`);
    await prisma.$executeRawUnsafe(`ALTER TABLE payments RENAME TO payments_old`);
    await prisma.$executeRawUnsafe(`ALTER TABLE orders RENAME TO orders_old`);
    await prisma.$executeRawUnsafe(`CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_email TEXT,
      customer_phone TEXT NOT NULL,
      customer_whatsapp TEXT,
      shipping_address TEXT NOT NULL,
      shipping_city TEXT NOT NULL,
      shipping_state TEXT NOT NULL,
      shipping_pincode TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL DEFAULT 0,
      shipping_charge REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT 'cod' CHECK(payment_method IN ('cod','upi','bank_transfer','scan_pay')),
      payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','failed','refunded')),
      order_status TEXT DEFAULT 'pending' CHECK(order_status IN ('pending','confirmed','processing','dispatched','delivered','cancelled')),
      notes TEXT,
      coupon_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sale_type TEXT DEFAULT 'online',
      payment_screenshot TEXT,
      transaction_id TEXT
    )`);
    // Recreate referencing tables with correct FK
    await prisma.$executeRawUnsafe(`CREATE TABLE order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      product_image TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL,
      discount REAL DEFAULT 0,
      gst_percent REAL DEFAULT 0,
      gst_amount REAL DEFAULT 0,
      total REAL NOT NULL
    )`);
    await prisma.$executeRawUnsafe(`INSERT INTO order_items SELECT * FROM order_items_old`);
    await prisma.$executeRawUnsafe(`DROP TABLE order_items_old`);
    await prisma.$executeRawUnsafe(`CREATE TABLE order_tracking (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      description TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await prisma.$executeRawUnsafe(`INSERT INTO order_tracking SELECT * FROM order_tracking_old`);
    await prisma.$executeRawUnsafe(`DROP TABLE order_tracking_old`);
    await prisma.$executeRawUnsafe(`CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      transaction_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await prisma.$executeRawUnsafe(`INSERT INTO payments SELECT * FROM payments_old`);
    await prisma.$executeRawUnsafe(`DROP TABLE payments_old`);
    // Copy orders data
    await prisma.$executeRawUnsafe(`INSERT INTO orders SELECT * FROM orders_old`);
    await prisma.$executeRawUnsafe(`DROP TABLE orders_old`);
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);
    console.log('✅ payment_method CHECK constraint updated to include scan_pay');
  }
})();

// Auto-migrate: add gst_percent and gst_amount columns to order_items table
(async () => {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE order_items ADD COLUMN gst_percent REAL DEFAULT 0`);
    console.log('✅ gst_percent column added to order_items table');
  } catch (e) { /* column already exists */ }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE order_items ADD COLUMN gst_amount REAL DEFAULT 0`);
    console.log('✅ gst_amount column added to order_items table');
  } catch (e) { /* column already exists */ }
})();

// Auto-migrate: create customer records for existing users who lack one
(async () => {
  try {
    const usersWithoutCustomer = await prisma.$queryRawUnsafe(`
      SELECT u.id, u.name, u.email, u.phone FROM users u
      LEFT JOIN customers c ON c.user_id = u.id
      WHERE c.id IS NULL AND u.role = 'customer'
    `);
    for (const u of usersWithoutCustomer) {
      await prisma.customers.create({
        data: { user_id: u.id, name: u.name, email: u.email, phone: u.phone }
      });
    }
    if (usersWithoutCustomer.length > 0) {
      console.log(`✅ Created customer records for ${usersWithoutCustomer.length} existing users`);
    }
  } catch (e) { /* migration skipped */ }
})();

// Auto-migrate: ensure visitor_count setting exists
(async () => {
  try {
    const existing = await prisma.settings.findUnique({ where: { key: 'visitor_count' } });
    if (!existing) {
      await prisma.settings.create({ data: { key: 'visitor_count', value: '100000' } });
      console.log('✅ visitor_count setting created');
    }
  } catch (e) { /* migration skipped */ }
})();

app.use(async (req, res, next) => {
  try {
    const rows = await prisma.settings.findMany({ select: { key: true, value: true } });
    const s = {};
    rows.forEach(r => { s[r.key] = r.value; });
    res.locals.shopName = s.shop_name || process.env.SHOP_NAME || 'Aquarium Anpara';
    res.locals.shopPhone = s.shop_phone || process.env.SHOP_PHONE || '';
    res.locals.shopEmail = s.shop_email || process.env.SHOP_EMAIL || '';
    res.locals.shopAddress = s.shop_address || process.env.SHOP_ADDRESS || '';
    res.locals.shopGst = s.shop_gst || '';
    res.locals.whatsappNumber = s.whatsapp_number || process.env.WHATSAPP_NUMBER || '';
    res.locals.minOrderFreeDelivery = s.min_order_free_delivery || '500';
    res.locals.deliveryCharge = s.delivery_charge || '50';
    res.locals.shopLogo = s.shop_logo || '';
    res.locals.googleVerification = s.google_verification || '';
    res.locals.gaId = s.ga_id || '';
    res.locals.fbPixel = s.fb_pixel || '';
    res.locals.fbPixel = s.fb_pixel || '';
    res.locals.metaKeywords = s.meta_keywords || '';
    res.locals.upiId = s.upi_id || '';
    res.locals.cancelChargePercent = s.cancel_charge_percent || '0';
    res.locals.platformFee = s.platform_fee || '0';
    res.locals.barcodeEnabled = s.barcode_enabled === 'true';
    try { res.locals.promotion1 = JSON.parse(s.promotion_1 || '{}'); } catch(e) { res.locals.promotion1 = {}; }
    try { res.locals.promotion2 = JSON.parse(s.promotion_2 || '{}'); } catch(e) { res.locals.promotion2 = {}; }
    try { res.locals.scanner1 = JSON.parse(s.scanner_1 || '{}'); } catch(e) { res.locals.scanner1 = {}; }
    try { res.locals.scanner2 = JSON.parse(s.scanner_2 || '{}'); } catch(e) { res.locals.scanner2 = {}; }
  } catch (e) {
    res.locals.shopName = process.env.SHOP_NAME || 'Aquarium Anpara';
    res.locals.shopPhone = process.env.SHOP_PHONE || '';
    res.locals.shopEmail = process.env.SHOP_EMAIL || '';
    res.locals.shopAddress = process.env.SHOP_ADDRESS || '';
    res.locals.shopGst = '';
    res.locals.whatsappNumber = process.env.WHATSAPP_NUMBER || '';
    res.locals.minOrderFreeDelivery = '500';
    res.locals.deliveryCharge = '50';
    res.locals.shopLogo = '';
    res.locals.googleVerification = '';
    res.locals.gaId = '';
    res.locals.fbPixel = '';
    res.locals.metaKeywords = '';
    res.locals.upiId = '';
    res.locals.cancelChargePercent = '0';
    res.locals.platformFee = '0';
    res.locals.promotion1 = {};
    res.locals.promotion2 = {};
    res.locals.scanner1 = {};
    res.locals.scanner2 = {};
  }
  res.locals.googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  res.locals.shopDomain = process.env.SHOP_DOMAIN || req.hostname || 'aquarium-anpara.com';
  next();
});

app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/products', require('./server/routes/products'));
app.use('/api/categories', require('./server/routes/categories'));
app.use('/api/brands', require('./server/routes/brands'));
app.use('/api/breeds', require('./server/routes/breeds'));
app.use('/api/cart', require('./server/routes/cart'));
app.use('/api/orders', require('./server/routes/orders'));
app.use('/api/customers', require('./server/routes/customers'));
app.use('/api/reviews', require('./server/routes/reviews'));
app.use('/api/coupons', require('./server/routes/coupons'));
app.use('/api/inventory', require('./server/routes/inventory'));
app.use('/api/reports', require('./server/routes/reports'));
app.use('/api/admin', require('./server/routes/admin'));
app.use('/api/settings', require('./server/routes/settings'));
app.use('/api/banners', require('./server/routes/banners'));
app.use('/api/gallery', require('./server/routes/gallery'));
app.use('/api/notifications', require('./server/routes/notifications'));
app.use('/api/contact', require('./server/routes/contact'));
app.use('/api/wishlist', require('./server/routes/wishlist'));
app.use('/api/addresses', require('./server/routes/addresses'));
app.use('/api/staff', require('./server/routes/staff'));

app.use('/', require('./server/routes/pages'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Internal server error' });
  }
  res.status(500).render('error', { title: 'Error', seo: { title: 'Error' }, error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🐠 ${process.env.SHOP_NAME || 'Aquarium Anpara'} is running!`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📊 Admin: http://localhost:${PORT}/admin\n`);
});
