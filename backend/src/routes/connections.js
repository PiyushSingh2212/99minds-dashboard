const router = require('express').Router();
const { Connection, Activity } = require('../models/Connection');
const auth = require('../middleware/auth');

// GET /api/connections
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 25, search, status, sort = '-createdAt' } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { company: new RegExp(search, 'i') },
        { title: new RegExp(search, 'i') },
      ];
    }
    if (status) query.status = status;

    const [connections, total] = await Promise.all([
      Connection.find(query).sort(sort).skip((page - 1) * limit).limit(Number(limit)).lean(),
      Connection.countDocuments(query),
    ]);
    res.json({ connections, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/connections/bulk — import from LinkedIn CSV export
router.post('/bulk', auth, async (req, res) => {
  try {
    const { connections } = req.body;
    if (!Array.isArray(connections) || connections.length === 0) {
      return res.status(400).json({ error: 'connections array required' });
    }
    let inserted = 0;
    for (const c of connections) {
      try {
        await Connection.findOneAndUpdate(
          { linkedinUrl: c.linkedinUrl },
          { $setOnInsert: c },
          { upsert: true }
        );
        inserted++;
      } catch (_) {}
    }
    await Activity.create({
      type: 'connection_added',
      description: `Added ${inserted} connections`,
      meta: { inserted },
    });
    res.json({ inserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/connections/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const conn = await Connection.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!conn) return res.status(404).json({ error: 'Not found' });
    res.json(conn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/connections/activity — recent activity feed
router.get('/activity', async (req, res) => {
  try {
    const items = await Activity.find().sort('-createdAt').limit(30).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
