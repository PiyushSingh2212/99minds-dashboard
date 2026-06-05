const $ = (id) => document.getElementById(id);

async function loadSettings() {
  const { dashUrl = '', apiKey = '' } = await chrome.storage.local.get(['dashUrl', 'apiKey']);
  $('dashUrl').value = dashUrl;
  $('apiKey').value  = apiKey;
  if (dashUrl) $('dashLink').href = dashUrl.replace('/api', '').replace(/\/$/, '');
  return { dashUrl, apiKey };
}

async function testConnection(dashUrl, apiKey) {
  try {
    const res = await fetch(`${dashUrl}/health`, { headers: { 'x-api-key': apiKey } });
    return res.ok;
  } catch { return false; }
}

function setStatus(state, text) {
  $('statusBar').className = `status-bar ${state}`;
  $('statusDot').className = `dot ${state === 'connected' ? 'green' : state === 'error' ? 'red' : 'amber'}`;
  $('statusText').textContent = text;
}

function showResult(type, msg) {
  const el = $('result');
  el.className   = `result ${type}`;
  el.textContent = msg;
}

async function checkCurrentTab() {
  const [tab]     = await chrome.tabs.query({ active: true, currentWindow: true });
  const url       = tab?.url || '';
  const supported = url.includes('linkedin.com/search/results/people') ||
                    url.includes('linkedin.com/sales/search/people');
  $('extractBtn').disabled           = !supported;
  $('pageHint').style.display        = supported ? 'none' : 'block';
  return supported;
}

// ── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  const { dashUrl, apiKey } = await loadSettings();
  await checkCurrentTab();

  if (dashUrl && apiKey) {
    setStatus('disconnected', 'Checking connection…');
    const ok = await testConnection(dashUrl, apiKey);
    setStatus(ok ? 'connected' : 'error',
      ok ? `Connected to ${new URL(dashUrl).hostname}` : 'Cannot reach dashboard');
    if (ok) $('extractBtn').disabled = !(await checkCurrentTab());
  }
})();

// ── Save & Test ───────────────────────────────────────────────────────────────
$('saveBtn').addEventListener('click', async () => {
  const dashUrl = $('dashUrl').value.trim().replace(/\/$/, '');
  const apiKey  = $('apiKey').value.trim();
  if (!dashUrl || !apiKey) { setStatus('disconnected', 'Enter both fields'); return; }

  await chrome.storage.local.set({ dashUrl, apiKey });
  $('dashLink').href = dashUrl.replace('/api', '').replace(/\/$/, '');
  setStatus('disconnected', 'Testing connection…');
  const ok = await testConnection(dashUrl, apiKey);
  setStatus(ok ? 'connected' : 'error',
    ok ? `Connected to ${new URL(dashUrl).hostname}` : 'Cannot reach dashboard — check URL / key');

  if (ok) $('extractBtn').disabled = !(await checkCurrentTab());
});

// ── Extract ───────────────────────────────────────────────────────────────────
$('extractBtn').addEventListener('click', async () => {
  const { dashUrl, apiKey } = await chrome.storage.local.get(['dashUrl', 'apiKey']);
  if (!dashUrl || !apiKey) { showResult('error', 'Save settings first.'); return; }

  $('extractBtn').disabled    = true;
  $('extractBtn').textContent = 'Checking…';
  showResult('', '');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // ── Try API-intercepted leads from content script first ───────────────────
  let leads = [];
  try {
    leads = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action: 'getInterceptedLeads' }, (res) => {
        resolve(Array.isArray(res) ? res : []);
      });
    });
  } catch { leads = []; }

  // ── Fall back to legacy DOM scraping via executeScript ────────────────────
  if (!leads.length) {
    $('extractBtn').textContent = 'Extracting…';
    let injection;
    try {
      [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func:   extractLeadsFromPageDOM,
      });
    } catch {
      showResult('error', 'Could not run extractor. Refresh the LinkedIn page and try again.');
      resetExtractBtn();
      return;
    }
    leads = injection?.result || [];
  }

  if (!leads.length) {
    showResult('error', 'No leads found. Scroll through search results first, then try again.');
    resetExtractBtn();
    return;
  }

  try {
    const res  = await fetch(`${dashUrl}/leads/import`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body:    JSON.stringify({ leads }),
    });
    const data = await res.json();
    if (res.ok) {
      showResult('success', `✓ ${leads.length} leads synced (${data.inserted ?? 0} new, ${data.updated ?? 0} updated)`);
      // Clear content script accumulator after successful sync
      chrome.tabs.sendMessage(tab.id, { action: 'clearLeads' });
    } else {
      showResult('error', data.error || 'Import failed.');
    }
  } catch {
    showResult('error', 'Network error — is the backend running?');
  }

  resetExtractBtn();
});

function resetExtractBtn() {
  $('extractBtn').disabled    = false;
  $('extractBtn').textContent = 'Extract Leads from This Page';
}

