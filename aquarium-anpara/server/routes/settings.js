const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly } = require('../middleware/auth');

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

router.put('/', auth, adminOnly, async (req, res) => {
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
