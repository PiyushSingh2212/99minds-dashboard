import { useRef, useState, useCallback } from 'react';
import useLeads from '../hooks/useLeads';
import { importLeads, patchLead, exportLeadsCsv, aiScore, aiEnrich, aiOutreach, getAllLeadIds } from '../lib/api';

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

/* ── Outreach Modal ─────────────────────────────────────────────── */
function OutreachModal({ messages, loading, onClose, onGenerate, context, onContextChange }) {
  const [copied, setCopied] = useState(null);
  const copy = (i, text) => {
    navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 24, maxWidth: 620, width: '100%',
        maxHeight: '85vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 24px 80px rgba(0,0,0,.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>AI Outreach Messages</h2>
            <p style={{ fontSize: 12, color: 'var(--ash)', marginTop: 2 }}>Personalized messages powered by Claude</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--ash)', lineHeight: 1 }}>✕</button>
        </div>

        <div>
          <label style={{ fontSize: 11, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>
            Your product/service (optional — helps Claude personalize)
          </label>
          <input value={context} onChange={e => onContextChange(e.target.value)}
            placeholder="e.g. AI-powered sales CRM that helps teams close 2× faster…"
            style={{ width: '100%' }} />
        </div>

        <button className="btn btn-primary" onClick={onGenerate} disabled={loading}
          style={{ background: 'linear-gradient(135deg,#6B5ECD,#a78bfa)' }}>
          {loading ? 'Generating with Claude…' : messages.length ? 'Regenerate Messages' : 'Generate Messages'}
        </button>

        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ash)', fontSize: 13 }}>
            Claude is writing personalized messages…
          </div>
        )}

        {!loading && messages.map((m, i) => (
          <div key={i} style={{
            border: '1px solid #E5E7EB', borderRadius: 12, padding: 16,
            background: m.ok ? '#fff' : '#FEF2F2',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{m.fullName}</span>
              {m.ok && (
                <button onClick={() => copy(i, m.message)}
                  style={{ fontSize: 11, background: copied === i ? '#F0FDF4' : 'var(--brand-100)',
                    color: copied === i ? '#16A34A' : 'var(--brand)', border: '1px solid currentColor',
                    borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}>
                  {copied === i ? '✓ Copied' : 'Copy'}
                </button>
              )}
            </div>
            {m.ok
              ? <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>{m.message}</p>
              : <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>Error: {m.error}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────── */
export default function LeadsTab({ stats }) {
  const { leads, total, pages, loading, filters, update, setPage, refresh } = useLeads();
  const [importing,  setImporting]  = useState(false);
  const [importMsg,  setImportMsg]  = useState('');
  const [aiMsg,      setAiMsg]      = useState('');
  const [aiBusy,     setAiBusy]     = useState(false);
  const [selected,   setSelected]   = useState(new Set());
  const [outreach,   setOutreach]   = useState({ open: false, messages: [], loading: false });
  const [outCtx,     setOutCtx]     = useState('');
  const fileRef = useRef();

  /* ── Import CSV ── */
  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setImportMsg('Parsing CSV…');
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      setImportMsg(`Uploading ${rows.length} leads…`);
      const result = await importLeads(rows);
      setImportMsg(`✓ ${result.inserted} new, ${result.updated} updated`);
      refresh();
      setTimeout(() => setImportMsg(''), 4000);
    } catch (err) { setImportMsg(`Error: ${err.message}`); }
    finally { setImporting(false); e.target.value = ''; }
  };

  const toggleContacted = async (lead) => {
    await patchLead(lead._id, { contacted: !lead.contacted });
    refresh();
  };

  /* ── Selection ── */
  const toggleSelect = (id) => setSelected(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const allSelected  = leads.length > 0 && leads.every(l => selected.has(l._id));
  const toggleAll    = () => setSelected(allSelected ? new Set() : new Set(leads.map(l => l._id)));

  /* ── AI: Score All ── */
  const handleScoreAll = useCallback(async () => {
    setAiBusy(true); setAiMsg('Fetching lead IDs…');
    try {
      const ids = await getAllLeadIds();
      setAiMsg(`Scoring ${ids.length} leads with Claude…`);
      const { results } = await aiScore(ids);
      const ok = results.filter(r => r.ok).length;
      setAiMsg(`✓ ${ok} leads scored`);
      refresh();
      setTimeout(() => setAiMsg(''), 4000);
    } catch (e) { setAiMsg(`Error: ${e.message}`); }
    finally { setAiBusy(false); }
  }, [refresh]);

  /* ── AI: Score single lead ── */
  const handleScoreOne = async (lead) => {
    setAiMsg(`Scoring ${lead.fullName}…`);
    try {
      await aiScore([lead._id]);
      refresh();
      setAiMsg('✓ Scored');
      setTimeout(() => setAiMsg(''), 2500);
    } catch (e) { setAiMsg(`Error: ${e.message}`); }
  };

  /* ── AI: Enrich All ── */
  const handleEnrichAll = useCallback(async () => {
    setAiBusy(true); setAiMsg('Fetching lead IDs…');
    try {
      const ids = await getAllLeadIds();
      setAiMsg(`Enriching ${ids.length} leads with Claude…`);
      const { results } = await aiEnrich(ids);
      const ok = results.filter(r => r.ok).length;
      setAiMsg(`✓ ${ok} leads enriched`);
      refresh();
      setTimeout(() => setAiMsg(''), 4000);
    } catch (e) { setAiMsg(`Error: ${e.message}`); }
    finally { setAiBusy(false); }
  }, [refresh]);

  /* ── AI: Enrich single lead ── */
  const handleEnrichOne = async (lead) => {
    setAiMsg(`Enriching ${lead.fullName}…`);
    try {
      await aiEnrich([lead._id]);
      refresh();
      setAiMsg('✓ Enriched');
      setTimeout(() => setAiMsg(''), 2500);
    } catch (e) { setAiMsg(`Error: ${e.message}`); }
  };

  /* ── AI: Outreach ── */
  const openOutreach = () => setOutreach({ open: true, messages: [], loading: false });

  const handleOutreachOne = async (lead) => {
    setOutreach({ open: true, messages: [], loading: true });
    setSelected(new Set([lead._id]));
    try {
      const { messages } = await aiOutreach([lead._id], outCtx);
      setOutreach({ open: true, messages, loading: false });
    } catch (e) {
      setOutreach({ open: true, messages: [{ fullName: lead.fullName, ok: false, error: e.message }], loading: false });
    }
  };

  const handleGenerate = async () => {
    if (!selected.size) return;
    setOutreach(s => ({ ...s, loading: true }));
    try {
      const { messages } = await aiOutreach([...selected], outCtx);
      setOutreach(s => ({ ...s, messages, loading: false }));
    } catch (e) {
      setOutreach(s => ({ ...s, loading: false, messages: [{ fullName: 'Error', ok: false, error: e.message }] }));
    }
  };

  const scoreClass = s => !s ? 'pill-low' : s >= 7 ? 'pill-high' : s >= 4 ? 'pill-mid' : 'pill-low';
  const icpClass   = m => m === 'YES' ? 'badge-green' : m === 'MAYBE' ? 'badge-amber' : 'badge-gray';

  const t = stats?.total || 0;
  const highFitPct = t ? Math.round((stats.highFit / t) * 100) : 0;
  const icpPct     = t ? Math.round((stats.matchesIcp / t) * 100) : 0;

  const AIBtn = ({ title, onClick, children }) => (
    <button title={title} onClick={onClick}
      style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6,
        padding: '2px 7px', fontSize: 11, cursor: 'pointer', color: 'var(--concrete)',
        whiteSpace: 'nowrap', lineHeight: '18px' }}>
      {children}
    </button>
  );

  return (
    <div style={{ padding: 24 }}>
      {outreach.open && (
        <OutreachModal
          messages={outreach.messages}
          loading={outreach.loading}
          context={outCtx}
          onContextChange={setOutCtx}
          onGenerate={handleGenerate}
          onClose={() => setOutreach(s => ({ ...s, open: false }))}
        />
      )}

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
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search name, company, title…" style={{ width: 220 }}
          value={filters.search} onChange={e => update({ search: e.target.value })} />
        <select value={filters.matchesIcp} onChange={e => update({ matchesIcp: e.target.value })}>
          <option value="">All ICP</option>
          <option value="YES">YES</option>
          <option value="MAYBE">MAYBE</option>
          <option value="NO">NO</option>
        </select>
        <select value={filters.sort} onChange={e => update({ sort: e.target.value })}>
          <option value="-importedAt">Newest first</option>
          <option value="-icpScore">Score ↓</option>
          <option value="icpScore">Score ↑</option>
          <option value="fullName">Name A–Z</option>
        </select>

        {/* AI batch actions */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '0 4px', borderLeft: '1px solid #E5E7EB' }}>
          <span style={{ fontSize: 11, color: 'var(--ash)', fontWeight: 600, letterSpacing: '.04em' }}>AI</span>
          <button className="btn btn-outline btn-sm" onClick={handleScoreAll} disabled={aiBusy}
            title="Score all leads for ICP fit using Claude">
            🎯 Score All
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleEnrichAll} disabled={aiBusy}
            title="Fill missing fields using Claude">
            ✨ Enrich All
          </button>
          {selected.size > 0 && (
            <button className="btn btn-primary btn-sm" onClick={openOutreach}
              style={{ background: 'linear-gradient(135deg,#6B5ECD,#a78bfa)' }}>
              ✉ Outreach ({selected.size})
            </button>
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {(importMsg || aiMsg) && (
            <span style={{ fontSize: 12, color: 'var(--brand)', background: 'var(--brand-100)', padding: '4px 10px', borderRadius: 99, fontWeight: 500, whiteSpace: 'nowrap' }}>
              {aiMsg || importMsg}
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
        <table style={{ minWidth: 980 }}>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  style={{ cursor: 'pointer' }} />
              </th>
              {[
                ['Name'],['Title'],['Company'],
                ['Score','center'],['ICP','center'],
                ['Email'],['Industry'],
                ['LinkedIn','center'],['Contacted','center'],['AI Actions','center'],
              ].map(([h, align]) => (
                <th key={h} style={{ whiteSpace: 'nowrap', textAlign: align || 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 48, color: 'var(--ash)' }}>Loading…</td></tr>
            )}
            {!loading && leads.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 48 }}>
                <div style={{ color: 'var(--concrete)', fontSize: 13 }}>No leads yet.</div>
                <div style={{ color: 'var(--ash)', fontSize: 12, marginTop: 4 }}>Import a CSV or sync from the Chrome extension to get started.</div>
              </td></tr>
            )}
            {leads.map(lead => {
              const isNew = lead.importedAt && (Date.now() - new Date(lead.importedAt).getTime()) < 24 * 60 * 60 * 1000;
              return (
              <tr key={lead._id} style={{ background: selected.has(lead._id) ? 'rgba(107,94,205,.04)' : undefined }}>
                <td>
                  <input type="checkbox" checked={selected.has(lead._id)} onChange={() => toggleSelect(lead._id)}
                    style={{ cursor: 'pointer' }} />
                </td>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {lead.fullName}
                    {isNew && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#16a34a', borderRadius: 99, padding: '1px 7px', letterSpacing: '.03em', flexShrink: 0 }}>
                        NEW
                      </span>
                    )}
                  </span>
                </td>
                <td><div style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--concrete)' }} title={lead.currentJob}>{lead.currentJob || '—'}</div></td>
                <td><div style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.companyName || '—'}</div></td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`pill ${scoreClass(lead.icpScore)}`} title={lead.scoreReason}>
                    {lead.icpScore ?? '—'}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}><span className={`badge ${icpClass(lead.matchesIcp)}`}>{lead.matchesIcp || '—'}</span></td>
                <td><div style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--concrete)' }}>{lead.emailGuess || '—'}</div></td>
                <td>{lead.industryTag && <span className="badge badge-purple">{lead.industryTag}</span>}</td>
                <td style={{ textAlign: 'center' }}>
                  {lead.linkedinUrl
                    ? <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>LinkedIn ↗</a>
                    : lead.salesNavUrl
                      ? <a href={lead.salesNavUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--concrete)' }}>Sales Nav ↗</a>
                      : <span style={{ color: 'var(--ash)' }}>—</span>}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button className={`badge ${lead.contacted ? 'badge-green' : 'badge-gray'}`}
                    style={{ border: 'none', cursor: 'pointer' }} onClick={() => toggleContacted(lead)}>
                    {lead.contacted ? '✓ Done' : 'Mark'}
                  </button>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <AIBtn title="Score this lead" onClick={() => handleScoreOne(lead)}>🎯</AIBtn>
                    <AIBtn title="Enrich missing fields" onClick={() => handleEnrichOne(lead)}>✨</AIBtn>
                    <AIBtn title="Generate outreach message" onClick={() => handleOutreachOne(lead)}>✉</AIBtn>
                  </div>
                </td>
              </tr>
              );
            })}
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

    // camel() preserves first-char case, so evaboot headers like "Full Name" → "FullName"
    const fullName = obj.fullName || obj.FullName ||
      ((obj.firstName || obj.FirstName || '') + ' ' + (obj.lastName || obj.LastName || '')).trim() ||
      obj.name || '';

    const firstName = obj.firstName || obj.FirstName || fullName.split(' ')[0] || '';
    const lastName  = obj.lastName  || obj.LastName  || fullName.split(' ').slice(1).join(' ') || '';

    // Evaboot "Matches Filters" → MatchesFilters = 'YES' when lead matches
    const rawMF = (obj.MatchesFilters || obj.matchesFilters || '').toUpperCase();
    const matchesIcp = obj.matchesIcp || (rawMF === 'YES' ? 'YES' : '') || undefined;

    // Evaboot salesNavUrl may have a trailing comma inside the URL value
    const rawSalesNavUrl = (obj.salesNavUrl || obj.SalesNavigatorURL || '').replace(/,+$/, '');

    const lead = {
      fullName,
      firstName,
      lastName,
      currentJob:    obj.currentJob || obj.CurrentJob || obj.title || '',
      companyName:   obj.companyName || obj.CompanyName || obj.company || '',
      linkedinUrl:   obj.linkedinUrl || obj.LinkedInURL || obj.profileUrl || '',
      salesNavUrl:   rawSalesNavUrl,
      location:      obj.location || obj.Location || '',
      emailGuess:    obj.emailGuess || obj.Email || '',
      icpScore:      obj.icpScore ? Number(obj.icpScore) : null,
      scoreReason:   obj.scoreReason || '',
      outreachAngle: obj.outreachAngle || '',
      platformGuess: obj.platformGuess || '',
      industryTag:   obj.industryTag || obj.CompanyIndustry || obj.ProfileIndustry || obj.industry || '',
      headline:      obj.headline || obj.ProfileHeadline || '',
      summary:       obj.summary || obj.ProfileSummary || '',
      jobDescription: obj.jobDescription || obj.JobDescription || '',
      companySize:   obj.companySize || obj.CompanyEmployeeRange || '',
      companyDomain: obj.companyDomain || obj.CompanyDomain || '',
      companyWebsite: obj.companyWebsite || obj.CompanyWebsiteURL || '',
      companyIndustry: obj.companyIndustry || obj.CompanyIndustry || '',
      companyType:   obj.companyType || obj.CompanyType || '',
      companyLocation: obj.companyLocation || obj.CompanyLocation || '',
      companyFounded: obj.companyFounded || obj.CompanyYearFounded || '',
      companyDescription: obj.companyDescription || obj.CompanyDescription || '',
      companySpecialities: obj.companySpecialities || obj.CompanySpecialities || '',
      companyLogo:   obj.companyLogo || obj.CompanyProfilePicture || '',
      profilePicture: obj.profilePicture || obj.ProfilePicture || '',
      connections:   obj.connections || obj.Connections ? Number(obj.connections || obj.Connections) || null : null,
      yearsInPosition: obj.yearsInPosition || obj.YearsInPosition ? Number(obj.yearsInPosition || obj.YearsInPosition) || null : null,
      monthsInPosition: obj.monthsInPosition || obj.MonthsInPosition ? Number(obj.monthsInPosition || obj.MonthsInPosition) || null : null,
      isOpenToWork:  obj.IsOpenToWork === 'TRUE' || obj.isOpenToWork === 'true' || false,
      isPremium:     obj.IsPremium === 'TRUE' || obj.isPremium === 'true' || false,
      source:        'csv-import',
    };

    if (matchesIcp) lead.matchesIcp = matchesIcp;
    return lead;
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
