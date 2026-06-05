import { useRef, useState } from 'react';
import useLeads from '../hooks/useLeads';
import { importLeads, patchLead, exportLeadsCsv } from '../lib/api';

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

/* Deterministic mock spark — same seed → same curve */
function mockSpark(seed, len = 12, base = 10, spread = 20) {
  let s = (seed * 1103515245 + 12345) & 0x7fffffff;
  return Array.from({ length: len }, (_, i) => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return base + (s % spread) + i * 1.5;
  });
}

/* ── Stat card ──────────────────────────────────────────────────── */
function StatCard({ label, value, trend, positive, spark, small, action }) {
  return (
    <div className="stat-card">
      <div className="sc-header">
        <span className="sc-label">{label}</span>
        {action && <button className="sc-action">{action}</button>}
      </div>
      <div className="sc-value-row">
        <span className={`sc-value${small ? ' sm' : ''}`}>{value}</span>
        {trend != null && (
          <span className={`trend ${positive ? 'trend-up' : trend === 0 ? 'trend-neutral' : 'trend-down'}`}>
            {positive ? '↑' : trend === 0 ? '→' : '↓'} {trend}
          </span>
        )}
      </div>
      {spark && <div className="sc-sparkline"><Sparkline data={spark} /></div>}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────── */
export default function LeadsTab({ stats }) {
  const { leads, total, pages, loading, filters, update, setPage, refresh } = useLeads();
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportMsg('Parsing CSV…');
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      setImportMsg(`Uploading ${rows.length} leads…`);
      const result = await importLeads(rows);
      setImportMsg(`✓ ${result.inserted} new, ${result.updated} updated`);
      refresh();
      setTimeout(() => setImportMsg(''), 4000);
    } catch (err) {
      setImportMsg(`Error: ${err.message}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const toggleContacted = async (lead) => {
    await patchLead(lead._id, { contacted: !lead.contacted });
    refresh();
  };

  const scoreClass = s => !s ? 'pill-low' : s >= 7 ? 'pill-high' : s >= 4 ? 'pill-mid' : 'pill-low';
  const icpClass   = m => m === 'YES' ? 'badge-green' : m === 'MAYBE' ? 'badge-amber' : 'badge-gray';

  const t = stats?.total || 0;
  const highFitPct = t ? Math.round((stats.highFit / t) * 100) : 0;
  const icpPct     = t ? Math.round((stats.matchesIcp / t) * 100) : 0;

  return (
    <div style={{ padding: 24 }}>
      {/* ── Stats row 1 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
        <StatCard label="Total Leads"   value={stats?.total ?? 0}
          trend={t > 0 ? `${t} total` : null} positive spark={mockSpark(17)} action="View all" />
        <StatCard label="High Fit (≥ 7)" value={stats?.highFit ?? 0}
          trend={highFitPct ? `${highFitPct}% of total` : null} positive={highFitPct >= 20}
          spark={mockSpark(42)} action="Filter" />
        <StatCard label="Matches ICP"   value={stats?.matchesIcp ?? 0}
          trend={icpPct ? `${icpPct}% of total` : null} positive={icpPct >= 30}
          spark={mockSpark(93)} action="Filter" />
      </div>

      {/* ── Stats row 2 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Avg ICP Score"    value={stats?.avgScore != null ? Number(stats.avgScore).toFixed(1) : '—'}
          trend={stats?.avgScore >= 6 ? 'Good quality' : stats?.avgScore ? 'Needs work' : null}
          positive={stats?.avgScore >= 6} spark={mockSpark(55)} />
        <StatCard label="Unique Companies" value={stats?.uniqueCompanies ?? 0}
          spark={mockSpark(71)} positive />
        <StatCard label="Last Import"
          value={stats?.lastImportAt ? new Date(stats.lastImportAt).toLocaleDateString() : '—'}
          small action="Import CSV" />
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search name, company, title…" style={{ width: 240 }}
          value={filters.search} onChange={e => update({ search: e.target.value })} />
        <select value={filters.matchesIcp} onChange={e => update({ matchesIcp: e.target.value })}>
          <option value="">All ICP</option>
          <option value="YES">YES</option>
          <option value="MAYBE">MAYBE</option>
          <option value="NO">NO</option>
        </select>
        <select value={filters.sort} onChange={e => update({ sort: e.target.value })}>
          <option value="-icpScore">Score ↓</option>
          <option value="icpScore">Score ↑</option>
          <option value="-importedAt">Newest</option>
          <option value="fullName">Name A–Z</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {importMsg && (
            <span style={{ fontSize: 12, color: 'var(--brand)', background: 'var(--brand-100)', padding: '4px 10px', borderRadius: 99, fontWeight: 500 }}>
              {importMsg}
            </span>
          )}
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
          <button className="btn btn-outline btn-sm" onClick={() => fileRef.current.click()} disabled={importing}>
            ↑ Import CSV
          </button>
          <a className="btn btn-green btn-sm" href={exportLeadsCsv()} target="_blank" rel="noreferrer">
            ↓ Export CSV
          </a>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 900 }}>
          <thead>
            <tr>
              {[
                ['Name'],['Title'],['Company'],
                ['Score','center'],['ICP','center'],
                ['Email'],['Outreach Angle'],['Industry'],
                ['LinkedIn','center'],['Contacted','center'],
              ].map(([h, align]) => (
                <th key={h} style={{ whiteSpace: 'nowrap', textAlign: align || 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 48, color: 'var(--ash)' }}>Loading…</td></tr>
            )}
            {!loading && leads.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 48 }}>
                <div style={{ color: 'var(--concrete)', fontSize: 13 }}>No leads yet.</div>
                <div style={{ color: 'var(--ash)', fontSize: 12, marginTop: 4 }}>Import a CSV from the Chrome extension to get started.</div>
              </td></tr>
            )}
            {leads.map(lead => (
              <tr key={lead._id}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{lead.fullName}</td>
                <td><div style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--concrete)' }}>{lead.currentJob || '—'}</div></td>
                <td><div style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.companyName || '—'}</div></td>
                <td style={{ textAlign: 'center' }}><span className={`pill ${scoreClass(lead.icpScore)}`}>{lead.icpScore ?? '—'}</span></td>
                <td style={{ textAlign: 'center' }}><span className={`badge ${icpClass(lead.matchesIcp)}`}>{lead.matchesIcp || '—'}</span></td>
                <td><div style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--concrete)' }}>{lead.emailGuess || '—'}</div></td>
                <td><div style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--concrete)' }} title={lead.outreachAngle}>{lead.outreachAngle || '—'}</div></td>
                <td>{lead.industryTag && <span className="badge badge-purple">{lead.industryTag}</span>}</td>
                <td style={{ textAlign: 'center' }}>
                  {lead.linkedinUrl
                    ? <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>View ↗</a>
                    : <span style={{ color: 'var(--ash)' }}>—</span>}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button className={`badge ${lead.contacted ? 'badge-green' : 'badge-gray'}`}
                    style={{ border: 'none', cursor: 'pointer' }} onClick={() => toggleContacted(lead)}>
                    {lead.contacted ? '✓ Done' : 'Mark'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 16, alignItems: 'center' }}>
          <button className="btn btn-outline btn-sm" disabled={filters.page <= 1} onClick={() => setPage(filters.page - 1)}>← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--concrete)', padding: '0 8px' }}>
            Page {filters.page} of {pages} <span style={{ color: 'var(--ash)' }}>({total} total)</span>
          </span>
          <button className="btn btn-outline btn-sm" disabled={filters.page >= pages} onClick={() => setPage(filters.page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

/* ── CSV parser ─────────────────────────────────────────────────── */
function parseCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[camel(h)] = vals[i] ?? ''; });
    return {
      fullName:      obj.fullName || obj['first Name'] + ' ' + obj['last Name'] || obj.name || '',
      firstName:     obj.firstName || obj['first Name'] || '',
      lastName:      obj.lastName  || obj['last Name']  || '',
      currentJob:    obj.currentJob || obj.title || obj['current Job Title'] || '',
      companyName:   obj.companyName || obj.company || obj['company Name'] || '',
      linkedinUrl:   obj.linkedinUrl || obj['linkedin Url'] || obj['profile Url'] || '',
      salesNavUrl:   obj.salesNavUrl || '',
      location:      obj.location || '',
      emailGuess:    obj.emailGuess || obj['email Guess'] || '',
      icpScore:      obj.icpScore ? Number(obj.icpScore) : null,
      matchesIcp:    obj.matchesIcp || obj['matches Icp'] || '',
      scoreReason:   obj.scoreReason || obj['score Reason'] || '',
      outreachAngle: obj.outreachAngle || obj['outreach Angle'] || '',
      platformGuess: obj.platformGuess || obj['platform Guess'] || '',
      industryTag:   obj.industryTag || obj['industry Tag'] || obj.industry || '',
      headline:      obj.headline || '',
      companySize:   obj['company Size'] || obj.companySize || '',
    };
  }).filter(l => l.fullName && l.fullName.trim() !== ' ');
}

function parseLine(line) {
  const result = []; let cur = '', inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

function camel(str) {
  return str.replace(/^"|"$/g, '').replace(/[_\s-](.)/g, (_, c) => c.toUpperCase());
}
