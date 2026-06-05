import { useState } from 'react';
import { login, signup, requestReset, resetPassword } from '../lib/api';

/*
  Steps:
    'choice'       → landing (SIGN IN / CREATE ACCOUNT)
    'form'         → email+password form (login or signup)
    'reset-email'  → enter email to request OTP
    'reset-otp'    → enter OTP + new password
*/
export default function AuthPage({ onAuth }) {
  const [step, setStep]         = useState('choice');
  const [mode, setMode]         = useState('login');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [pass, setPass]         = useState('');
  const [otp, setOtp]           = useState('');
  const [revealedOtp, setRevealedOtp] = useState(''); // OTP shown to user
  const [newPass, setNewPass]   = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [busy, setBusy]         = useState(false);

  const clearMsgs = () => { setError(''); setSuccess(''); };

  const handleErr = (err) => {
    if (!err.response) {
      setError('Cannot reach the server. Make sure the backend is running.');
    } else {
      setError(err.response.data?.error || `Server error ${err.response.status}.`);
    }
  };

  /* ── Sign in / Sign up ── */
  const submit = async (e) => {
    e?.preventDefault();
    clearMsgs();
    setBusy(true);
    try {
      const data = mode === 'login'
        ? await login(email, pass)
        : await signup(email, pass, name);
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify({ email: data.email, name: data.name }));
      onAuth({ email: data.email, name: data.name });
    } catch (err) { handleErr(err); }
    finally { setBusy(false); }
  };

  /* ── Request OTP ── */
  const submitResetEmail = async (e) => {
    e?.preventDefault();
    clearMsgs();
    setBusy(true);
    try {
      const data = await requestReset(email);
      if (data.otp) {
        setRevealedOtp(data.otp);
        setOtp(data.otp);          // auto-fill the OTP field
      }
      setStep('reset-otp');
    } catch (err) { handleErr(err); }
    finally { setBusy(false); }
  };

  /* ── Verify OTP + set new password ── */
  const submitResetOtp = async (e) => {
    e?.preventDefault();
    clearMsgs();
    if (newPass !== confirm) { setError('Passwords do not match.'); return; }
    if (newPass.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    if (!/[A-Z]/.test(newPass) || !/[0-9]/.test(newPass))
      return setError('Password must contain at least one uppercase letter and one number.');
    setBusy(true);
    try {
      const data = await resetPassword(email, otp, newPass);
      setSuccess(data.message);
      setTimeout(() => {
        setStep('form'); setMode('login');
        clearMsgs(); setOtp(''); setNewPass(''); setConfirm(''); setPass('');
      }, 2000);
    } catch (err) { handleErr(err); }
    finally { setBusy(false); }
  };

  /* ── Copy helpers for UI ── */
  const HEADINGS = {
    choice:      'Sign Up / Sign In',
    form:        mode === 'login' ? 'Sign In' : 'Create Account',
    'reset-email': 'Reset Password',
    'reset-otp':   'Enter Reset Code',
  };
  const DESCS = {
    choice:      'Continue with your email address to create an account or sign in.',
    form:        mode === 'login'
      ? 'Enter your email and password to access your dashboard.'
      : 'Set up your Leadvault account.',
    'reset-email': 'Enter your email address and we\'ll generate a reset code in the server logs.',
    'reset-otp':   'Your reset code is shown below. Enter your new password to continue.',
  };

  return (
    <div style={s.bg}>
      <div style={{ ...s.blob, top: '10%',   left: '8%',   width: 520, height: 420, background: 'radial-gradient(circle, rgba(107,94,205,.55) 0%, transparent 70%)', filter: 'blur(90px)' }} />
      <div style={{ ...s.blob, bottom: '10%',right: '8%',  width: 480, height: 400, background: 'radial-gradient(circle, rgba(90,140,200,.5) 0%, transparent 70%)',  filter: 'blur(100px)'}} />
      <div style={{ ...s.blob, top: '55%',   left: '42%',  width: 360, height: 300, background: 'radial-gradient(circle, rgba(180,140,100,.35) 0%, transparent 70%)',filter: 'blur(80px)'  }} />

      <div style={s.card}>
        {/* Back / close */}
        <button style={s.closeBtn}
          onClick={step !== 'choice' ? () => { setStep('choice'); clearMsgs(); } : undefined}>
          {step !== 'choice' ? '←' : '×'}
        </button>

        {/* Body */}
        <div style={s.body}>
          <img src="/logo-icon.png" alt="Leadvault" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', marginBottom: 20, display: 'block' }} />
          <h1 style={s.heading}>{HEADINGS[step]}</h1>
          <p style={s.desc}>{DESCS[step]}</p>

          {/* ── Sign in / Sign up form ── */}
          {step === 'form' && (
            <form onSubmit={submit} style={s.form}>
              {mode === 'signup' && (
                <input style={s.input} type="text" placeholder="Your name"
                  value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
              )}
              <input style={s.input} type="email" placeholder="Email address" required
                value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              <input style={s.input} type="password"
                placeholder={mode === 'login' ? 'Password' : 'Min. 8 chars, 1 uppercase, 1 number'}
                required value={pass} onChange={e => setPass(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              {error   && <p style={s.error}>{error}</p>}
              {success && <p style={s.ok}>{success}</p>}
            </form>
          )}

          {/* ── Request OTP: enter email ── */}
          {step === 'reset-email' && (
            <form onSubmit={submitResetEmail} style={s.form}>
              <input style={s.input} type="email" placeholder="Your account email" required
                value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              {error   && <p style={s.error}>{error}</p>}
              {success && (
                <div style={s.infoBox}>
                  <strong>Code generated ✓</strong>
                  <p style={{ marginTop: 6, fontSize: 12 }}>
                    Find your 6-digit code in:<br />
                    • <strong>Vercel</strong>: Dashboard → Functions → Logs<br />
                    • <strong>Local</strong>: backend terminal output
                  </p>
                </div>
              )}
            </form>
          )}

          {/* ── Enter OTP + new password ── */}
          {step === 'reset-otp' && (
            <form onSubmit={submitResetOtp} style={s.form}>
              {revealedOtp && (
                <div style={s.otpBox}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', marginBottom: 6, opacity: .7 }}>YOUR RESET CODE</div>
                  <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '0.25em', color: '#0a0a0a' }}>{revealedOtp}</div>
                  <div style={{ fontSize: 11, opacity: .55, marginTop: 4 }}>Valid for 15 minutes — auto-filled below</div>
                </div>
              )}
              <input style={{ ...s.input, letterSpacing: '0.3em', textAlign: 'center', fontSize: 20 }}
                type="text" inputMode="numeric" placeholder="_ _ _ _ _ _"
                maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                autoComplete="one-time-code" />
              <input style={s.input} type="password" required
                placeholder="New password — min. 8 chars, 1 uppercase, 1 number"
                value={newPass} onChange={e => setNewPass(e.target.value)} autoComplete="new-password" />
              <input style={s.input} type="password" required
                placeholder="Confirm new password"
                value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
              {error   && <p style={s.error}>{error}</p>}
              {success && <p style={s.ok}>{success}</p>}
            </form>
          )}
        </div>

        {/* ── Footer CTAs ── */}
        <div style={s.footer}>
          {/* Choice */}
          {step === 'choice' && (
            <div style={s.btnRow}>
              <button style={{ ...s.btnDark, flex: 1 }}
                onClick={() => { setMode('login'); setStep('form'); clearMsgs(); }}>
                SIGN IN →
              </button>
              <button style={{ ...s.btnOutline, flex: 1 }}
                onClick={() => { setMode('signup'); setStep('form'); clearMsgs(); }}>
                CREATE ACCOUNT →
              </button>
            </div>
          )}

          {/* Sign in / Sign up */}
          {step === 'form' && (<>
            <div style={s.btnRow}>
              <button style={{ ...s.btnDark, flex: 1, opacity: busy ? .6 : 1 }}
                onClick={submit} disabled={busy}>
                {busy ? '…' : mode === 'login' ? 'SIGN IN →' : 'CREATE ACCOUNT →'}
              </button>
            </div>
            <div style={s.linkRow}>
              {mode === 'login' && (
                <button style={s.linkBtn}
                  onClick={() => { setStep('reset-email'); clearMsgs(); }}>
                  FORGOT PASSWORD? →
                </button>
              )}
              <button style={s.linkBtn}
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); clearMsgs(); }}>
                {mode === 'login' ? 'NO ACCOUNT? SIGN UP →' : 'ALREADY HAVE AN ACCOUNT? SIGN IN →'}
              </button>
            </div>
          </>)}

          {/* Request OTP */}
          {step === 'reset-email' && (<>
            <div style={s.btnRow}>
              <button style={{ ...s.btnDark, flex: 1, opacity: busy ? .6 : 1 }}
                onClick={submitResetEmail} disabled={busy}>
                {busy ? '…' : 'SEND RESET CODE →'}
              </button>
            </div>
            <button style={s.linkBtn}
              onClick={() => { setStep('reset-otp'); clearMsgs(); }}>
              ALREADY HAVE A CODE? →
            </button>
          </>)}

          {/* Verify OTP */}
          {step === 'reset-otp' && (<>
            <div style={s.btnRow}>
              <button style={{ ...s.btnDark, flex: 1, opacity: busy ? .6 : 1 }}
                onClick={submitResetOtp} disabled={busy}>
                {busy ? '…' : 'RESET PASSWORD →'}
              </button>
            </div>
            <button style={s.linkBtn}
              onClick={() => { setStep('reset-email'); clearMsgs(); }}>
              REQUEST NEW CODE →
            </button>
          </>)}
        </div>
      </div>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────────── */
