const router = require('express').Router();
const Lead = require('../models/Lead');
const { Connection, AutomationRun, Activity } = require('../models/Connection');

// GET /api/stats — dashboard summary
router.get('/', async (req, res) => {
  try {
    const [
      totalLeads,
      highFitLeads,
      matchesIcpCount,
      avgScoreAgg,
      uniqueCompaniesAgg,
      lastImport,
      totalConnections,
      recentRuns,
      recentActivity,
      scoreDistAgg,
      industryAgg,
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ icpScore: { $gte: 7 } }),
      Lead.countDocuments({ matchesIcp: 'YES' }),
      Lead.aggregate([{ $group: { _id: null, avg: { $avg: '$icpScore' } } }]),
      Lead.aggregate([{ $group: { _id: '$companyName' } }, { $count: 'total' }]),
      Lead.findOne().sort('-importedAt').select('importedAt').lean(),
      Connection.countDocuments(),
      AutomationRun.find().sort('-triggeredAt').limit(5).lean(),
      Activity.find().sort('-createdAt').limit(10).lean(),
      Lead.aggregate([
        { $group: { _id: '$icpScore', count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ]),
      Lead.aggregate([
        { $group: { _id: '$industryTag', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
    ]);

    res.json({
      leads: {
        total: totalLeads,
        highFit: highFitLeads,
        matchesIcp: matchesIcpCount,
        avgScore: avgScoreAgg[0]?.avg ? +avgScoreAgg[0].avg.toFixed(1) : 0,
        uniqueCompanies: uniqueCompaniesAgg[0]?.total || 0,
        lastImportAt: lastImport?.importedAt || null,
        scoreDistribution: scoreDistAgg,
        industryBreakdown: industryAgg,
      },
      connections: {
        total: totalConnections,
      },
      automation: {
        recentRuns,
        lastRunAt: recentRuns[0]?.triggeredAt || null,
        lastRunStatus: recentRuns[0]?.status || null,
      },
      recentActivity,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
