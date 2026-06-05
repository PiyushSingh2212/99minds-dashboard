import { useState, useEffect } from 'react';
import api from '../lib/api';

const BASE = import.meta.env.VITE_API_URL || '/api';

export default function ExtensionTab() {
  const [info, setInfo]   = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/extension/info')
      .then(r => setInfo(r.data))
      .catch(() => setError('Could not load extension info.'));
  }, []);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href     = '/leadvault-lead-extractor.zip';
    a.download = 'leadvault-lead-extractor.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Hero card */}
      <div className="card" style={{ padding: 28, display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <img src="/logo-icon.png" alt="Leadvault" style={{ width: 64, height: 64, borderRadius: 16, flexShrink: 0, objectFit: 'cover' }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--graphite)' }}>
              {info?.name ?? 'Leadvault Lead Extractor'}

            </h2>
            {info?.version && (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand)', background: 'var(--brand-50)', padding: '2px 8px', borderRadius: 20 }}>
                v{info.version}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--concrete)', lineHeight: 1.6, marginBottom: 16 }}>
            {info?.description ?? 'Extract LinkedIn leads and sync them directly to this dashboard — one click from any LinkedIn search results page.'}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={handleDownload} style={{ gap: 7, display: 'flex', alignItems: 'center' }}>
              <DownloadIcon />
              Download Extension (.zip)
            </button>
            <a
              href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked"
              target="_blank" rel="noreferrer"
              className="btn btn-outline btn-sm"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              How to install
            </a>
          </div>
          {error && <p style={{ marginTop: 10, fontSize: 12, color: '#DC2626' }}>{error}</p>}
        </div>
      </div>

      {/* Install steps */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--graphite)', marginBottom: 18, letterSpacing: '-.01em' }}>
          Installation Steps
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: 'var(--brand-50)', color: 'var(--brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800,
              }}>{i + 1}</div>
              <div style={{ flex: 1, paddingTop: 3 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--graphite)', marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--concrete)', lineHeight: 1.55 }}
                  dangerouslySetInnerHTML={{ __html: s.body }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Config reference */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--graphite)', marginBottom: 14, letterSpacing: '-.01em' }}>
          Extension Settings Reference
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Field', 'Value', 'Notes'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 10px', background: 'var(--mist)', color: 'var(--ash)', fontWeight: 700, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--hairline)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <ConfigRow field="Dashboard URL" value={`${BASE}`} note="Paste exactly as shown" />
            <ConfigRow field="API Key"        value="leadvault-2026" note="Must match backend API_KEY env var" />
          </tbody>
        </table>
      </div>

      {/* Features */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--graphite)', marginBottom: 14, letterSpacing: '-.01em' }}>
          What It Does
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--mist)', borderRadius: 8, border: '1px solid var(--hairline)' }}>
              <span style={{ fontSize: 16 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--graphite)', marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 11, color: 'var(--concrete)', lineHeight: 1.5 }}>{f.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function ConfigRow({ field, value, note }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
      <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--graphite)', whiteSpace: 'nowrap' }}>{field}</td>
      <td style={{ padding: '8px 10px' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--mist)', padding: '2px 7px', borderRadius: 5, color: 'var(--brand-dark)', cursor: 'pointer' }} onClick={copy}>
          {value}
        </span>
        {copied && <span style={{ marginLeft: 6, fontSize: 11, color: '#16A34A' }}>Copied!</span>}
      </td>
      <td style={{ padding: '8px 10px', color: 'var(--concrete)' }}>{note}</td>
    </tr>
  );
}

const STEPS = [
  { title: 'Download the extension', body: 'Click <strong>Download Extension (.zip)</strong> above and save the file.' },
  { title: 'Unzip the file', body: 'Extract the zip — you\'ll get a folder called <code style="font-size:11px;background:#F3F4F6;padding:1px 5px;border-radius:4px">leadvault-lead-extractor</code>.' },
  { title: 'Open Chrome Extensions', body: 'Go to <code style="font-size:11px;background:#F3F4F6;padding:1px 5px;border-radius:4px">chrome://extensions</code> and enable <strong>Developer mode</strong> (top-right toggle).' },
  { title: 'Load the extension', body: 'Click <strong>Load unpacked</strong> and select the unzipped folder. The Leadvault icon will appear in your toolbar.' },
  { title: 'Configure the extension', body: 'Click the toolbar icon → enter your <strong>Dashboard URL</strong> and <strong>API Key</strong> from the table below → click <strong>Save &amp; Test Connection</strong>.' },
  { title: 'Extract leads', body: 'Go to a <strong>LinkedIn People search</strong> or <strong>Sales Navigator</strong> search page. Click the green <strong>⬆ Extract Leads</strong> button — it auto-scrolls the page, collects all visible leads, and syncs them directly to your dashboard.' },
];

const FEATURES = [
  { icon: '📜', title: 'Auto-scroll extraction', body: 'Automatically scrolls through results to capture every lead on the page — no manual scrolling needed.' },
  { icon: '🔗', title: 'Sales Navigator support', body: 'Works on both LinkedIn People Search and Sales Navigator search pages.' },
  { icon: '⚡', title: 'Live progress indicator', body: 'The floating button shows "Extracting… (23 found)" and updates in real time as leads are collected.' },
  { icon: '🔒', title: 'Secure API sync', body: 'All requests are authenticated with your private API key — no CSV, no copy-paste.' },
];

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v8M5 7l3 3 3-3M2 13h12" />
    </svg>
  );
}

