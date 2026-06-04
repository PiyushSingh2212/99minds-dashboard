require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const mongoose = require('mongoose');
const authJwt  = require('./middleware/authJwt');

const app = express();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// ── Public routes (no auth needed) ───────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date() }));

// ── Protected routes (JWT or x-api-key required) ─────────────────
app.use(authJwt);
app.use('/api/leads',       require('./routes/leads'));
app.use('/api/connections', require('./routes/connections'));
app.use('/api/automation',  require('./routes/automation'));
app.use('/api/stats',       require('./routes/stats'));

// MongoDB connect + start
const PORT = process.env.PORT || 3001;
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;
