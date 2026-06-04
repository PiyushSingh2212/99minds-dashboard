const router = require('express').Router();
const { AutomationRun, Activity } = require('../models/Connection');
const auth = require('../middleware/auth');

// POST /api/automation/run — n8n webhook posts here after each daily run
router.post('/run', auth, async (req, res) => {
  try {
    const {
      status = 'success',
      blogsPublished = 0,
      keywordsResearched = 0,
      leadsEnriched = 0,
      errors = [],
      duration,
      notes,
    } = req.body;

    const run = await AutomationRun.create({
      status,
      blogsPublished,
      keywordsResearched,
      leadsEnriched,
      errors,
      duration,
      notes,
    });

    await Activity.create({
      type: 'automation_run',
      description: `Automation run: ${blogsPublished} blogs, ${keywordsResearched} keywords`,
      meta: { runId: run._id, status },
    });

    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/automation/runs — recent runs list
router.get('/runs', async (req, res) => {
  try {
    const runs = await AutomationRun.find().sort('-triggeredAt').limit(20).lean();
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
