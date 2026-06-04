import { useRef, useState } from 'react';
import useLeads from '../hooks/useLeads';
import { importLeads, patchLead, exportLeadsCsv } from '../lib/api';

export default function LeadsTab({ stats }) {
  const { leads, total, pages, loading, filters, update, setPage, refresh } = useLeads();
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportMsg('Parsing CSV...');
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      setImportMsg(`Uploading ${rows.length} leads...`);
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

  const scoreClass = (s) => {
    if (!s) return 'pill-low';
    if (s >= 7) return 'pill-high';
    if (s >= 4) return 'pill-mid';
    return 'pill-low';
  };

  const icpClass = (m) => {
    if (m === 'YES') return 'badge-green';
    if (m === 'MAYBE') return 'badge-amber';
    return 'badge-gray';
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Stats row */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Leads" value={stats?.total ?? 0} />
        <StatCard label="High Fit (≥7)" value={stats?.highFit ?? 0} color="var(--green)" />
        <StatCard label="Matches ICP" value={stats?.matchesIcp ?? 0} color="var(--purple)" />
        <StatCard label="Avg ICP Score" value={stats?.avgScore ?? '—'} />
        <StatCard label="Companies" value={stats?.uniqueCompanies ?? 0} />
        <StatCard
          label="Last Import"
          value={stats?.lastImportAt ? new Date(stats.lastImportAt).toLocaleDateString() : '—'}
          small
        />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Search name, company, title..."
          style={{ width: 240 }}
          value={filters.search}
          onChange={e => update({ search: e.target.value })}
        />
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
          {importMsg && <span style={{ fontSize: 12, color: 'var(--purple)' }}>{importMsg}</span>}
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
          <button className="btn btn-outline" onClick={() => fileRef.current.click()} disabled={importing}>
            ↑ Import CSV
          </button>
          <a className="btn btn-green" href={exportLeadsCsv()} target="_blank" rel="noreferrer">
            ↓ Export CSV
          </a>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Title</th>
              <th>Company</th>
              <th>Score</th>
              <th>ICP</th>
              <th>Email Guess</th>
              <th>Outreach Angle</th>
              <th>Industry</th>
              <th>LinkedIn</th>
              <th>Contacted</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>Loading...</td></tr>
            )}
            {!loading && leads.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
                No leads yet. Import a CSV from the Chrome extension.
              </td></tr>
            )}
            {leads.map(lead => (
              <tr key={lead._id}>
                <td style={{ fontWeight: 500 }}>{lead.fullName}</td>
                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--gray-600)' }}>
                  {lead.currentJob || '—'}
                </td>
                <td>{lead.companyName || '—'}</td>
                <td>
                  <span className={`pill ${scoreClass(lead.icpScore)}`}>{lead.icpScore ?? '—'}</span>
                </td>
                <td>
                  <span className={`badge ${icpClass(lead.matchesIcp)}`}>{lead.matchesIcp || '—'}</span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--gray-600)' }}>{lead.emailGuess || '—'}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--gray-600)' }} title={lead.outreachAngle}>
                  {lead.outreachAngle || '—'}
                </td>
                <td>
                  {lead.industryTag && <span className="badge badge-purple">{lead.industryTag}</span>}
                </td>
                <td>
                  {lead.linkedinUrl
                    ? <a href={lead.linkedinUrl} target="_blank" rel="noreferrer">View ↗</a>
                    : '—'}
                </td>
                <td>
                  <button
                    className={`badge ${lead.contacted ? 'badge-green' : 'badge-gray'}`}
                    style={{ border: 'none', cursor: 'pointer' }}
                    onClick={() => toggleContacted(lead)}
                  >
                    {lead.contacted ? '✓ Done' : 'Mark'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 16, alignItems: 'center' }}>
          <button className="btn btn-outline" disabled={filters.page <= 1} onClick={() => setPage(filters.page - 1)}>← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>Page {filters.page} of {pages} ({total} total)</span>
          <button className="btn btn-outline" disabled={filters.page >= pages} onClick={() => setPage(filters.page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, small }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value" style={{ color: color || 'var(--gray-800)', fontSize: small ? 18 : 28 }}>{value}</div>
    </div>
  );
}

// ── CSV parser ──────────────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[camel(h)] = vals[i] ?? ''; });
    // Normalise key fields
    const lead = {
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
    return lead;
  }).filter(l => l.fullName && l.fullName.trim() !== ' ');
}

function parseLine(line) {
  const result = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
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
