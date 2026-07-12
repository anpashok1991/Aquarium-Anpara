const prisma = require('./database');

async function getSmtpSettings() {
  const rows = await prisma.settings.findMany({
    where: { key: { in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'shop_email', 'shop_name'] } }
  });
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  return s;
}

async function sendOrderEmail(to, subject, html) {
  try {
    const cfg = await getSmtpSettings();
    if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass) {
      console.log('SMTP not configured, skipping email to', to);
      return;
    }
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: parseInt(cfg.smtp_port || '587'),
      secure: cfg.smtp_port === '465',
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass }
    });
    await transporter.sendMail({
      from: `"${cfg.shop_name || 'Aquarium Anpara'}" <${cfg.smtp_user}>`,
      to,
      subject,
      html
    });
    console.log('Email sent to', to);
  } catch (e) {
    console.error('Failed to send email:', e.message);
  }
}

async function sendOrderStatusEmail(order, oldStatus, newStatus) {
  if (!order.customer_email) return;
  const statusLabels = {
    pending: 'Order Placed',
    confirmed: 'Order Confirmed',
    processing: 'Processing',
    dispatched: 'Dispatched',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
  };
  const label = statusLabels[newStatus] || newStatus;
  const subject = `Order #${order.order_number} - ${label}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#0d6efd">${label}</h2>
      <p>Dear ${order.customer_name},</p>
      <p>Your order <strong>#${order.order_number}</strong> has been updated to: <strong>${label}</strong></p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Order</strong></td><td style="padding:8px;border:1px solid #ddd">#${order.order_number}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Status</strong></td><td style="padding:8px;border:1px solid #ddd">${label}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Total</strong></td><td style="padding:8px;border:1px solid #ddd">₹${Number(order.total).toLocaleString()}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Payment</strong></td><td style="padding:8px;border:1px solid #ddd">${order.payment_method?.toUpperCase()} (${order.payment_status})</td></tr>
      </table>
      <p><a href="${process.env.BASE_URL || 'http://localhost:3000'}/orders/${order.order_number}" style="background:#0d6efd;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">View Order</a></p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#888;font-size:12px">Thank you for shopping with us!</p>
    </div>`;
  await sendOrderEmail(order.customer_email, subject, html);
}

module.exports = { sendOrderEmail, sendOrderStatusEmail };