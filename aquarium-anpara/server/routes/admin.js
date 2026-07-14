const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../database');
const { auth, adminOnly, staffOrAdmin, requireWritePermission } = require('../middleware/auth');

function generateOrderNumber() {
  const date = new Date();
  const prefix = 'AQ';
  const datePart = date.getFullYear().toString().slice(-2) + String(date.getMonth()+1).padStart(2,'0') + String(date.getDate()).padStart(2,'0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${datePart}${random}`;
}

router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      select: { id: true, name: true, email: true, phone: true, role: true, is_active: true, created_at: true },
      orderBy: { created_at: 'desc' }
    });
    res.json({ users });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/users', auth, adminOnly, async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    if (!['admin', 'staff', 'customer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const existing = await prisma.users.findUnique({ where: { email }, select: { id: true } });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const hash = bcrypt.hashSync(password, 10);
    const user = await prisma.users.create({
      data: { name, email, phone: phone || null, password: hash, role },
      select: { id: true, name: true, email: true, phone: true, role: true, is_active: true, created_at: true }
    });
    res.json({ user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/users/:id/role', auth, adminOnly, async (req, res) => {
  try {
    await prisma.users.update({ where: { id: Number(req.params.id) }, data: { role: req.body.role } });
    res.json({ message: 'Role updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/users/:id/status', auth, adminOnly, async (req, res) => {
  try {
    await prisma.users.update({ where: { id: Number(req.params.id) }, data: { is_active: req.body.is_active ? 1 : 0 } });
    res.json({ message: 'Status updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/audit-logs', auth, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = Number(page), limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;
    const total = await prisma.audit_logs.count();
    const logs = await prisma.audit_logs.findMany({
      skip: offset, take: limitNum,
      include: { users: { select: { name: true } } },
      orderBy: { created_at: 'desc' }
    });
    const mapped = logs.map(l => ({ ...l, user_name: l.users?.name || null, users: undefined }));
    res.json({ logs: mapped, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/offline-sale', auth, staffOrAdmin, requireWritePermission('offline-sale'), async (req, res) => {
  try {
    const { items, customer_name, customer_phone, payment_method, payment_status, discount_amount, notes } = req.body;

    if (!items || !items.length) return res.status(400).json({ error: 'At least one item is required' });
    if (!customer_name || !customer_phone) return res.status(400).json({ error: 'Customer name and phone are required' });

    const productIds = items.map(i => Number(i.product_id));
    const products = await prisma.products.findMany({
      where: { id: { in: productIds }, is_active: 1 },
      include: { product_images: { where: { is_primary: 1 }, take: 1 } }
    });
    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });

    let subtotal = 0;
    let tax = 0;
    const itemGstDetails = [];
    for (const item of items) {
      const product = productMap[Number(item.product_id)];
      if (!product) return res.status(400).json({ error: `Product ID ${item.product_id} not found or inactive` });
      if (product.stock_quantity < Number(item.quantity)) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}` });
      }
      const unitPrice = product.discount_price > 0 ? product.discount_price : product.price;
      const lineTotal = unitPrice * Number(item.quantity);
      const gstPct = product.gst_percent || 0;
      const gstAmt = gstPct > 0 ? lineTotal * gstPct / (100 + gstPct) : 0;
      subtotal += lineTotal;
      tax += gstAmt;
      itemGstDetails.push({
        productId: product.id,
        gstPercent: gstPct,
        gstAmount: gstAmt
      });
    }

    const discount = Math.min(Number(discount_amount) || 0, subtotal);
    const total = subtotal - discount;
    const orderNumber = generateOrderNumber();

    const newOrder = await prisma.orders.create({
      data: {
        order_number: orderNumber,
        user_id: req.user.id,
        customer_name,
        customer_phone,
        customer_whatsapp: customer_phone,
        shipping_address: 'Store Pickup',
        shipping_city: 'Store',
        shipping_state: 'Store',
        shipping_pincode: '000000',
        subtotal,
        discount,
        shipping_charge: 0,
        tax,
        total,
        payment_method: payment_method || 'cod',
        payment_status: payment_status || 'paid',
        order_status: 'delivered',
        sale_type: 'offline',
        notes: notes ? `Offline Sale - ${notes}` : 'Offline Sale at Store'
      }
    });

    await prisma.order_tracking.create({
      data: { order_id: newOrder.id, status: 'delivered', description: 'Offline sale at store' }
    });

    await prisma.$transaction(async (tx) => {
      let i = 0;
      for (const item of items) {
        const product = productMap[Number(item.product_id)];
        const qty = Number(item.quantity);
        const unitPrice = product.discount_price > 0 ? product.discount_price : product.price;
        const itemTotal = unitPrice * qty;
        const gstInfo = itemGstDetails[i++];
        await tx.order_items.create({
          data: {
            order_id: newOrder.id,
            product_id: product.id,
            product_name: product.name,
            product_image: product.product_images?.[0]?.image_url || null,
            quantity: qty,
            price: product.price,
            discount: product.price - unitPrice,
            gst_percent: gstInfo.gstPercent,
            gst_amount: gstInfo.gstAmount,
            total: itemTotal
          }
        });
        await tx.products.update({
          where: { id: product.id },
          data: { stock_quantity: { decrement: qty }, sold_count: { increment: qty } }
        });
        await tx.inventory_logs.create({
          data: {
            product_id: product.id,
            type: 'sale',
            quantity: qty,
            reference: orderNumber,
            notes: `Offline sale at store by ${req.user.name}`
          }
        });
      }
    });

    const order = await prisma.orders.findFirst({ where: { id: newOrder.id } });
    order.items = await prisma.order_items.findMany({ where: { order_id: order.id } });

    res.status(201).json({ order });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/backup', auth, adminOnly, (req, res) => {
  try {
    res.json({ message: 'Backup feature - use database file directly for SQLite backup' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/reset-database', auth, adminOnly, async (req, res) => {
  try {
    const { delete_word } = req.body;
    if (delete_word !== 'DELETE') {
      return res.status(400).json({ error: 'Please type DELETE to confirm' });
    }

    const tables = [
      'addresses', 'audit_logs', 'banners', 'brands', 'breeds', 'cart',
      'categories', 'contact_messages', 'coupons', 'customers', 'gallery',
      'inventory_logs', 'notifications', 'order_items', 'order_tracking',
      'orders', 'payments', 'product_images', 'products', 'reviews', 'wishlists'
    ];

    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = OFF`);
    for (const table of tables) {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    }
    // Reset auto-increment counters
    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM sqlite_sequence WHERE name = '${table}'`);
      } catch (e) { /* table may not have auto-increment */ }
    }
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);

    res.json({ message: 'Database reset complete. Users and settings preserved.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
