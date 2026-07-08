const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const db = require('../database');
const { auth, generateToken } = require('../middleware/auth');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

router.post('/register', (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !password || (!email && !phone)) return res.status(400).json({ error: 'Name, password and email or phone required' });
    
    const existing = email ? db.prepare('SELECT id FROM users WHERE email = ?').get(email) : db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existing) return res.status(400).json({ error: 'User already exists' });
    
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)').run(name, email || null, phone || null, hash);
    
    const user = db.prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken(user);
    
    db.prepare('INSERT INTO customers (user_id, name, email, phone) VALUES (?, ?, ?, ?)').run(user.id, name, email || null, phone || null);
    
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ token, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Login and password required' });
    
    const user = db.prepare('SELECT * FROM users WHERE email = ? OR phone = ?').get(login, login);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_active) return res.status(401).json({ error: 'Account disabled' });
    
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = generateToken(user);
    const { password: _, ...safeUser } = user;
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ token, user: safeUser });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

router.put('/profile', auth, (req, res) => {
  try {
    const { name, email, phone, avatar } = req.body;
    db.prepare('UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone), avatar = COALESCE(?, avatar), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(name, email, phone, avatar, req.user.id);
    const user = db.prepare('SELECT id, name, email, phone, role, avatar FROM users WHERE id = ?').get(req.user.id);
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/change-password', auth, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(currentPassword, user.password)) return res.status(400).json({ error: 'Current password incorrect' });
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, req.user.id);
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

    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      const result = db.prepare('INSERT INTO users (name, email, password, auth_provider, avatar) VALUES (?, ?, NULL, ?, ?)').run(name, email, 'google', picture || null);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      db.prepare('INSERT INTO customers (user_id, name, email) VALUES (?, ?, ?)').run(user.id, name, email);
    } else if (user.auth_provider !== 'google') {
      db.prepare('UPDATE users SET auth_provider = ?, avatar = COALESCE(?, avatar) WHERE id = ?').run('google', picture, user.id);
    }

    if (!user.is_active) return res.status(401).json({ error: 'Account disabled' });

    const token = generateToken(user);
    const { password: _, ...safeUser } = user;
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ token, user: safeUser });
  } catch (e) {
    res.status(500).json({ error: 'Google authentication failed: ' + e.message });
  }
});

module.exports = router;
