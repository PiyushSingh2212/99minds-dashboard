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
  $('extractBtn').textContent = 'Extracting…';
  showResult('', '');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let injection;
  try {
    [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func:   extractLeadsFromPage,
    });
  } catch {
    showResult('error', 'Could not run extractor. Refresh the LinkedIn page and try again.');
    resetExtractBtn();
    return;
  }

  const leads = injection?.result;
  if (!leads?.length) {
    showResult('error', 'No leads found on this page. Scroll down to load results first.');
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

// ── Injected content function (runs in page context, no chrome API access) ───
function extractLeadsFromPage() {
  const isSalesNav = location.href.includes('/sales/search/people');
  const leads = [];
  const seen  = new Set();

  // Build map of salesNavLeadId → LinkedIn publicIdentifier from embedded <code> JSON
  function buildProfileMap() {
    const map = {};
    document.querySelectorAll('code').forEach(code => {
      try {
        const text = code.textContent;
        if (!text.includes('publicIdentifier')) return;
        const matches = [...text.matchAll(/"publicIdentifier"\s*:\s*"([^"]+)"/g)];
        matches.forEach(m => {
          const slug = m[1];
          const ctx  = text.substring(Math.max(0, m.index - 1200), m.index + 200);
          const idMatch = ctx.match(/ACw[A-Za-z0-9+/_-]{20,}/);
          if (idMatch) map[idMatch[0]] = slug;
        });
      } catch {}
    });
    return map;
  }

  if (isSalesNav) {
    const profMap = buildProfileMap();
    // Sales Nav uses /sales/lead/ in search results, /sales/people/ on profile pages
    const salesLinks = [
      ...document.querySelectorAll('a[href*="/sales/lead/"]'),
      ...document.querySelectorAll('a[href*="/sales/people/"]'),
    ];

    salesLinks.forEach((link) => {
      const salesNavUrl = link.href?.split('?')[0];
      if (!salesNavUrl || seen.has(salesNavUrl)) return;
      // Skip nav/sidebar links — real result links are inside list items
      const card = link.closest('li') || link.closest('[data-entity-urn]') ||
                   link.closest('[class*="result"]') || link.parentElement;
      if (!card) return;
      seen.add(salesNavUrl);

      // Name: prefer a span inside the link, fall back to link text
      let fullName = '';
      const spans = [...link.querySelectorAll('span')].filter(s => !s.querySelector('span'));
      for (const s of spans) {
        const t = s.textContent.trim().replace(/\s+/g, ' ');
        if (t.length > 1 && t.length < 70) { fullName = t; break; }
      }
      if (!fullName) fullName = link.textContent.trim().replace(/\s+/g, ' ').split('\n')[0];
      if (!fullName || fullName.length > 70) return;

      // Resolve actual LinkedIn /in/ URL via profile map, fall back to DOM search
      const leadId = salesNavUrl.split('/sales/lead/')[1]?.split(',')[0]
                  || salesNavUrl.split('/sales/people/')[1]?.split(',')[0];
      const slug   = leadId ? profMap[leadId] : null;
      const linkedinUrl = slug
        ? `https://www.linkedin.com/in/${slug}`
        : (card.querySelector('a[href*="linkedin.com/in/"]')?.href?.split('?')[0] || '');

      let jobTitle = '', company = '', location = '';
      const texts = [...card.querySelectorAll('span, dd, p')]
        .map((el) => el.textContent.trim().replace(/\s+/g, ' '))
        .filter((t) => t.length > 1 && t.length < 120 && t !== fullName && !t.includes(fullName));

      if (texts[0]) jobTitle = texts[0];
      if (jobTitle.includes(' at ')) {
        const idx = jobTitle.lastIndexOf(' at ');
        company   = jobTitle.substring(idx + 4).trim();
        jobTitle  = jobTitle.substring(0, idx).trim();
      } else if (texts[1]) {
        company = texts[1];
      }
      if (texts[2] && texts[2] !== jobTitle && texts[2] !== company) location = texts[2];

      const parts = fullName.split(' ');
      leads.push({
        firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '',
        fullName, currentJob: jobTitle, companyName: company, location,
        linkedinUrl, salesNavUrl, source: 'sales-navigator',
      });
    });

  } else {
    let cards = [...document.querySelectorAll('[data-view-name="search-entity-result-universal-template"]')];
    if (!cards.length) cards = [...document.querySelectorAll('.entity-result')];

    if (!cards.length) {
      // Heuristic fallback: find profile links, walk up to card container
      document.querySelectorAll('a[href*="/in/"]').forEach((link) => {
        const profileUrl = link.href?.split('?')[0];
        if (!profileUrl || seen.has(profileUrl)) return;
        const card = link.closest('li') || link.closest('[class*="result"]') || link.parentElement;
        if (!card) return;
        seen.add(profileUrl);
        const lead = parseCard(card, link);
        if (lead) leads.push(lead);
      });
      return leads;
    }

    cards.forEach((card) => {
      const lead = parseCard(card);
      if (!lead) return;
      const k = lead.linkedinUrl || lead.fullName;
      if (seen.has(k)) return;
      seen.add(k);
      leads.push(lead);
    });
  }

  return leads;

  function parseCard(card, hintLink) {
    const profileLink =
      hintLink ||
      card.querySelector('a[href*="/in/"]') ||
      card.querySelector('a.app-aware-link');
    const profileUrl = profileLink?.href?.split('?')[0] || '';
    if (!profileUrl) return null;

    let fullName = '';
    const selectors = [
      '.entity-result__title-text a span[aria-hidden="true"]',
      'span[aria-hidden="true"]',
      '.entity-result__title-text',
      '[class*="title"] span',
      'span[dir="ltr"]',
    ];
    for (const sel of selectors) {
      const el = card.querySelector(sel);
      const t  = el?.textContent?.trim();
      if (t && t.length > 1 && t.length < 80 && !t.includes('LinkedIn')) { fullName = t; break; }
    }
    if (!fullName && profileLink) fullName = profileLink.textContent.trim().split('\n')[0].trim();
    if (!fullName) return null;

    const titleEl    = card.querySelector('.entity-result__primary-subtitle') || card.querySelector('[class*="primary-subtitle"]');
    const locationEl = card.querySelector('.entity-result__secondary-subtitle') || card.querySelector('[class*="secondary-subtitle"]');
    const titleText  = titleEl?.textContent?.trim() || '';
    const location   = locationEl?.textContent?.trim() || '';
    const atIdx      = titleText.lastIndexOf(' at ');
    const jobTitle   = atIdx > -1 ? titleText.substring(0, atIdx).trim() : titleText;
    const company    = atIdx > -1 ? titleText.substring(atIdx + 4).trim() : '';

    const parts = fullName.split(' ');
    return {
      firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '',
      fullName, currentJob: jobTitle, companyName: company, location,
      linkedinUrl: profileUrl, source: 'linkedin-search',
    };
  }
}
