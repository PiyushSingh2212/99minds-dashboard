const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:       { type: String, required: true },
  name:           { type: String, trim: true },

  /* ── Reset password (OTP) ── */
  resetOtp:       { type: String },          // bcrypt hash of the 6-digit OTP
  resetOtpExpiry: { type: Date },            // OTP valid for 15 minutes

  /* ── Login brute-force protection ── */
  loginAttempts:  { type: Number, default: 0 },
  lockUntil:      { type: Date },            // account locked until this time
}, { timestamps: true });

/* Helper: is the account currently locked? */
UserSchema.virtual('isLocked').get(function () {
  return this.lockUntil && this.lockUntil > Date.now();
});

module.exports = mongoose.model('User', UserSchema);
