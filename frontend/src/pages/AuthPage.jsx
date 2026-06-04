import { useState } from 'react';
import { login, signup } from '../lib/api';

export default function AuthPage({ onAuth }) {
  const [step, setStep]     = useState('choice'); // 'choice' | 'form'
  const [mode, setMode]     = useState('login');  // 'login'  | 'signup'
  const [name, setName]     = useState('');
  const [email, setEmail]   = useState('');
  const [pass, setPass]     = useState('');
  const [error, setError]   = useState('');
  const [busy, setBusy]     = useState(false);

  const goEmail = (m) => { setMode(m); setError(''); setStep('form'); };
  const goBack  = ()  => { setStep('choice'); setError(''); };

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
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
        setError(err.response.data?.error || `Server error ${err.response.status}. Please try again.`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={s.bg}>
      {/* ── Blurred backdrop blobs ── */}
      <div style={{ ...s.blob, top: '10%', left: '8%',  width: 520, height: 420, background: 'radial-gradient(circle, rgba(107,94,205,.55) 0%, transparent 70%)', filter: 'blur(90px)' }} />
      <div style={{ ...s.blob, bottom: '10%', right: '8%', width: 480, height: 400, background: 'radial-gradient(circle, rgba(90,140,200,.5) 0%, transparent 70%)',  filter: 'blur(100px)' }} />
      <div style={{ ...s.blob, top: '55%', left: '42%',  width: 360, height: 300, background: 'radial-gradient(circle, rgba(180,140,100,.35) 0%, transparent 70%)', filter: 'blur(80px)' }} />

      {/* ── Card ── */}
      <div style={s.card}>
        {/* Close / Back */}
        <button style={s.closeBtn} onClick={step === 'form' ? goBack : undefined} title={step === 'form' ? 'Back' : ''}>
          {step === 'form' ? '←' : '×'}
        </button>

        {/* Body */}
        <div style={s.body}>
          <h1 style={s.heading}>
            {step === 'choice'
              ? 'Sign Up / Sign In'
              : mode === 'login' ? 'Sign In' : 'Create Account'}
          </h1>
          <p style={s.desc}>
            {step === 'choice'
              ? 'Continue with your email address to create an account or sign in.'
              : mode === 'login'
                ? 'Enter your email and password to access your dashboard.'
                : 'Set up your 99minds dashboard account.'}
          </p>

          {/* Form fields */}
          {step === 'form' && (
            <form onSubmit={submit} style={s.form}>
              {mode === 'signup' && (
                <input style={s.input} type="text" placeholder="Your name"
                  value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
              )}
              <input style={s.input} type="email" placeholder="Email address" required
                value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              <input style={s.input} type="password" placeholder={mode === 'login' ? 'Password' : 'Password — min. 6 characters'} required
                value={pass} onChange={e => setPass(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              {error && <p style={s.error}>{error}</p>}
            </form>
          )}
        </div>

        {/* ── Footer CTAs ── */}
        <div style={s.footer}>
          {step === 'choice' ? (
            <>
              <div style={s.btnRow}>
                <button style={{ ...s.btnDark, flex: 1 }} onClick={() => goEmail('login')}>
                  SIGN IN →
                </button>
                <button style={{ ...s.btnOutline, flex: 1 }} onClick={() => goEmail('signup')}>
                  CREATE ACCOUNT →
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={s.btnRow}>
                <button style={{ ...s.btnDark, flex: 1, opacity: busy ? .6 : 1 }}
                  onClick={submit} disabled={busy}>
                  {busy ? '…' : mode === 'login' ? 'SIGN IN →' : 'CREATE ACCOUNT →'}
                </button>
              </div>
              <button style={s.switchLink}
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
                {mode === 'login' ? 'NO ACCOUNT? SIGN UP →' : 'ALREADY HAVE AN ACCOUNT? SIGN IN →'}
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
    position: 'fixed',
    inset: 0,
    background: '#16181f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', system-ui, sans-serif",
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    background: '#F0EBE4',
    borderRadius: 6,
    width: 620,
    minHeight: 520,
    display: 'flex',
    flexDirection: 'column',
    padding: '48px 52px 40px',
    boxShadow: '0 24px 80px rgba(0,0,0,.45)',
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    background: 'none',
    border: 'none',
    fontSize: 22,
    color: '#0a0a0a',
    cursor: 'pointer',
    lineHeight: 1,
    padding: '4px 8px',
    borderRadius: 4,
    fontFamily: 'inherit',
    opacity: .6,
    transition: 'opacity .15s',
  },
  body: {
    flex: 1,
  },
  heading: {
    fontSize: 42,
    fontWeight: 400,
    color: '#0a0a0a',
    letterSpacing: '-.02em',
    lineHeight: 1.1,
    marginBottom: 16,
    marginTop: 8,
  },
  desc: {
    fontSize: 15,
    color: '#3a3a3a',
    lineHeight: 1.55,
    maxWidth: 340,
    marginBottom: 28,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 4,
  },
  input: {
    fontSize: 14,
    border: '1px solid rgba(0,0,0,.18)',
    borderRadius: 10,
    padding: '12px 16px',
    background: 'rgba(255,255,255,.7)',
    color: '#0a0a0a',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color .15s, box-shadow .15s',
    backdropFilter: 'blur(4px)',
  },
  error: {
    fontSize: 12,
    color: '#9B1C1C',
    background: 'rgba(254,226,226,.8)',
    border: '1px solid rgba(252,165,165,.6)',
    borderRadius: 8,
    padding: '9px 14px',
    margin: 0,
  },
  footer: {
    marginTop: 32,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  btnRow: {
    display: 'flex',
    gap: 14,
  },
  btnDark: {
    padding: '17px 28px',
    background: '#0a0a0a',
    color: '#fff',
    border: 'none',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '.06em',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity .15s',
    whiteSpace: 'nowrap',
  },
  btnOutline: {
    padding: '17px 28px',
    background: 'transparent',
    color: '#0a0a0a',
    border: '1.5px solid #0a0a0a',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '.06em',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background .15s',
    whiteSpace: 'nowrap',
  },
  switchLink: {
    background: 'none',
    border: 'none',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '.06em',
    color: '#0a0a0a',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    fontFamily: 'inherit',
    textAlign: 'left',
    padding: 0,
    opacity: .7,
  },
};
