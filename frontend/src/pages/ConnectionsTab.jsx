import { useState, useEffect } from 'react';
import { getConnections, getActivity, getAutomationRuns, patchConnection } from '../lib/api';

const STATUS_COLORS = {
  new: 'badge-gray',
  contacted: 'badge-purple',
  replied: 'badge-amber',
  meeting: 'badge-green',
  closed: 'badge-green',
  nurture: 'badge-gray',
};

export default function ConnectionsTab({ stats }) {
  const [connections, setConnections] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [activity, setActivity] = useState([]);
  const [runs, setRuns] = useState([]);

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

  return (
    <div style={{ padding: 24 }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="label">Total Connections</div>
          <div className="value">{stats?.connections?.total ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Automation Runs</div>
          <div className="value">{runs.length}</div>
          <div className="sub">
            {runs[0] ? `Last: ${new Date(runs[0].triggeredAt).toLocaleDateString()}` : 'None yet'}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Blogs Published</div>
          <div className="value">{runs.reduce((a, r) => a + r.blogsPublished, 0)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Last Run Status</div>
          <div className="value" style={{ fontSize: 16, marginTop: 4 }}>
            {runs[0]
              ? <span className={`badge ${STATUS_COLORS[runs[0].status] || 'badge-gray'}`}>{runs[0].status}</span>
              : '—'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* Connections table */}
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input
              placeholder="Search..."
              style={{ width: 200 }}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All status</option>
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
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>LinkedIn</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>Loading...</td></tr>
                )}
                {!loading && connections.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>
                    No connections yet. Import your LinkedIn connections CSV.
                  </td></tr>
                )}
                {connections.map(c => (
                  <tr key={c._id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td style={{ color: 'var(--gray-600)', fontSize: 12 }}>{c.title || '—'}</td>
                    <td>{c.company || '—'}</td>
                    <td>
                      <select
                        className={`badge ${STATUS_COLORS[c.status]}`}
                        style={{ border: 'none', cursor: 'pointer', background: 'none', fontSize: 11, fontWeight: 600 }}
                        value={c.status}
                        onChange={e => updateStatus(c, e.target.value)}
                      >
                        {['new','contacted','replied','meeting','closed','nurture'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {c.linkedinUrl
                        ? <a href={c.linkedinUrl} target="_blank" rel="noreferrer">View ↗</a>
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12, alignItems: 'center' }}>
              <button className="btn btn-outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>Page {page} of {pages} ({total} total)</span>
              <button className="btn btn-outline" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--gray-600)' }}>Recent Activity</h3>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {activity.length === 0 && (
              <p style={{ padding: 20, color: 'var(--gray-400)', fontSize: 13 }}>No activity yet.</p>
            )}
            {activity.map(a => (
              <div key={a._id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', fontSize: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>{a.description}</div>
                <div style={{ color: 'var(--gray-400)' }}>{new Date(a.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
