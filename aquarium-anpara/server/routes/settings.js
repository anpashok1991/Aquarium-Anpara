const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly, staffOrAdmin, requireWritePermission } = require('../middleware/auth');
const { sendOrderEmail } = require('../email');

router.get('/', async (req, res) => {
  try {
    const rows = await prisma.settings.findMany();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ settings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:key', async (req, res) => {
  try {
    const setting = await prisma.settings.findUnique({ where: { key: req.params.key } });
    res.json({ setting });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/test-email', auth, adminOnly, async (req, res) => {
  try {
    const { email, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass } = req.body;
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: parseInt(smtp_port || '587'),
      secure: smtp_secure === 'true',
      auth: { user: smtp_user, pass: smtp_pass }
    });
    await transporter.sendMail({
      from: `"Aquarium Anpara" <${smtp_user}>`,
      to: email,
      subject: 'Test Email from Aquarium Anpara',
      html: '<h2>Email settings are working!</h2><p>This is a test email from your Aquarium Anpara store.</p>'
    });
    res.json({ message: 'Test email sent' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', auth, staffOrAdmin, requireWritePermission('settings'), async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await prisma.settings.upsert({
        where: { key },
        update: { value: typeof value === 'object' ? JSON.stringify(value) : String(value) },
        create: { key, value: typeof value === 'object' ? JSON.stringify(value) : String(value) }
      });
    }
    res.json({ message: 'Settings updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
