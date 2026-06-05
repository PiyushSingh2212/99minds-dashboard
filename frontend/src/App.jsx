import { useState, useEffect, useCallback } from 'react';
import useStats from './hooks/useStats';
import LeadsTab from './pages/LeadsTab';
import ConnectionsTab from './pages/ConnectionsTab';
import ExtensionTab from './pages/ExtensionTab';
import AuthPage from './pages/AuthPage';
import './App.css';

const Icon = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  target:    'M8 2a6 6 0 100 12A6 6 0 008 2zm0 3a3 3 0 100 6A3 3 0 008 5zm0 1.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z',
  link:      'M6.5 9.5l3-3m-4-1l-1 1a3 3 0 004.24 4.24l1-1M9.5 6.5l1-1a3 3 0 00-4.24-4.24l-1 1',
  lightning: 'M9 2L4 9h5l-2 5 7-7H9L11 2z',
  settings:  'M8 10a2 2 0 100-4 2 2 0 000 4zm4.34-1.5a4.5 4.5 0 000-1M3.66 8.5a4.5 4.5 0 000-1M8 3.66a4.5 4.5 0 00-1 0M8 12.34a4.5 4.5 0 00-1 0',
  book:      'M3 3h8a1 1 0 011 1v8a1 1 0 01-1 1H3V3zm0 0v10M7 3v10',
  bell:      'M12 11H4l1-5a3 3 0 016 0l1 5zM8 13.5a1.5 1.5 0 01-3 0',
  search:    'M7 13A6 6 0 107 1a6 6 0 000 12zm4-1l3 3',
  refresh:   'M3.5 8A4.5 4.5 0 0012 10.5M12.5 8A4.5 4.5 0 004 5.5M2 8h3M11 8h3',
  puzzle:    'M9.5 2.5a1.5 1.5 0 013 0V4h1a1 1 0 011 1v1.5a1.5 1.5 0 010 3V11a1 1 0 01-1 1h-1v1.5a1.5 1.5 0 01-3 0V12h-5a1 1 0 01-1-1V5a1 1 0 011-1h5V2.5z',
};

const PAGE_META = {
  leads:       { title: 'Extracted Leads',      subtitle: 'Manage and track your LinkedIn leads' },
  connections: { title: 'LinkedIn Connections', subtitle: 'Monitor and update connection statuses' },
  automation:  { title: 'Automation Runs',      subtitle: 'Track n8n automation pipeline activity' },
  extension:   { title: 'Chrome Extension',     subtitle: 'Download and configure the Leadvault Lead Extractor' },
};

export default function App() {
  const [tab, setTab]   = useState('leads');
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('auth_user')); } catch { return null; }
  });
  const [theme, setTheme] = useState(() => localStorage.getItem('lv-theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lv-theme', theme);
  }, [theme]);

  // Listen for 401 → force logout
  useEffect(() => {
    const handleLogout = () => setUser(null);
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const handleAuth = useCallback((u) => setUser(u), []);
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setUser(null);
  };

  if (!user) return <AuthPage onAuth={handleAuth} />;

  return <Dashboard tab={tab} setTab={setTab} user={user} onLogout={handleLogout} theme={theme} setTheme={setTheme} />;
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <button
      className="theme-toggle"
      data-dark={isDark}
      onClick={onToggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="theme-toggle-thumb">{isDark ? '☽' : '☀'}</span>
    </button>
  );
}

