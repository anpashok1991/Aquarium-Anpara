const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, async (req, res) => {
  try {
    if (!req.user) return res.json({ addresses: [] });
    const addresses = await prisma.addresses.findMany({
      where: { user_id: req.user.id },
      orderBy: [{ is_primary: 'desc' }, { created_at: 'desc' }]
    });
    res.json({ addresses });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { label, name, phone, address, city, state, pincode } = req.body;
    if (!name || !phone || !address || !city || !state || !pincode) return res.status(400).json({ error: 'All address fields required' });
    const existing = await prisma.addresses.count({ where: { user_id: req.user.id } });
    const result = await prisma.addresses.create({
      data: {
        user_id: req.user.id,
        label: label || 'Home',
        name,
        phone,
        address,
        city,
        state,
        pincode,
        is_primary: existing === 0 ? 1 : 0
      }
    });
    const addr = await prisma.addresses.findUnique({ where: { id: result.id } });
    res.status(201).json({ address: addr });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const paramId = Number(req.params.id);
    const addr = await prisma.addresses.findFirst({ where: { id: paramId, user_id: req.user.id } });
    if (!addr) return res.status(404).json({ error: 'Address not found' });
    const { label, name, phone, address, city, state, pincode } = req.body;
    const data = {};
    if (label !== undefined) data.label = label;
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;
    if (city !== undefined) data.city = city;
    if (state !== undefined) data.state = state;
    if (pincode !== undefined) data.pincode = pincode;
    await prisma.addresses.update({ where: { id: paramId }, data });
    res.json({ address: await prisma.addresses.findUnique({ where: { id: paramId } }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/primary', auth, async (req, res) => {
  try {
    const paramId = Number(req.params.id);
    const addr = await prisma.addresses.findFirst({ where: { id: paramId, user_id: req.user.id } });
    if (!addr) return res.status(404).json({ error: 'Address not found' });
    await prisma.addresses.updateMany({ where: { user_id: req.user.id }, data: { is_primary: 0 } });
    await prisma.addresses.update({ where: { id: paramId }, data: { is_primary: 1 } });
    res.json({ address: await prisma.addresses.findUnique({ where: { id: paramId } }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const paramId = Number(req.params.id);
    const addr = await prisma.addresses.findFirst({ where: { id: paramId, user_id: req.user.id } });
    if (!addr) return res.status(404).json({ error: 'Address not found' });
    await prisma.addresses.delete({ where: { id: paramId } });
    if (addr.is_primary) {
      const next = await prisma.addresses.findFirst({
        where: { user_id: req.user.id },
        orderBy: { created_at: 'desc' }
      });
      if (next) await prisma.addresses.update({ where: { id: next.id }, data: { is_primary: 1 } });
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