// ── DOM-only fallback (injected via scripting.executeScript) ─────────────────
function extractLeadsFromPageDOM() {
  const isSalesNav = location.href.includes('/sales/search/people');
  const leads = [];
  const seen  = new Set();

  function buildProfileMap() {
    const map = {};
    document.querySelectorAll('code').forEach(code => {
      try {
        const text = code.textContent;
        if (!text.includes('publicIdentifier')) return;
        [...text.matchAll(/"publicIdentifier"\s*:\s*"([^"]+)"/g)].forEach(m => {
          const ctx = text.substring(Math.max(0, m.index - 1200), m.index + 200);
          const id  = ctx.match(/ACw[A-Za-z0-9+/_-]{20,}/);
          if (id) map[id[0]] = m[1];
        });
      } catch {}
    });
    return map;
  }

  if (isSalesNav) {
    const profMap = buildProfileMap();
    [...document.querySelectorAll('a[href*="/sales/lead/"]'),
     ...document.querySelectorAll('a[href*="/sales/people/"]')].forEach(link => {
      const snu = link.href?.split('?')[0];
      if (!snu || seen.has(snu)) return;
      const card = link.closest('li') || link.closest('[data-entity-urn]') ||
                   link.closest('[class*="result"]') || link.parentElement;
      if (!card) return;
      seen.add(snu);
      let fullName = '';
      const spans = [...link.querySelectorAll('span')].filter(s => !s.querySelector('span'));
      for (const s of spans) {
        const t = s.textContent.trim().replace(/\s+/g, ' ');
        if (t.length > 1 && t.length < 70) { fullName = t; break; }
      }
      if (!fullName) fullName = link.textContent.trim().replace(/\s+/g, ' ').split('\n')[0];
      if (!fullName || fullName.length > 70) return;
      const leadId = snu.split('/sales/lead/')[1]?.split(',')[0] || snu.split('/sales/people/')[1]?.split(',')[0];
      const slug   = leadId ? profMap[leadId] : null;
      const liu    = slug ? `https://www.linkedin.com/in/${slug}`
                          : (card.querySelector('a[href*="linkedin.com/in/"]')?.href?.split('?')[0] || '');
      const texts = [...card.querySelectorAll('span,dd,p')]
        .map(el => el.textContent.trim().replace(/\s+/g, ' '))
        .filter(t => t.length > 1 && t.length < 120 && t !== fullName && !t.includes(fullName));
      let job = texts[0] || '', co = '', loc = '';
      if (job.includes(' at ')) { const i = job.lastIndexOf(' at '); co = job.slice(i+4).trim(); job = job.slice(0,i).trim(); }
      else if (texts[1]) co = texts[1];
      if (texts[2] && texts[2] !== job && texts[2] !== co) loc = texts[2];
      const p = fullName.split(' ');
      leads.push({ firstName: p[0]||'', lastName: p.slice(1).join(' ')||'', fullName,
        currentJob: job, companyName: co, location: loc, linkedinUrl: liu, salesNavUrl: snu, source: 'sales-navigator-dom' });
    });
  } else {
    let cards = [...document.querySelectorAll('[data-view-name="search-entity-result-universal-template"]')];
    if (!cards.length) cards = [...document.querySelectorAll('.entity-result')];
    if (!cards.length) {
      document.querySelectorAll('a[href*="/in/"]').forEach(link => {
        const url = link.href?.split('?')[0];
        if (!url || seen.has(url)) return;
        const card = link.closest('li') || link.closest('[class*="result"]') || link.parentElement;
        if (!card) return;
        seen.add(url);
        const l = parseCard(card, link);
        if (l) leads.push(l);
      });
      return leads;
    }
    cards.forEach(card => {
      const l = parseCard(card);
      if (!l) return;
      const k = l.linkedinUrl || l.fullName;
      if (seen.has(k)) return;
      seen.add(k); leads.push(l);
    });
  }
  return leads;

  function parseCard(card, hint) {
    const link = hint || card.querySelector('a[href*="/in/"]') || card.querySelector('a.app-aware-link');
    const url  = link?.href?.split('?')[0] || '';
    if (!url) return null;
    let fullName = '';
    for (const sel of ['.entity-result__title-text a span[aria-hidden="true"]','span[aria-hidden="true"]','.entity-result__title-text','[class*="title"] span','span[dir="ltr"]']) {
      const t = card.querySelector(sel)?.textContent?.trim();
      if (t && t.length > 1 && t.length < 80 && !t.includes('LinkedIn')) { fullName = t; break; }
    }
    if (!fullName) fullName = link?.textContent?.trim().split('\n')[0].trim() || '';
    if (!fullName) return null;
    const sub = card.querySelector('.entity-result__primary-subtitle,[class*="primary-subtitle"]')?.textContent?.trim() || '';
    const loc = card.querySelector('.entity-result__secondary-subtitle,[class*="secondary-subtitle"]')?.textContent?.trim() || '';
    const at  = sub.lastIndexOf(' at ');
    const p   = fullName.split(' ');
    return { firstName: p[0]||'', lastName: p.slice(1).join(' ')||'', fullName,
      currentJob: at>-1?sub.slice(0,at).trim():sub, companyName: at>-1?sub.slice(at+4).trim():'',
      location: loc, linkedinUrl: url, source: 'linkedin-dom' };
  }
}
