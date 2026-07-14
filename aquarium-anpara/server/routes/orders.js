const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly, optionalAuth, staffOrAdmin, requireWritePermission } = require('../middleware/auth');
const { sendOrderStatusEmail } = require('../email');

const statusLabels = {
  pending: 'Order Placed',
  confirmed: 'Order Confirmed',
  processing: 'Processing',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

async function addTracking(orderId, status, description) {
  await prisma.order_tracking.create({
    data: { order_id: orderId, status, description: description || statusLabels[status] || status }
  });
}

function generateOrderNumber() {
  const date = new Date();
  const prefix = 'AQ';
  const datePart = date.getFullYear().toString().slice(-2) + String(date.getMonth()+1).padStart(2,'0') + String(date.getDate()).padStart(2,'0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${datePart}${random}`;
}

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { customer_name, customer_email, customer_phone, customer_whatsapp, shipping_address, shipping_city, shipping_state, shipping_pincode,
      payment_method, coupon_code, notes, buy_now } = req.body;

    if (!customer_name || !customer_phone || !shipping_address || !shipping_city || !shipping_state || !shipping_pincode) {
      return res.status(400).json({ error: 'All shipping details are required' });
    }

    if (!payment_method) {
      return res.status(400).json({ error: 'Please select a payment method' });
    }

    if (payment_method) {
      const pmSetting = await prisma.settings.findUnique({ where: { key: 'payment_methods' } });
      let enabled = ['cod'];
      try { enabled = JSON.parse(pmSetting?.value || '["cod"]'); } catch {}
      if (!enabled.includes(payment_method)) {
        return res.status(400).json({ error: 'Selected payment method is not available' });
      }
    }

    const sessionId = req.headers['x-session-id'] || 'guest';
    let cartItems;
    if (req.user) {
      const items = await prisma.cart.findMany({
        where: { user_id: req.user.id, saved_for_later: 0 },
        include: {
          products: {
            include: {
              product_images: { where: { is_primary: 1 }, take: 1 }
            }
          }
        }
      });
      cartItems = items.map(c => ({
        ...c,
        name: c.products.name,
        price: c.products.price,
        discount_price: c.products.discount_price,
        gst_percent: c.products.gst_percent || 0,
        stock_quantity: c.products.stock_quantity,
        is_active: c.products.is_active,
        image: c.products.product_images[0]?.image_url || null,
        products: undefined
      }));
    } else {
      const items = await prisma.cart.findMany({
        where: { session_id: sessionId, user_id: null, saved_for_later: 0 },
        include: {
          products: {
            include: {
              product_images: { where: { is_primary: 1 }, take: 1 }
            }
          }
        }
      });
      cartItems = items.map(c => ({
        ...c,
        name: c.products.name,
        price: c.products.price,
        discount_price: c.products.discount_price,
        gst_percent: c.products.gst_percent || 0,
        stock_quantity: c.products.stock_quantity,
        is_active: c.products.is_active,
        image: c.products.product_images[0]?.image_url || null,
        products: undefined
      }));
    }

    if (!cartItems.length) return res.status(400).json({ error: 'Cart is empty' });

    if (buy_now === '1') {
      const buyId = Number(req.body.buy_now_product_id);
      if (buyId) cartItems = cartItems.filter(item => item.product_id === buyId);
    }

    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    const itemGstDetails = [];

    cartItems.forEach(item => {
      const unitPrice = item.discount_price > 0 ? item.discount_price : item.price;
      const lineTotal = unitPrice * item.quantity;
      const gstPct = item.gst_percent || 0;
      // GST is inclusive in price: extract from total
      const gstAmt = gstPct > 0 ? lineTotal * gstPct / (100 + gstPct) : 0;
      subtotal += lineTotal;
      tax += gstAmt;
      itemGstDetails.push({
        productId: item.product_id,
        gstPercent: gstPct,
        gstAmount: gstAmt
      });
    });

    if (coupon_code) {
      const coupon = await prisma.coupons.findFirst({
        where: { code: coupon_code, is_active: 1 }
      });
      if (coupon) {
        if (subtotal >= coupon.min_order) {
          discount = coupon.discount_type === 'percentage' ? (subtotal * coupon.discount_value / 100) : coupon.discount_value;
          if (coupon.max_discount > 0) discount = Math.min(discount, coupon.max_discount);
          await prisma.coupons.update({
            where: { id: coupon.id },
            data: { used_count: { increment: 1 } }
          });
        }
      }
    }

    const shipping_charge = subtotal >= 500 ? 0 : 50;
    const total = subtotal - discount + shipping_charge;
    const orderNumber = generateOrderNumber();

    const newOrder = await prisma.orders.create({
      data: {
        order_number: orderNumber,
        user_id: req.user?.id || null,
        customer_name,
        customer_email: customer_email || null,
        customer_phone,
        customer_whatsapp: customer_whatsapp || customer_phone,
        shipping_address,
        shipping_city,
        shipping_state,
        shipping_pincode,
        subtotal,
        discount,
        shipping_charge,
        tax,
        total,
        payment_method: payment_method || 'cod',
        coupon_code: coupon_code || null,
        notes: notes || null
      }
    });

    const orderId = newOrder.id;
    await addTracking(orderId, 'pending');
    sendOrderStatusEmail(newOrder, null, 'pending');

    const insertItems = async (tx) => {
      let i = 0;
      for (const item of cartItems) {
        const unitPrice = item.discount_price > 0 ? item.discount_price : item.price;
        const itemDiscount = item.price - unitPrice;
        const itemTotal = unitPrice * item.quantity;
        const gstInfo = itemGstDetails[i++];
        await tx.order_items.create({
          data: {
            order_id: orderId,
            product_id: item.product_id,
            product_name: item.name,
            product_image: item.image,
            quantity: item.quantity,
            price: item.price,
            discount: itemDiscount,
            gst_percent: gstInfo.gstPercent,
            gst_amount: gstInfo.gstAmount,
            total: itemTotal
          }
        });
        await tx.products.update({
          where: { id: item.product_id },
          data: {
            stock_quantity: { decrement: item.quantity },
            sold_count: { increment: item.quantity }
          }
        });
        await tx.inventory_logs.create({
          data: {
            product_id: item.product_id,
            type: 'sale',
            quantity: item.quantity,
            reference: orderNumber,
            notes: `Order #${orderNumber}`
          }
        });
      }
    };

    await prisma.$transaction(async (tx) => {
      await insertItems(tx);
    });

    if (req.user) {
      await prisma.cart.deleteMany({ where: { user_id: req.user.id, saved_for_later: 0 } });
    } else {
      await prisma.cart.deleteMany({ where: { session_id: sessionId, user_id: null, saved_for_later: 0 } });
    }

    if (req.user) {
      const customer = await prisma.customers.findFirst({ where: { user_id: req.user.id } });
      if (customer) {
        await prisma.customers.update({
          where: { id: customer.id },
          data: { total_orders: { increment: 1 }, total_spent: { increment: total } }
        });
      }
    }

    const order = await prisma.orders.findFirst({ where: { id: orderId } });
    order.items = await prisma.order_items.findMany({ where: { order_id: orderId } });

    res.status(201).json({ order });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', auth, async (req, res) => {
  try {
    const { status, search, searchBy, page = 1, limit = 20 } = req.query;
    let where = {};

    if (req.user.role === 'customer') {
      where.user_id = req.user.id;
    }
    if (status) {
      where.order_status = status;
    }
    if (search && searchBy) {
      if (searchBy === 'order_number') {
        where.order_number = { contains: search.toUpperCase() };
      } else if (searchBy === 'customer_name') {
        where.customer_name = { contains: search };
      } else if (searchBy === 'customer_phone') {
        where.customer_phone = { contains: search };
      } else if (searchBy === 'payment_method') {
        where.payment_method = { contains: search };
      }
    }

    const offset = (Number(page) - 1) * Number(limit);
    const total = await prisma.orders.count({ where });

    const orders = await prisma.orders.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: Number(limit),
      skip: offset
    });

    res.json({ orders, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/track/:orderNumber', async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber.toUpperCase();
    const order = await prisma.orders.findFirst({
      where: { order_number: orderNumber },
      select: { id: true, order_number: true, order_status: true, payment_status: true, total: true, created_at: true, updated_at: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/tracking', async (req, res) => {
  try {
    const tracking = await prisma.order_tracking.findMany({
      where: { order_id: Number(req.params.id) },
      orderBy: { created_at: 'asc' }
    });
    res.json({ tracking });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const order = await prisma.orders.findFirst({ where: { id: Number(req.params.id) } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (req.user.role === 'customer' && order.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    order.items = await prisma.order_items.findMany({ where: { order_id: order.id } });
    res.json({ order });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/status', auth, staffOrAdmin, requireWritePermission('orders'), async (req, res) => {
  try {
    const { order_status, payment_status } = req.body;
    const data = { updated_at: new Date() };
    if (order_status) data.order_status = order_status;
    if (payment_status) data.payment_status = payment_status;
    if (order_status === 'delivered' || order_status === 'completed') {
      const current = await prisma.orders.findFirst({ where: { id: Number(req.params.id) }, select: { payment_method: true, payment_status: true } });
      if (current && current.payment_method === 'cod' && current.payment_status !== 'paid') {
        data.payment_status = 'paid';
      }
    }
    // Restore stock when cancelling
    if (order_status === 'cancelled') {
      const current = await prisma.orders.findFirst({ where: { id: Number(req.params.id) }, select: { order_status: true } });
      if (current && current.order_status !== 'cancelled') {
        const items = await prisma.order_items.findMany({ where: { order_id: Number(req.params.id) } });
        for (const item of items) {
          await prisma.products.update({
            where: { id: item.product_id },
            data: { stock_quantity: { increment: item.quantity }, sold_count: { decrement: item.quantity } }
          });
        }
      }
    }
    if (Object.keys(data).length > 1) {
      await prisma.orders.update({
        where: { id: Number(req.params.id) },
        data
      });
    }
    if (order_status) {
      await addTracking(Number(req.params.id), order_status);
    }
    const order = await prisma.orders.findFirst({ where: { id: Number(req.params.id) } });
    if (order_status && order?.customer_email) {
      sendOrderStatusEmail(order, order.order_status, order_status);
    }
    res.json({ order });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/cancel/:orderNumber', auth, async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber.toUpperCase();
    const order = await prisma.orders.findFirst({ where: { order_number: orderNumber } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    if (order.order_status !== 'pending') return res.status(400).json({ error: 'Only pending orders can be cancelled' });
    await prisma.orders.update({
      where: { id: order.id },
      data: { order_status: 'cancelled', updated_at: new Date() }
    });
    // Restore stock
    const items = await prisma.order_items.findMany({ where: { order_id: order.id } });
    for (const item of items) {
      await prisma.products.update({
        where: { id: item.product_id },
        data: { stock_quantity: { increment: item.quantity }, sold_count: { decrement: item.quantity } }
      });
    }
    await addTracking(order.id, 'cancelled');
    const updated = await prisma.orders.findFirst({ where: { id: order.id } });
    if (updated?.customer_email) sendOrderStatusEmail(updated, order.order_status, 'cancelled');
    res.json({ order: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/shipping/:orderNumber', auth, async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber.toUpperCase();
    const order = await prisma.orders.findFirst({ where: { order_number: orderNumber } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    if (order.order_status !== 'pending') return res.status(400).json({ error: 'Only pending orders can be updated' });
    const { customer_name, customer_phone, customer_whatsapp, shipping_address, shipping_city, shipping_state, shipping_pincode } = req.body;
    if (!shipping_address || !shipping_city || !shipping_state || !shipping_pincode) return res.status(400).json({ error: 'All address fields required' });
    const data = { updated_at: new Date() };
    if (customer_name !== undefined) data.customer_name = customer_name;
    if (customer_phone !== undefined) data.customer_phone = customer_phone;
    if (customer_whatsapp !== undefined) data.customer_whatsapp = customer_whatsapp;
    data.shipping_address = shipping_address;
    data.shipping_city = shipping_city;
    data.shipping_state = shipping_state;
    data.shipping_pincode = shipping_pincode;
    await prisma.orders.update({
      where: { id: order.id },
      data
    });
    const updated = await prisma.orders.findFirst({ where: { id: order.id } });
    res.json({ order: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
