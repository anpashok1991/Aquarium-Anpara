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

const db = require('./server/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, 'uploads');
['products', 'banners', 'gallery', 'settings'].forEach(dir => {
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

// Auto-seed default settings on first run
const settingCount = db.prepare('SELECT COUNT(*) as c FROM settings').get().c;
if (settingCount === 0) {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insert.run('shop_name', 'Aquarium Anpara');
  insert.run('shop_phone', '+91 98765 43210');
  insert.run('shop_email', 'info@aquariumanpara.com');
  insert.run('shop_address', 'Aquarium Anpara, Main Road, Anpara, India');
  insert.run('whatsapp_number', '919876543210');
  insert.run('shop_logo', '/images/logo.png');
  insert.run('min_order_free_delivery', '500');
  insert.run('delivery_charge', '50');
  console.log('✅ Default settings seeded');
}

app.use((req, res, next) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const s = {};
    rows.forEach(r => { s[r.key] = r.value; });
    res.locals.shopName = s.shop_name || process.env.SHOP_NAME || 'Aquarium Anpara';
    res.locals.shopPhone = s.shop_phone || process.env.SHOP_PHONE || '';
    res.locals.shopEmail = s.shop_email || process.env.SHOP_EMAIL || '';
    res.locals.shopAddress = s.shop_address || process.env.SHOP_ADDRESS || '';
    res.locals.whatsappNumber = s.whatsapp_number || process.env.WHATSAPP_NUMBER || '';
    res.locals.minOrderFreeDelivery = s.min_order_free_delivery || '500';
    res.locals.deliveryCharge = s.delivery_charge || '50';
  } catch (e) {
    res.locals.shopName = process.env.SHOP_NAME || 'Aquarium Anpara';
    res.locals.shopPhone = process.env.SHOP_PHONE || '';
    res.locals.shopEmail = process.env.SHOP_EMAIL || '';
    res.locals.shopAddress = process.env.SHOP_ADDRESS || '';
    res.locals.whatsappNumber = process.env.WHATSAPP_NUMBER || '';
    res.locals.minOrderFreeDelivery = '500';
    res.locals.deliveryCharge = '50';
  }
  res.locals.googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  next();
});

app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/products', require('./server/routes/products'));
app.use('/api/categories', require('./server/routes/categories'));
app.use('/api/brands', require('./server/routes/brands'));
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

app.use('/', require('./server/routes/pages'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Internal server error' });
  }
  res.status(500).render('error', { title: 'Error', error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🐠 ${process.env.SHOP_NAME || 'Aquarium Anpara'} is running!`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📊 Admin: http://localhost:${PORT}/admin\n`);
});
