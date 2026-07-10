const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, (req, res) => {
  try {
    if (!req.user) return res.json({ addresses: [] });
    const addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_primary DESC, created_at DESC').all(req.user.id);
    res.json({ addresses });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, (req, res) => {
  try {
    const { label, name, phone, address, city, state, pincode } = req.body;
    if (!name || !phone || !address || !city || !state || !pincode) return res.status(400).json({ error: 'All address fields required' });
    const existing = db.prepare('SELECT COUNT(*) as c FROM addresses WHERE user_id = ?').get(req.user.id).c;
    const result = db.prepare('INSERT INTO addresses (user_id, label, name, phone, address, city, state, pincode, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      req.user.id, label || 'Home', name, phone, address, city, state, pincode, existing === 0 ? 1 : 0
    );
    const addr = db.prepare('SELECT * FROM addresses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ address: addr });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, (req, res) => {
  try {
    const addr = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!addr) return res.status(404).json({ error: 'Address not found' });
    const { label, name, phone, address, city, state, pincode } = req.body;
    db.prepare('UPDATE addresses SET label=COALESCE(?,label), name=COALESCE(?,name), phone=COALESCE(?,phone), address=COALESCE(?,address), city=COALESCE(?,city), state=COALESCE(?,state), pincode=COALESCE(?,pincode) WHERE id=?').run(
      label, name, phone, address, city, state, pincode, req.params.id
    );
    res.json({ address: db.prepare('SELECT * FROM addresses WHERE id = ?').get(req.params.id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/primary', auth, (req, res) => {
  try {
    const addr = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!addr) return res.status(404).json({ error: 'Address not found' });
    db.prepare('UPDATE addresses SET is_primary = 0 WHERE user_id = ?').run(req.user.id);
    db.prepare('UPDATE addresses SET is_primary = 1 WHERE id = ?').run(req.params.id);
    res.json({ address: db.prepare('SELECT * FROM addresses WHERE id = ?').get(req.params.id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, (req, res) => {
  try {
    const addr = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!addr) return res.status(404).json({ error: 'Address not found' });
    db.prepare('DELETE FROM addresses WHERE id = ?').run(req.params.id);
    if (addr.is_primary) {
      const next = db.prepare('SELECT id FROM addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.user.id);
      if (next) db.prepare('UPDATE addresses SET is_primary = 1 WHERE id = ?').run(next.id);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;