const s = {
  bg: {
    position: 'fixed', inset: 0, background: '#16181f',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden',
  },
  blob: { position: 'absolute', borderRadius: '50%', pointerEvents: 'none' },
  card: {
    position: 'relative', zIndex: 1, background: '#F0EBE4',
    borderRadius: 6, width: 620, minHeight: 520,
    display: 'flex', flexDirection: 'column',
    padding: '48px 52px 40px',
    boxShadow: '0 24px 80px rgba(0,0,0,.45)',
  },
  closeBtn: {
    position: 'absolute', top: 20, right: 20,
    background: 'none', border: 'none', fontSize: 22, color: '#0a0a0a',
    cursor: 'pointer', lineHeight: 1, padding: '4px 8px',
    borderRadius: 4, fontFamily: 'inherit', opacity: .6,
  },
  body:    { flex: 1 },
  heading: { fontSize: 42, fontWeight: 400, color: '#0a0a0a', letterSpacing: '-.02em', lineHeight: 1.1, marginBottom: 16, marginTop: 8 },
  desc:    { fontSize: 15, color: '#3a3a3a', lineHeight: 1.55, maxWidth: 380, marginBottom: 28 },
  form:    { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 },
  input: {
    fontSize: 14, border: '1px solid rgba(0,0,0,.18)',
    borderRadius: 10, padding: '12px 16px',
    background: 'rgba(255,255,255,.7)', color: '#0a0a0a',
    outline: 'none', fontFamily: 'inherit',
  },
  error: {
    fontSize: 12, color: '#9B1C1C',
    background: 'rgba(254,226,226,.8)', border: '1px solid rgba(252,165,165,.6)',
    borderRadius: 8, padding: '9px 14px', margin: 0,
  },
  ok: {
    fontSize: 12, color: '#166534',
    background: 'rgba(220,252,231,.8)', border: '1px solid rgba(134,239,172,.6)',
    borderRadius: 8, padding: '9px 14px', margin: 0,
  },
  otpBox: {
    background: 'rgba(255,255,255,.85)',
    border: '1.5px solid rgba(0,0,0,.15)',
    borderRadius: 12,
    padding: '16px 20px',
    textAlign: 'center',
  },
  infoBox: {
    fontSize: 13, color: '#1e3a5f',
    background: 'rgba(219,234,254,.8)', border: '1px solid rgba(147,197,253,.6)',
    borderRadius: 8, padding: '12px 14px', lineHeight: 1.5,
  },
  footer:  { marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 },
  btnRow:  { display: 'flex', gap: 14 },
  linkRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  btnDark: {
    padding: '17px 28px', background: '#0a0a0a', color: '#fff',
    border: 'none', borderRadius: 9999,
    fontSize: 12, fontWeight: 600, letterSpacing: '.06em',
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    transition: 'opacity .15s',
  },
  btnOutline: {
    padding: '17px 28px', background: 'transparent', color: '#0a0a0a',
    border: '1.5px solid #0a0a0a', borderRadius: 9999,
    fontSize: 12, fontWeight: 600, letterSpacing: '.06em',
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  linkBtn: {
    background: 'none', border: 'none', padding: 0,
    fontSize: 11, fontWeight: 600, letterSpacing: '.06em',
    color: '#0a0a0a', cursor: 'pointer', textDecoration: 'underline',
    textUnderlineOffset: 3, fontFamily: 'inherit', textAlign: 'left', opacity: .7,
  },
};
