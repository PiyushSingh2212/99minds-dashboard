const mongoose = require('mongoose');

const ConnectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    title: String,
    company: String,
    linkedinUrl: String,
    connectedOn: Date,
    location: String,
    status: {
      type: String,
      enum: ['new', 'contacted', 'replied', 'meeting', 'closed', 'nurture'],
      default: 'new',
    },
    notes: String,
    tags: [String],
    lastActivity: Date,
  },
  { timestamps: true }
);

const AutomationRunSchema = new mongoose.Schema(
  {
    triggeredAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['success', 'failed', 'running'], default: 'running' },
    blogsPublished: { type: Number, default: 0 },
    keywordsResearched: { type: Number, default: 0 },
    leadsEnriched: { type: Number, default: 0 },
    errors: [String],
    duration: Number, // ms
    notes: String,
  },
  { timestamps: true }
);

const ActivitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['lead_imported', 'connection_added', 'automation_run', 'blog_published', 'manual'],
    },
    description: String,
    meta: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now },
  }
);

module.exports = {
  Connection: mongoose.model('Connection', ConnectionSchema),
  AutomationRun: mongoose.model('AutomationRun', AutomationRunSchema),
  Activity: mongoose.model('Activity', ActivitySchema),
};
