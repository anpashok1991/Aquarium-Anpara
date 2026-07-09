const jwt = require('jsonwebtoken');
const db = require('../database');

const TOKEN_SECRET = process.env.JWT_SECRET || 'aquarium-anpara-fallback-secret-key-2026';
if (!process.env.JWT_SECRET) console.warn('⚠️  JWT_SECRET not set, using fallback (set it in Render env vars for production)');

function extractToken(req) {
  return req.header('Authorization')?.replace('Bearer ', '') || (req.cookies && req.cookies.token);
}

const auth = (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    const decoded = jwt.verify(token, TOKEN_SECRET);
    const user = db.prepare('SELECT id, name, email, phone, role, avatar, is_active, auth_provider FROM users WHERE id = ?').get(decoded.id);
    if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid token' });
    req.user = user;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const optionalAuth = (req, res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, TOKEN_SECRET);
      const user = db.prepare('SELECT id, name, email, phone, role, avatar, is_active, auth_provider FROM users WHERE id = ?').get(decoded.id);
      if (user && user.is_active) req.user = user;
    } catch (e) {}
  }
  next();
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

const staffOrAdmin = (req, res, next) => {
  if (!req.user || !['admin', 'staff'].includes(req.user.role)) return res.status(403).json({ error: 'Staff access required' });
  next();
};

// Server-side guard for admin/staff EJS page routes.
// Reads JWT from cookie/header, verifies admin role, otherwise redirects to /login.
const requireAdminPage = (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  try {
    const decoded = jwt.verify(token, TOKEN_SECRET);
    const user = db.prepare('SELECT id, name, email, phone, role, avatar, is_active FROM users WHERE id = ?').get(decoded.id);
    if (!user || !user.is_active) return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
    if (user.role !== 'admin' && user.role !== 'staff') return res.redirect('/');
    req.user = user;
    next();
  } catch (e) {
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
};

const generateToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, TOKEN_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
};

module.exports = { auth, optionalAuth, adminOnly, staffOrAdmin, requireAdminPage, generateToken };
