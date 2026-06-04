import { useState, useEffect } from 'react';
import { getConnections, getActivity, getAutomationRuns, patchConnection } from '../lib/api';

const STATUS_COLORS = {
  new: 'badge-gray', contacted: 'badge-purple', replied: 'badge-amber',
  meeting: 'badge-green', closed: 'badge-green', nurture: 'badge-gray',
};

/* ── Sparkline ──────────────────────────────────────────────────── */
function Sparkline({ data }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const W = 120, H = 36;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - 5 - ((v - min) / range) * (H - 10),
  ]);
  const area = `M${pts[0]} L ${pts.map(p => p.join(',')).join(' L ')} L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} preserveAspectRatio="none">
      <path d={area} fill="rgba(107,94,205,.07)" />
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none"
        stroke="var(--brand)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity=".6" />
    </svg>
  );
}

function mockSpark(seed, len = 12, base = 5, spread = 15) {
  let s = (seed * 1103515245 + 12345) & 0x7fffffff;
  return Array.from({ length: len }, (_, i) => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return base + (s % spread) + i * 1.2;
  });
}

function StatCard({ label, value, trend, positive, spark, small, sub }) {
  return (
    <div className="stat-card">
      <div className="sc-header"><span className="sc-label">{label}</span></div>
      <div className="sc-value-row">
        <span className={`sc-value${small ? ' sm' : ''}`}>{value}</span>
        {trend != null && (
          <span className={`trend ${positive ? 'trend-up' : 'trend-neutral'}`}>
            {positive ? '↑' : '→'} {trend}
          </span>
        )}
      </div>
      {spark && <div className="sc-sparkline"><Sparkline data={spark} /></div>}
      {sub && <div className="sc-sub">{sub}</div>}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────── */
export default function ConnectionsTab({ stats }) {
  const [connections, setConnections] = useState([]);
  const [total, setTotal]   = useState(0);
  const [pages, setPages]   = useState(1);
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [activity, setActivity] = useState([]);
  const [runs, setRuns]     = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 25, ...(search && { search }), ...(statusFilter && { status: statusFilter }) };
      const data = await getConnections(params);
      setConnections(data.connections);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, search, statusFilter]);
  useEffect(() => {
    getActivity().then(setActivity).catch(() => {});
    getAutomationRuns().then(setRuns).catch(() => {});
  }, []);

  const updateStatus = async (conn, status) => {
    await patchConnection(conn._id, { status });
    load();
  };

  const totalBlogs = runs.reduce((a, r) => a + r.blogsPublished, 0);

  return (
    <div style={{ padding: 24 }}>
      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Connections" value={stats?.connections?.total ?? 0}
          spark={mockSpark(31)} positive />
        <StatCard label="Automation Runs"   value={runs.length}
          sub={runs[0] ? `Last: ${new Date(runs[0].triggeredAt).toLocaleDateString()}` : 'None yet'}
          spark={mockSpark(58)} positive />
        <StatCard label="Blogs Published"   value={totalBlogs}
          spark={mockSpark(74)} positive />
        <StatCard label="Last Run Status"
          value={runs[0]
            ? <span className={`badge ${STATUS_COLORS[runs[0].status] || 'badge-gray'}`}>{runs[0].status}</span>
            : '—'}
          small sub={runs[0] ? new Date(runs[0].triggeredAt).toLocaleString() : 'No runs yet'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* ── Connections table ── */}
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input placeholder="Search connections…" style={{ width: 210 }}
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="replied">Replied</option>
              <option value="meeting">Meeting</option>
              <option value="nurture">Nurture</option>
            </select>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <table>
              <thead>
                <tr><th>Name</th><th>Title</th><th>Company</th><th>Status</th><th>LinkedIn</th></tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--ash)' }}>Loading…</td></tr>
                )}
                {!loading && connections.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ color: 'var(--concrete)', fontSize: 13 }}>No connections yet.</div>
                    <div style={{ color: 'var(--ash)', fontSize: 12, marginTop: 4 }}>Import your LinkedIn connections CSV.</div>
                  </td></tr>
                )}
                {connections.map(c => (
                  <tr key={c._id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td style={{ color: 'var(--concrete)', fontSize: 12 }}>{c.title || '—'}</td>
                    <td>{c.company || '—'}</td>
                    <td>
                      <select className={`badge ${STATUS_COLORS[c.status]}`}
                        style={{ border: 'none', cursor: 'pointer', background: 'none', fontSize: 11, fontWeight: 600 }}
                        value={c.status} onChange={e => updateStatus(c, e.target.value)}>
                        {['new','contacted','replied','meeting','closed','nurture'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {c.linkedinUrl
                        ? <a href={c.linkedinUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>View ↗</a>
                        : <span style={{ color: 'var(--ash)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12, alignItems: 'center' }}>
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ fontSize: 13, color: 'var(--concrete)', padding: '0 8px' }}>
                Page {page} of {pages} <span style={{ color: 'var(--ash)' }}>({total} total)</span>
              </span>
              <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>

        {/* ── Activity feed ── */}
        <div>
          <h3 style={{ fontSize: 10, fontWeight: 700, color: 'var(--ash)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            Recent Activity
          </h3>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {activity.length === 0 && (
              <p style={{ padding: '20px 18px', color: 'var(--ash)', fontSize: 13 }}>No activity yet.</p>
            )}
            {activity.map((a, i) => (
              <div key={a._id} style={{
                padding: '12px 16px',
                borderBottom: i < activity.length - 1 ? '1px solid var(--hairline)' : 'none',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', marginTop: 5, flexShrink: 0, opacity: .6 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--graphite)', marginBottom: 2 }}>{a.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--ash)' }}>{new Date(a.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
