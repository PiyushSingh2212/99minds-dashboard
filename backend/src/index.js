require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const mongoose = require('mongoose');
const authJwt  = require('./middleware/authJwt');

const app = express();

app.use(cors({
  origin: (origin, cb) => {
    // Allow: no origin (curl/mobile), chrome extensions, configured frontend
    if (!origin || origin.startsWith('chrome-extension://') || origin === process.env.FRONTEND_URL) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// ── Serverless DB: connect before every request on Vercel ─────────
if (process.env.VERCEL === '1') {
  let connected = false;
  app.use(async (req, res, next) => {
    if (!connected && mongoose.connection.readyState !== 1) {
      try {
        await mongoose.connect(process.env.MONGODB_URI);
        connected = true;
      } catch (err) {
        console.error('DB connect error:', err.message);
        return res.status(503).json({ error: 'Database unavailable' });
      }
    }
    next();
  });
}

// ── Public routes ─────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/extension', require('./routes/extension'));
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date() }));

// ── Protected routes ──────────────────────────────────────────────
app.use(authJwt);
app.use('/api/leads',       require('./routes/leads'));
app.use('/api/ai',          require('./routes/ai'));
app.use('/api/connections', require('./routes/connections'));
app.use('/api/automation',  require('./routes/automation'));
app.use('/api/stats',       require('./routes/stats'));

// ── Local dev: eager connect + HTTP server ────────────────────────
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3001;
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('MongoDB connected');
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => { console.error('MongoDB error:', err); process.exit(1); });
}

module.exports = app;
