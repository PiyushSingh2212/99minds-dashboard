const router = require('express').Router();
const Lead = require('../models/Lead');
const auth = require('../middleware/auth');
const { Activity } = require('../models/Connection');

// GET /api/leads — paginated + filtered
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      minScore,
      maxScore,
      matchesIcp,
      industry,
      contacted,
      sort = '-importedAt',
    } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { fullName: new RegExp(search, 'i') },
        { companyName: new RegExp(search, 'i') },
        { currentJob: new RegExp(search, 'i') },
      ];
    }
    if (minScore || maxScore) {
      query.icpScore = {};
      if (minScore) query.icpScore.$gte = Number(minScore);
      if (maxScore) query.icpScore.$lte = Number(maxScore);
    }
    if (matchesIcp) query.matchesIcp = matchesIcp;
    if (industry) query.industryTag = new RegExp(industry, 'i');
    if (contacted !== undefined) query.contacted = contacted === 'true';

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Lead.countDocuments(query),
    ]);

    res.json({ leads, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/import — bulk upsert from Chrome extension CSV
router.post('/import', auth, async (req, res) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'leads array required' });
    }

    let inserted = 0;
    let updated = 0;
    const errors = [];

    for (const lead of leads) {
      try {
        const result = await Lead.findOneAndUpdate(
          { fullName: lead.fullName, companyName: lead.companyName },
          { $set: lead },
          { upsert: true, new: true }
        );
        if (result.createdAt === result.updatedAt) inserted++;
        else updated++;
      } catch (e) {
        errors.push(`${lead.fullName}: ${e.message}`);
      }
    }

    // Log activity
    await Activity.create({
      type: 'lead_imported',
      description: `Imported ${inserted} new leads, updated ${updated}`,
      meta: { inserted, updated, total: leads.length },
    });

    res.json({ inserted, updated, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/leads/:id — update contacted, notes
router.patch('/:id', auth, async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads/export — CSV download
router.get('/export', async (req, res) => {
  try {
    const leads = await Lead.find().sort('-icpScore').lean();
    const cols = [
      'fullName','currentJob','companyName','emailGuess','icpScore','matchesIcp',
      'scoreReason','outreachAngle','platformGuess','industryTag','location',
      'linkedinUrl','salesNavUrl','contacted','importedAt',
    ];
    const csv = [
      cols.join(','),
      ...leads.map(l =>
        cols.map(c => `"${(l[c] ?? '').toString().replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="99minds-leads.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/leads/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Lead.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
