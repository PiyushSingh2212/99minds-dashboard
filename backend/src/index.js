require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const mongoose = require('mongoose');
const authJwt  = require('./middleware/authJwt');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// ── Public routes ─────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date() }));

// ── Protected routes ──────────────────────────────────────────────
app.use(authJwt);
app.use('/api/leads',       require('./routes/leads'));
app.use('/api/connections', require('./routes/connections'));
app.use('/api/automation',  require('./routes/automation'));
app.use('/api/stats',       require('./routes/stats'));

// ── DB connection ─────────────────────────────────────────────────
// Vercel serverless: connect lazily on first request, never exit
let dbReady = false;

async function ensureDB() {
  if (dbReady || mongoose.connection.readyState === 1) { dbReady = true; return; }
  await mongoose.connect(process.env.MONGODB_URI);
  dbReady = true;
}

// In local dev, connect eagerly and start the HTTP server
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3001;
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('MongoDB connected');
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err);
      process.exit(1);
    });
} else {
  // Serverless: connect before each request using a middleware
  app.use(async (req, res, next) => {
    try { await ensureDB(); next(); }
    catch (err) { console.error('DB connect error:', err.message); res.status(503).json({ error: 'Database unavailable' }); }
  });
}

module.exports = app;
