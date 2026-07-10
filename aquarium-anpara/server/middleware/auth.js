const jwt = require('jsonwebtoken');
const prisma = require('../database');

const TOKEN_SECRET = process.env.JWT_SECRET || 'aquarium-anpara-fallback-secret-key-2026';
if (!process.env.JWT_SECRET) console.warn('⚠️  JWT_SECRET not set, using fallback');

function extractToken(req) {
  return req.header('Authorization')?.replace('Bearer ', '') || (req.cookies && req.cookies.token);
}

const auth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Access denied' });
    const decoded = jwt.verify(token, TOKEN_SECRET);
    const user = await prisma.users.findFirst({
      where: { id: decoded.id, is_active: 1 },
      select: { id: true, name: true, email: true, phone: true, role: true, avatar: true, is_active: true, auth_provider: true }
    });
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    req.user = user;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      const decoded = jwt.verify(token, TOKEN_SECRET);
      const user = await prisma.users.findFirst({
        where: { id: decoded.id, is_active: 1 },
        select: { id: true, name: true, email: true, phone: true, role: true, avatar: true, is_active: true, auth_provider: true }
      });
      if (user) req.user = user;
    }
  } catch (e) {}
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

const requireAdminPage = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
    const decoded = jwt.verify(token, TOKEN_SECRET);
    const user = await prisma.users.findFirst({
      where: { id: decoded.id, is_active: 1 },
      select: { id: true, name: true, email: true, phone: true, role: true, avatar: true, is_active: true }
    });
    if (!user) return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
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
