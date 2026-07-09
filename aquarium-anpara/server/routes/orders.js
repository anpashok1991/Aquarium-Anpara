const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, adminOnly, optionalAuth } = require('../middleware/auth');

function generateOrderNumber() {
  const date = new Date();
  const prefix = 'AQ';
  const datePart = date.getFullYear().toString().slice(-2) + String(date.getMonth()+1).padStart(2,'0') + String(date.getDate()).padStart(2,'0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${datePart}${random}`;
}

router.post('/', optionalAuth, (req, res) => {
  try {
    const { customer_name, customer_email, customer_phone, customer_whatsapp, shipping_address, shipping_city, shipping_state, shipping_pincode,
      payment_method, coupon_code, notes } = req.body;
    
    if (!customer_name || !customer_phone || !shipping_address || !shipping_city || !shipping_state || !shipping_pincode) {
      return res.status(400).json({ error: 'All shipping details are required' });
    }

    const sessionId = req.headers['x-session-id'] || 'guest';
    let cartItems;
    if (req.user) {
      cartItems = db.prepare(`SELECT c.*, p.name, p.price, p.discount_price, p.stock_quantity, p.is_active,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
        FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ? AND c.saved_for_later = 0`).all(req.user.id);
    } else {
      cartItems = db.prepare(`SELECT c.*, p.name, p.price, p.discount_price, p.stock_quantity, p.is_active,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
        FROM cart c JOIN products p ON c.product_id = p.id WHERE c.session_id = ? AND c.user_id IS NULL AND c.saved_for_later = 0`).all(sessionId);
    }

    if (!cartItems.length) return res.status(400).json({ error: 'Cart is empty' });

    let subtotal = 0;
    let discount = 0;
    
    cartItems.forEach(item => {
      const unitPrice = item.discount_price > 0 ? item.discount_price : item.price;
      subtotal += unitPrice * item.quantity;
    });

    if (coupon_code) {
      const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').get(coupon_code);
      if (coupon) {
        if (subtotal >= coupon.min_order) {
          discount = coupon.discount_type === 'percentage' ? (subtotal * coupon.discount_value / 100) : coupon.discount_value;
          if (coupon.max_discount > 0) discount = Math.min(discount, coupon.max_discount);
          db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(coupon.id);
        }
      }
    }

    const shipping_charge = subtotal >= 500 ? 0 : 50;
    const total = subtotal - discount + shipping_charge;
    const orderNumber = generateOrderNumber();

    const result = db.prepare(`INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_phone, customer_whatsapp,
      shipping_address, shipping_city, shipping_state, shipping_pincode, subtotal, discount, shipping_charge, total,
      payment_method, coupon_code, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      orderNumber, req.user?.id || null, customer_name, customer_email || null, customer_phone, customer_whatsapp || customer_phone,
      shipping_address, shipping_city, shipping_state, shipping_pincode, subtotal, discount, shipping_charge, total,
      payment_method || 'cod', coupon_code || null, notes || null
    );

    const orderId = result.lastInsertRowid;
    const stmtItem = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, product_image, quantity, price, discount, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const stmtStock = db.prepare('UPDATE products SET stock_quantity = stock_quantity - ?, sold_count = sold_count + ? WHERE id = ?');
    const stmtLog = db.prepare('INSERT INTO inventory_logs (product_id, type, quantity, reference, notes) VALUES (?, ?, ?, ?, ?)');

    const insertItems = db.transaction(() => {
      cartItems.forEach(item => {
        const unitPrice = item.discount_price > 0 ? item.discount_price : item.price;
        const itemDiscount = item.price - unitPrice;
        const itemTotal = unitPrice * item.quantity;
        stmtItem.run(orderId, item.product_id, item.name, item.image, item.quantity, item.price, itemDiscount, itemTotal);
        stmtStock.run(item.quantity, item.quantity, item.product_id);
        stmtLog.run(item.product_id, 'sale', item.quantity, orderNumber, `Order #${orderNumber}`);
      });
    });
    insertItems();

    if (req.user) {
      db.prepare('DELETE FROM cart WHERE user_id = ? AND saved_for_later = 0').run(req.user.id);
    } else {
      db.prepare('DELETE FROM cart WHERE session_id = ? AND user_id IS NULL AND saved_for_later = 0').run(sessionId);
    }

    if (req.user) {
      db.prepare('UPDATE customers SET total_orders = total_orders + 1, total_spent = total_spent + ? WHERE user_id = ?').run(total, req.user.id);
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    res.status(201).json({ order });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', auth, (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let where = [];
    let params = [];
    
    if (req.user.role === 'customer') {
      where.push('o.user_id = ?');
      params.push(req.user.id);
    }
    if (status) { where.push('o.order_status = ?'); params.push(status); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (Number(page) - 1) * Number(limit);
    const total = db.prepare(`SELECT COUNT(*) as total FROM orders o ${whereClause}`).get(...params).total;
    
    const orders = db.prepare(`SELECT o.* FROM orders o ${whereClause} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
    res.json({ orders, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (req.user.role === 'customer' && order.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    res.json({ order });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/track/:orderNumber', (req, res) => {
  try {
    const order = db.prepare('SELECT order_number, order_status, payment_status, total, created_at, updated_at FROM orders WHERE order_number = ?').get(req.params.orderNumber);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/status', auth, adminOnly, (req, res) => {
  try {
    const { order_status, payment_status } = req.body;
    if (order_status) {
      db.prepare('UPDATE orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(order_status, req.params.id);
    }
    if (payment_status) {
      db.prepare('UPDATE orders SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(payment_status, req.params.id);
    }
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    res.json({ order });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/cancel/:orderNumber', auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.orderNumber);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    if (order.order_status !== 'pending') return res.status(400).json({ error: 'Only pending orders can be cancelled' });
    db.prepare("UPDATE orders SET order_status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);
    res.json({ order: db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/shipping/:orderNumber', auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.orderNumber);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    if (order.order_status !== 'pending') return res.status(400).json({ error: 'Only pending orders can be updated' });
    const { customer_name, customer_phone, customer_whatsapp, shipping_address, shipping_city, shipping_state, shipping_pincode } = req.body;
    if (!shipping_address || !shipping_city || !shipping_state || !shipping_pincode) return res.status(400).json({ error: 'All address fields required' });
    db.prepare(`UPDATE orders SET customer_name=COALESCE(?,customer_name), customer_phone=COALESCE(?,customer_phone),
      customer_whatsapp=COALESCE(?,customer_whatsapp), shipping_address=?, shipping_city=?, shipping_state=?, shipping_pincode=?,
      updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(customer_name, customer_phone, customer_whatsapp, shipping_address, shipping_city, shipping_state, shipping_pincode, order.id);
    res.json({ order: db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
