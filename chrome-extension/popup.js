const $ = (id) => document.getElementById(id);

async function loadSettings() {
  const { dashUrl = '', apiKey = '' } = await chrome.storage.local.get(['dashUrl', 'apiKey']);
  $('dashUrl').value = dashUrl;
  $('apiKey').value  = apiKey;
  if (dashUrl) {
    $('dashLink').href = dashUrl.replace('/api', '').replace(/\/$/, '');
  }
  return { dashUrl, apiKey };
}

async function testConnection(dashUrl, apiKey) {
  try {
    const res = await fetch(`${dashUrl}/health`, {
      headers: { 'x-api-key': apiKey },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function setStatus(state, text) {
  const bar  = $('statusBar');
  const dot  = $('statusDot');
  const span = $('statusText');
  bar.className  = `status-bar ${state}`;
  dot.className  = `dot ${state === 'connected' ? 'green' : state === 'error' ? 'red' : 'amber'}`;
  span.textContent = text;
}

function showResult(type, msg) {
  const el = $('result');
  el.className = `result ${type}`;
  el.textContent = msg;
}

async function checkCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isLinkedIn = tab?.url?.includes('linkedin.com/search/results/people');
  $('extractBtn').disabled = !isLinkedIn;
  $('pageHint').style.display = isLinkedIn ? 'none' : 'block';
  return isLinkedIn;
}

// ── Init ────────────────────────────────────────────────────────────────────
(async () => {
  const { dashUrl, apiKey } = await loadSettings();
  await checkCurrentTab();

  if (dashUrl && apiKey) {
    setStatus('disconnected', 'Checking connection…');
    const ok = await testConnection(dashUrl, apiKey);
    setStatus(ok ? 'connected' : 'error', ok ? `Connected to ${new URL(dashUrl).hostname}` : 'Cannot reach dashboard');
  }
})();

// ── Save & Test ─────────────────────────────────────────────────────────────
$('saveBtn').addEventListener('click', async () => {
  const dashUrl = $('dashUrl').value.trim().replace(/\/$/, '');
  const apiKey  = $('apiKey').value.trim();
  if (!dashUrl || !apiKey) { setStatus('disconnected', 'Enter both fields'); return; }

  await chrome.storage.local.set({ dashUrl, apiKey });
  $('dashLink').href = dashUrl.replace('/api', '').replace(/\/$/, '');
  setStatus('disconnected', 'Testing connection…');
  const ok = await testConnection(dashUrl, apiKey);
  setStatus(ok ? 'connected' : 'error', ok ? `Connected to ${new URL(dashUrl).hostname}` : 'Cannot reach dashboard — check URL/key');
  $('extractBtn').disabled = !ok;
});

// ── Extract ─────────────────────────────────────────────────────────────────
$('extractBtn').addEventListener('click', async () => {
  const { dashUrl, apiKey } = await chrome.storage.local.get(['dashUrl', 'apiKey']);
  if (!dashUrl || !apiKey) { showResult('error', 'Save settings first.'); return; }

  $('extractBtn').disabled  = true;
  $('extractBtn').textContent = 'Extracting…';
  showResult('', '');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let leads;
  try {
    [leads] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractLeadsFromPage,
    });
  } catch (e) {
    showResult('error', 'Could not run extractor. Refresh the LinkedIn page and try again.');
    $('extractBtn').disabled  = false;
    $('extractBtn').textContent = 'Extract Leads from This Page';
    return;
  }

  if (!leads?.result?.length) {
    showResult('error', 'No leads found on this page. Scroll down to load more results first.');
    $('extractBtn').disabled  = false;
    $('extractBtn').textContent = 'Extract Leads from This Page';
    return;
  }

  try {
    const res = await fetch(`${dashUrl}/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ leads: leads.result }),
    });
    const data = await res.json();
    if (res.ok) {
      showResult('success', `✓ ${leads.result.length} leads synced to dashboard (${data.inserted ?? 0} new, ${data.updated ?? 0} updated)`);
    } else {
      showResult('error', data.error || 'Import failed.');
    }
  } catch {
    showResult('error', 'Network error — is the backend running?');
  }

  $('extractBtn').disabled  = false;
  $('extractBtn').textContent = 'Extract Leads from This Page';
});

// ── Content-script function (injected into page) ─────────────────────────────
function extractLeadsFromPage() {
  const cards = document.querySelectorAll('[data-view-name="search-entity-result-universal-template"]');
  const leads = [];

  cards.forEach((card) => {
    try {
      const nameEl    = card.querySelector('.entity-result__title-text a span[aria-hidden="true"]') ||
                        card.querySelector('.entity-result__title-text');
      const titleEl   = card.querySelector('.entity-result__primary-subtitle');
      const locationEl= card.querySelector('.entity-result__secondary-subtitle');
      const profileEl = card.querySelector('a.app-aware-link');
      const imgEl     = card.querySelector('img.presence-entity__image') ||
                        card.querySelector('img[alt]');

      const fullName = nameEl?.textContent?.trim() || '';
      if (!fullName) return;

      const nameParts  = fullName.split(' ');
      const firstName  = nameParts[0] || '';
      const lastName   = nameParts.slice(1).join(' ') || '';
      const title      = titleEl?.textContent?.trim()    || '';
      const location   = locationEl?.textContent?.trim() || '';
      const profileUrl = profileEl?.href?.split('?')[0]  || '';
      const avatar     = imgEl?.src || '';

      // Try to parse company from title (e.g. "Engineer at Acme Corp")
      const atIdx     = title.lastIndexOf(' at ');
      const jobTitle  = atIdx > -1 ? title.substring(0, atIdx).trim() : title;
      const company   = atIdx > -1 ? title.substring(atIdx + 4).trim() : '';

      leads.push({ firstName, lastName, fullName, jobTitle, companyName: company, location, profileUrl, avatar, source: 'linkedin-search' });
    } catch (_) {/* skip malformed card */}
  });

  return leads;
}
