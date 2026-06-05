const express    = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const rateLimit  = require('express-rate-limit');
const crypto     = require('crypto');
const User       = require('../models/User');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production-please';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS   = 15 * 60 * 1000; // 15 minutes
const OTP_EXPIRY_MS      = 15 * 60 * 1000; // 15 minutes

/* ── Rate limiter: max 10 auth requests / 15 min per IP ─────────── */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts from this IP. Please try again after 15 minutes.' },
});
router.use(authLimiter);

/* ── Helpers ────────────────────────────────────────────────────── */
function makeToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function generateOtp() {
  // Cryptographically random 6-digit code
  return String(crypto.randomInt(100000, 999999));
}

/* ── POST /api/auth/signup ──────────────────────────────────────── */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password))
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter and one number.' });

    if (await User.findOne({ email }))
      return res.status(409).json({ error: 'An account with this email already exists.' });

    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, password: hash, name: name || '' });

    res.status(201).json({ token: makeToken(user), email: user.email, name: user.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/auth/login ───────────────────────────────────────── */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ error: 'Invalid email or password.' });

    // Check lockout
    if (user.isLocked) {
      const remainingMs = user.lockUntil - Date.now();
      const mins = Math.ceil(remainingMs / 60000);
      return res.status(423).json({
        error: `Account locked due to too many failed attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`,
      });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      // Increment failed attempts
      const attempts = (user.loginAttempts || 0) + 1;
      const update = { loginAttempts: attempts };
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        update.lockUntil      = new Date(Date.now() + LOCK_DURATION_MS);
        update.loginAttempts  = 0;
      }
      await User.updateOne({ _id: user._id }, update);

      const remaining = MAX_LOGIN_ATTEMPTS - attempts;
      if (remaining > 0) {
        return res.status(401).json({
          error: `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`,
        });
      }
      return res.status(401).json({ error: 'Invalid email or password. Account locked for 15 minutes.' });
    }

    // Success — reset attempt counter
    await User.updateOne({ _id: user._id }, { loginAttempts: 0, lockUntil: null });
    res.json({ token: makeToken(user), email: user.email, name: user.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/auth/request-reset ──────────────────────────────── */
router.post('/request-reset', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ error: 'Email is required.' });

    const user = await User.findOne({ email });

    // Always respond the same way to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If an account exists, a reset code has been generated.' });
    }

    const otp  = generateOtp();
    const hash = await bcrypt.hash(otp, 10);

    await User.updateOne({ _id: user._id }, {
      resetOtp:       hash,
      resetOtpExpiry: new Date(Date.now() + OTP_EXPIRY_MS),
    });

    console.log(`[RESET OTP] ${email} → ${otp}`);

    // Return OTP directly — personal dashboard, single-user, HTTPS-only
    res.json({
      message: 'Reset code generated. Copy it below — expires in 15 minutes.',
      otp,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/auth/reset-password ─────────────────────────────── */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ error: 'Email, reset code, and new password are required.' });
    if (newPassword.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword))
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter and one number.' });

    const user = await User.findOne({ email });
    if (!user || !user.resetOtp || !user.resetOtpExpiry)
      return res.status(400).json({ error: 'No active reset code found. Please request a new one.' });

    if (user.resetOtpExpiry < new Date())
      return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });

    const validOtp = await bcrypt.compare(String(otp), user.resetOtp);
    if (!validOtp)
      return res.status(400).json({ error: 'Invalid reset code.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await User.updateOne({ _id: user._id }, {
      password:       hash,
      resetOtp:       null,
      resetOtpExpiry: null,
      loginAttempts:  0,
      lockUntil:      null,
    });

    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /api/auth/me ───────────────────────────────────────────── */
router.get('/me', require('../middleware/authJwt'), (req, res) => {
  res.json({ email: req.user.email, name: req.user.name });
});

module.exports = router;
