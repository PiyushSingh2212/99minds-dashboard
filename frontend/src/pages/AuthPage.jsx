import { useState } from 'react';
import { login, signup, resetPassword } from '../lib/api';

export default function AuthPage({ onAuth }) {
  const [step, setStep]       = useState('choice'); // 'choice' | 'form' | 'reset'
  const [mode, setMode]       = useState('login');  // 'login' | 'signup'
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy]       = useState(false);

  const reset = () => { setError(''); setSuccess(''); };
  const goBack = () => { setStep('choice'); reset(); };
  const goReset = () => { setStep('reset'); reset(); setEmail(''); setNewPass(''); setConfirm(''); };

  /* ── Sign in / Sign up ── */
  const submit = async (e) => {
    e?.preventDefault();
    reset();
    setBusy(true);
    try {
      const data = mode === 'login'
        ? await login(email, pass)
        : await signup(email, pass, name);
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify({ email: data.email, name: data.name }));
      onAuth({ email: data.email, name: data.name });
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the server. Make sure the backend is running on port 3001.');
      } else {
        setError(err.response.data?.error || `Server error ${err.response.status}.`);
      }
    } finally {
      setBusy(false);
    }
  };

  /* ── Reset password ── */
  const submitReset = async (e) => {
    e?.preventDefault();
    reset();
    if (newPass !== confirm) { setError('Passwords do not match.'); return; }
    if (newPass.length < 6)  { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      const data = await resetPassword(email, newPass);
      setSuccess(data.message);
      setTimeout(() => { setStep('form'); setMode('login'); reset(); setPass(''); setNewPass(''); setConfirm(''); }, 2000);
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the server.');
      } else {
        setError(err.response.data?.error || `Server error ${err.response.status}.`);
      }
    } finally {
      setBusy(false);
    }
  };

  /* ── Heading & description ── */
  const heading = step === 'choice' ? 'Sign Up / Sign In'
    : step === 'reset'              ? 'Reset Password'
    : mode === 'login'              ? 'Sign In'
    :                                 'Create Account';

  const desc = step === 'choice'
    ? 'Continue with your email address to create an account or sign in.'
    : step === 'reset'
      ? 'Enter your email and choose a new password.'
      : mode === 'login'
        ? 'Enter your email and password to access your dashboard.'
        : 'Set up your 99minds dashboard account.';

  return (
    <div style={s.bg}>
      <div style={{ ...s.blob, top: '10%', left: '8%',  width: 520, height: 420, background: 'radial-gradient(circle, rgba(107,94,205,.55) 0%, transparent 70%)', filter: 'blur(90px)' }} />
      <div style={{ ...s.blob, bottom: '10%', right: '8%', width: 480, height: 400, background: 'radial-gradient(circle, rgba(90,140,200,.5) 0%, transparent 70%)',  filter: 'blur(100px)' }} />
      <div style={{ ...s.blob, top: '55%', left: '42%',  width: 360, height: 300, background: 'radial-gradient(circle, rgba(180,140,100,.35) 0%, transparent 70%)', filter: 'blur(80px)' }} />

      <div style={s.card}>
        {/* Back / Close */}
        <button style={s.closeBtn} onClick={step !== 'choice' ? goBack : undefined}>
          {step !== 'choice' ? '←' : '×'}
        </button>

        {/* Body */}
        <div style={s.body}>
          <h1 style={s.heading}>{heading}</h1>
          <p style={s.desc}>{desc}</p>

          {/* ── Auth form (sign in / sign up) ── */}
          {step === 'form' && (
            <form onSubmit={submit} style={s.form}>
              {mode === 'signup' && (
                <input style={s.input} type="text" placeholder="Your name"
                  value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
              )}
              <input style={s.input} type="email" placeholder="Email address" required
                value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              <input style={s.input} type="password"
                placeholder={mode === 'login' ? 'Password' : 'Password — min. 6 characters'} required
                value={pass} onChange={e => setPass(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              {error   && <p style={s.error}>{error}</p>}
              {success && <p style={s.successMsg}>{success}</p>}
            </form>
          )}

          {/* ── Reset password form ── */}
          {step === 'reset' && (
            <form onSubmit={submitReset} style={s.form}>
              <input style={s.input} type="email" placeholder="Your account email" required
                value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              <input style={s.input} type="password" placeholder="New password — min. 6 characters" required
                value={newPass} onChange={e => setNewPass(e.target.value)} autoComplete="new-password" />
              <input style={s.input} type="password" placeholder="Confirm new password" required
                value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
              {error   && <p style={s.error}>{error}</p>}
              {success && <p style={s.successMsg}>{success}</p>}
            </form>
          )}
        </div>

        {/* ── Footer CTAs ── */}
        <div style={s.footer}>
          {/* Choice screen */}
          {step === 'choice' && (
            <div style={s.btnRow}>
              <button style={{ ...s.btnDark, flex: 1 }} onClick={() => { setMode('login'); setStep('form'); reset(); }}>
                SIGN IN →
              </button>
              <button style={{ ...s.btnOutline, flex: 1 }} onClick={() => { setMode('signup'); setStep('form'); reset(); }}>
                CREATE ACCOUNT →
              </button>
            </div>
          )}

          {/* Sign in / Sign up form */}
          {step === 'form' && (
            <>
              <div style={s.btnRow}>
                <button style={{ ...s.btnDark, flex: 1, opacity: busy ? .6 : 1 }}
                  onClick={submit} disabled={busy}>
                  {busy ? '…' : mode === 'login' ? 'SIGN IN →' : 'CREATE ACCOUNT →'}
                </button>
              </div>
              <div style={s.linkRow}>
                {mode === 'login' && (
                  <button style={s.linkBtn} onClick={goReset}>
                    FORGOT PASSWORD? →
                  </button>
                )}
                <button style={s.linkBtn}
                  onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); reset(); }}>
                  {mode === 'login' ? 'NO ACCOUNT? SIGN UP →' : 'ALREADY HAVE AN ACCOUNT? SIGN IN →'}
                </button>
              </div>
            </>
          )}

          {/* Reset password form */}
          {step === 'reset' && (
            <>
              <div style={s.btnRow}>
                <button style={{ ...s.btnDark, flex: 1, opacity: busy ? .6 : 1 }}
                  onClick={submitReset} disabled={busy}>
                  {busy ? '…' : 'RESET PASSWORD →'}
                </button>
              </div>
              <button style={s.linkBtn}
                onClick={() => { setStep('form'); setMode('login'); reset(); }}>
                BACK TO SIGN IN →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────────── */
const s = {
  bg: {
    position: 'fixed', inset: 0,
    background: '#16181f',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter', system-ui, sans-serif",
    overflow: 'hidden',
  },
  blob: { position: 'absolute', borderRadius: '50%', pointerEvents: 'none' },
  card: {
    position: 'relative', zIndex: 1,
    background: '#F0EBE4',
    borderRadius: 6,
    width: 620, minHeight: 520,
    display: 'flex', flexDirection: 'column',
    padding: '48px 52px 40px',
    boxShadow: '0 24px 80px rgba(0,0,0,.45)',
  },
  closeBtn: {
    position: 'absolute', top: 20, right: 20,
    background: 'none', border: 'none',
    fontSize: 22, color: '#0a0a0a',
    cursor: 'pointer', lineHeight: 1, padding: '4px 8px',
    borderRadius: 4, fontFamily: 'inherit', opacity: .6,
  },
  body:    { flex: 1 },
  heading: { fontSize: 42, fontWeight: 400, color: '#0a0a0a', letterSpacing: '-.02em', lineHeight: 1.1, marginBottom: 16, marginTop: 8 },
  desc:    { fontSize: 15, color: '#3a3a3a', lineHeight: 1.55, maxWidth: 360, marginBottom: 28 },
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
  successMsg: {
    fontSize: 12, color: '#166534',
    background: 'rgba(220,252,231,.8)', border: '1px solid rgba(134,239,172,.6)',
    borderRadius: 8, padding: '9px 14px', margin: 0,
  },
  footer:  { marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 },
  btnRow:  { display: 'flex', gap: 14 },
  linkRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  btnDark: {
    padding: '17px 28px', background: '#0a0a0a', color: '#fff',
    border: 'none', borderRadius: 9999,
    fontSize: 12, fontWeight: 600, letterSpacing: '.06em',
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
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
