import { useState } from 'react';
import useStats from './hooks/useStats';
import LeadsTab from './pages/LeadsTab';
import ConnectionsTab from './pages/ConnectionsTab';
import './App.css';

const LOGO = `<svg viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="20" font-family="Inter,sans-serif" font-weight="800" font-size="22" fill="white">99</text>
</svg>`;

export default function App() {
  const [tab, setTab] = useState('leads');
  const { stats, loading: statsLoading, refresh } = useStats();

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">99</div>
          <span className="logo-text">minds</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${tab === 'leads' ? 'active' : ''}`}
            onClick={() => setTab('leads')}
          >
            <span className="nav-icon">🎯</span>
            Extracted Leads
            {stats?.leads?.total > 0 && (
              <span className="nav-badge">{stats.leads.total}</span>
            )}
          </button>
          <button
            className={`nav-item ${tab === 'connections' ? 'active' : ''}`}
            onClick={() => setTab('connections')}
          >
            <span className="nav-icon">🔗</span>
            Connections
            {stats?.connections?.total > 0 && (
              <span className="nav-badge">{stats.connections.total}</span>
            )}
          </button>
          <button
            className={`nav-item ${tab === 'automation' ? 'active' : ''}`}
            onClick={() => setTab('automation')}
          >
            <span className="nav-icon">⚡</span>
            Automation
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="auto-run-status">
            <span className={`status-dot ${stats?.automation?.lastRunStatus === 'success' ? 'green' : 'gray'}`} />
            <span>{stats?.automation?.lastRunAt
              ? `Last run ${new Date(stats.automation.lastRunAt).toLocaleDateString()}`
              : 'No runs yet'}</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <header className="top-bar">
          <h1 className="page-title">
            {tab === 'leads' && '🎯 Extracted Leads'}
            {tab === 'connections' && '🔗 LinkedIn Connections'}
            {tab === 'automation' && '⚡ Automation Runs'}
          </h1>
          <button className="btn btn-outline" onClick={refresh} style={{ fontSize: 12 }}>
            ↻ Refresh
          </button>
        </header>

        <div className="tab-content">
          {tab === 'leads' && <LeadsTab stats={stats?.leads} />}
          {tab === 'connections' && <ConnectionsTab stats={stats} />}
          {tab === 'automation' && <AutomationTab stats={stats?.automation} />}
        </div>
      </main>
    </div>
  );
}

function AutomationTab({ stats }) {
  if (!stats) return <p style={{ padding: 24, color: 'var(--gray-400)' }}>Loading...</p>;
  const runs = stats.recentRuns || [];
  return (
    <div style={{ padding: 24 }}>
      <div className="card" style={{ overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Triggered At</th>
              <th>Status</th>
              <th>Blogs</th>
              <th>Keywords</th>
              <th>Leads Enriched</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>
                No automation runs yet. Wire n8n to POST /api/automation/run to start tracking.
              </td></tr>
            )}
            {runs.map(r => (
              <tr key={r._id}>
                <td>{new Date(r.triggeredAt).toLocaleString()}</td>
                <td>
                  <span className={`badge ${r.status === 'success' ? 'badge-green' : r.status === 'failed' ? 'badge-red' : 'badge-amber'}`}>
                    {r.status}
                  </span>
                </td>
                <td>{r.blogsPublished}</td>
                <td>{r.keywordsResearched}</td>
                <td>{r.leadsEnriched}</td>
                <td>{r.duration ? `${(r.duration / 1000).toFixed(1)}s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 16, fontSize: 12, color: 'var(--gray-400)' }}>
        n8n webhook endpoint: <code>POST /api/automation/run</code> with header <code>x-api-key: YOUR_API_KEY</code>
      </p>
    </div>
  );
}
