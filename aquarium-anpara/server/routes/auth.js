const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../database');
const { auth, generateToken } = require('../middleware/auth');

const CAPTCHA_SECRET = process.env.CAPTCHA_SECRET || 'aquarium-captcha-salt-2026';
function generateCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const answer = a + b;
  const token = crypto.createHmac('sha256', CAPTCHA_SECRET).update(String(answer)).digest('hex').substring(0, 8);
  return { question: `${a} + ${b} = ?`, token };
}
function verifyCaptcha(answer, token) {
  const expected = crypto.createHmac('sha256', CAPTCHA_SECRET).update(String(answer)).digest('hex').substring(0, 8);
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

router.get('/captcha', (req, res) => {
  res.json(generateCaptcha());
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, captcha_answer, captcha_token } = req.body;
    if (!name || !password || (!email && !phone)) return res.status(400).json({ error: 'Name, password and email or phone required' });
    if (!captcha_answer || !captcha_token || !verifyCaptcha(Number(captcha_answer), captcha_token)) {
      return res.status(400).json({ error: 'Invalid captcha answer' });
    }

    const existing = email
      ? await prisma.users.findUnique({ where: { email }, select: { id: true } })
      : await prisma.users.findUnique({ where: { phone }, select: { id: true } });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const hash = bcrypt.hashSync(password, 10);
    const result = await prisma.users.create({
      data: { name, email: email || null, phone: phone || null, password: hash }
    });

    await prisma.users.update({
      where: { id: result.id },
      data: { token_version: { increment: 1 } }
    });

    const user = await prisma.users.findUnique({
      where: { id: result.id },
      select: { id: true, name: true, email: true, phone: true, role: true, token_version: true }
    });
    const token = generateToken(user);

    await prisma.customers.create({
      data: { user_id: user.id, name, email: email || null, phone: phone || null }
    });

    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ token, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Login and password required' });

    const user = await prisma.users.findFirst({
      where: { OR: [{ email: login }, { phone: login }] }
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_active) return res.status(401).json({ error: 'Account disabled' });

    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });

    await prisma.users.update({
      where: { id: user.id },
      data: { token_version: { increment: 1 } }
    });

    const updatedUser = await prisma.users.findUnique({ where: { id: user.id } });
    const token = generateToken(updatedUser);
    const { password: _, ...safeUser } = updatedUser;
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ token, user: safeUser });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const addr = await prisma.addresses.findFirst({
      where: { user_id: req.user.id, is_primary: 1 },
      select: { id: true, label: true, name: true, phone: true, address: true, city: true, state: true, pincode: true, is_primary: true }
    });
    res.json({ user: { ...req.user, primary_address: addr || null } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email, phone, avatar, address, city, state, pincode, whatsapp } = req.body;

    const userData = {};
    if (name !== undefined) userData.name = name;
    if (email !== undefined) userData.email = email;
    if (phone !== undefined) userData.phone = phone;
    if (avatar !== undefined) userData.avatar = avatar;
    userData.updated_at = new Date();
    await prisma.users.update({ where: { id: req.user.id }, data: userData });

    const customerData = {};
    if (name !== undefined) customerData.name = name;
    if (email !== undefined) customerData.email = email;
    if (phone !== undefined) customerData.phone = phone;
    if (whatsapp !== undefined) customerData.whatsapp = whatsapp;
    if (address !== undefined) customerData.address = address;
    if (city !== undefined) customerData.city = city;
    if (state !== undefined) customerData.state = state;
    if (pincode !== undefined) customerData.pincode = pincode;
    await prisma.customers.updateMany({ where: { user_id: req.user.id }, data: customerData });

    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, phone: true, role: true, avatar: true }
    });
    const customer = await prisma.customers.findFirst({
      where: { user_id: req.user.id },
      select: { address: true, city: true, state: true, pincode: true, whatsapp: true }
    });
    res.json({ user: { ...user, ...(customer || {}) } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.users.findUnique({ where: { id: req.user.id }, select: { password: true } });
    if (!bcrypt.compareSync(currentPassword, user.password)) return res.status(400).json({ error: 'Current password incorrect' });
    const hash = bcrypt.hashSync(newPassword, 10);
    await prisma.users.update({ where: { id: req.user.id }, data: { password: hash, updated_at: new Date() } });
    res.json({ message: 'Password updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Google credential required' });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId, picture } = payload;

    let user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      const result = await prisma.users.create({
        data: { name, email, password: null, auth_provider: 'google', avatar: picture || null }
      });
      user = await prisma.users.findUnique({ where: { id: result.id } });
      await prisma.customers.create({ data: { user_id: user.id, name, email } });
    } else if (user.auth_provider !== 'google') {
      const updateData = { auth_provider: 'google' };
      if (picture) updateData.avatar = picture;
      await prisma.users.update({ where: { id: user.id }, data: updateData });
    }

    if (!user.is_active) return res.status(401).json({ error: 'Account disabled' });

    await prisma.users.update({
      where: { id: user.id },
      data: { token_version: { increment: 1 } }
    });

    const updatedUser = await prisma.users.findUnique({ where: { id: user.id } });
    const token = generateToken(updatedUser);
    const { password: _, ...safeUser } = updatedUser;
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ token, user: safeUser });
  } catch (e) {
    res.status(500).json({ error: 'Google authentication failed: ' + e.message });
  }
});

module.exports = router;