function Dashboard({ tab, setTab, user, onLogout, theme, setTheme }) {
  const { stats, refresh } = useStats();
  const meta = PAGE_META[tab];
  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/logo.png" alt="Leadvault" className="logo-img" />
        </div>

        <div className="sidebar-section">
          <span className="sidebar-section-label">Main</span>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${tab === 'leads' ? 'active' : ''}`} onClick={() => setTab('leads')}>
            <span className="nav-icon"><Icon d={ICONS.target} /></span>
            Extracted Leads
            {stats?.leads?.total > 0 && <span className="nav-badge">{stats.leads.total}</span>}
          </button>
          <button className={`nav-item ${tab === 'connections' ? 'active' : ''}`} onClick={() => setTab('connections')}>
            <span className="nav-icon"><Icon d={ICONS.link} /></span>
            Connections
            {stats?.connections?.total > 0 && <span className="nav-badge">{stats.connections.total}</span>}
          </button>
          <button className={`nav-item ${tab === 'automation' ? 'active' : ''}`} onClick={() => setTab('automation')}>
            <span className="nav-icon"><Icon d={ICONS.lightning} /></span>
            Automation
          </button>
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-section">
          <span className="sidebar-section-label">Tools</span>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${tab === 'extension' ? 'active' : ''}`} onClick={() => setTab('extension')}>
            <span className="nav-icon"><Icon d={ICONS.puzzle} /></span>
            Chrome Extension
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', color: 'var(--color-obsidian)' }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v8M5 7l3 3 3-3M2 13h12" />
              </svg>
            </span>
          </button>
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-section">
          <span className="sidebar-section-label">System</span>
        </div>
        <nav className="sidebar-nav">
          <button className="nav-item">
            <span className="nav-icon"><Icon d={ICONS.settings} /></span>
            Settings
          </button>
          <button className="nav-item">
            <span className="nav-icon"><Icon d={ICONS.book} /></span>
            Documentation
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="auto-run-status">
            <span className={`status-dot ${stats?.automation?.lastRunStatus === 'success' ? 'green' : 'gray'}`} />
            <span>
              {stats?.automation?.lastRunAt
                ? `Last run ${new Date(stats.automation.lastRunAt).toLocaleDateString()}`
                : 'No automation runs yet'}
            </span>
          </div>
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">PS</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">Piyush Singh</div>
              <div className="sidebar-user-email">piyush.singh@99minds.io</div>
            </div>
            <span className="sidebar-user-chevron">›</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main">
        <header className="top-bar">
          <div className="top-bar-left">
            <h1 className="page-title">{meta.title}</h1>
            <p className="page-subtitle">{meta.subtitle}</p>
          </div>
          <div className="top-bar-right">
            <div className="top-bar-search">
              <Icon d={ICONS.search} size={12} />
              <span>Search…</span>
            </div>
            <button className="icon-btn" title="Notifications">
              <Icon d={ICONS.bell} />
            </button>
            <div className="top-bar-divider" />
            <button className="btn btn-outline btn-sm" onClick={refresh} style={{ gap: 5 }}>
              <Icon d={ICONS.refresh} size={12} />
              Refresh
            </button>
            {tab === 'leads' && (
              <button className="btn btn-primary btn-sm">+ New Import</button>
            )}
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <div className="top-bar-divider" />
            <button className="btn btn-outline btn-sm" onClick={onLogout} title={`Signed in as ${user.email}`}>
              Sign out
            </button>
          </div>
        </header>

        <div className="tab-content">
          {tab === 'leads'       && <LeadsTab stats={stats?.leads} />}
          {tab === 'connections' && <ConnectionsTab stats={stats} />}
          {tab === 'automation'  && <AutomationTab stats={stats?.automation} />}
          {tab === 'extension'   && <ExtensionTab />}
        </div>
      </main>
    </div>
  );
}

/* ── Automation tab (inline) ────────────────────────────────────── */
function AutomationTab({ stats }) {
  if (!stats) return <p style={{ padding: 32, color: 'var(--concrete)', fontSize: 13 }}>Loading…</p>;
  const runs = stats.recentRuns || [];
  return (
    <div style={{ padding: 24 }}>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 600 }}>
          <thead>
            <tr>
              {[['Triggered At'],['Status','center'],['Blogs','center'],['Keywords','center'],['Leads Enriched','center'],['Duration','center']].map(([h, align]) => (
                <th key={h} style={{ whiteSpace: 'nowrap', textAlign: align || 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--concrete)', padding: 48, whiteSpace: 'normal' }}>
                No automation runs yet. Wire n8n to <code>POST /api/automation/run</code> to start tracking.
              </td></tr>
            )}
            {runs.map(r => (
              <tr key={r._id}>
                <td style={{ color: 'var(--concrete)', whiteSpace: 'nowrap' }}>{new Date(r.triggeredAt).toLocaleString()}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`badge ${r.status === 'success' ? 'badge-green' : r.status === 'failed' ? 'badge-red' : 'badge-amber'}`}>
                    {r.status}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>{r.blogsPublished}</td>
                <td style={{ textAlign: 'center' }}>{r.keywordsResearched}</td>
                <td style={{ textAlign: 'center' }}>{r.leadsEnriched}</td>
                <td style={{ textAlign: 'center', color: 'var(--concrete)' }}>{r.duration ? `${(r.duration / 1000).toFixed(1)}s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <p style={{ marginTop: 14, fontSize: 12, color: 'var(--concrete)' }}>
        Endpoint: <code>POST /api/automation/run</code> — header <code>x-api-key: YOUR_API_KEY</code>
      </p>
    </div>
  );
}
