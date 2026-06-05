/* Leadvault content script v3
   Runs in isolated world on LinkedIn search pages.
   Primary:  accumulates leads from injected.js (API intercept via postMessage)
   Fallback: DOM scraping + auto-scroll when no API leads are captured */
(function () {
  if (document.getElementById('lv-fab')) return;

  const isSalesNav = location.href.includes('/sales/');
  const rand  = (a, b) => a + Math.floor(Math.random() * (b - a));
  const delay = (ms)   => new Promise(r => setTimeout(r, ms));

  /* ── Lead accumulator ─────────────────────────────────────────────────────── */
  const captured = new Map(); // dedup key → lead

  function leadKey(l) {
    return l.linkedinUrl || l.salesNavUrl ||
           `${l.firstName}|${l.lastName}|${l.companyName || ''}`;
  }

  function addLeads(leads) {
    let added = 0;
    for (const l of leads) {
      const k = leadKey(l);
      if (k && !captured.has(k)) { captured.set(k, l); added++; }
    }
    if (added) updateFabLabel();
  }

  // Receive intercepted leads from injected.js (MAIN world → isolated world)
  window.addEventListener('message', async (e) => {
    if (e.source !== window || e.data?.type !== 'LV_LEADS') return;
    const incoming = e.data.leads || [];
    if (!incoming.length) return;

    // For leads missing LinkedIn URL, ask background to resolve via Sales Nav profile API
    const missing = incoming.filter(l => !l.linkedinUrl && l.entityUrn);
    if (missing.length) {
      try {
        const resp = await new Promise(resolve =>
          chrome.runtime.sendMessage({ action: 'resolveLinkedInUrls', leads: missing }, resolve)
        );
        if (resp?.ok && resp.resolved) {
          for (const lead of incoming) {
            if (!lead.linkedinUrl && lead.salesNavUrl && resp.resolved[lead.salesNavUrl]) {
              lead.linkedinUrl = resp.resolved[lead.salesNavUrl];
            }
          }
        }
      } catch (_) {}
    }

    addLeads(incoming);
  });

  // Popup or other parts of extension can ask for accumulated leads
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'getInterceptedLeads') {
      sendResponse([...captured.values()]); return true;
    }
    if (msg.action === 'clearLeads') {
      captured.clear(); updateFabLabel(); sendResponse({ ok: true }); return true;
    }
  });

  /* ── FAB shell ────────────────────────────────────────────────────────────── */
  const wrap = document.createElement('div');
  wrap.id = 'lv-fab';
  Object.assign(wrap.style, {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: '99999',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px',
  });

  const toast = document.createElement('div');
  Object.assign(toast.style, {
    background: '#0a0a0a', color: '#e5e5e5', borderRadius: '10px',
    padding: '9px 14px', fontSize: '12px', fontWeight: '500', lineHeight: '1.5',
    display: 'none', maxWidth: '260px', boxShadow: '0 4px 16px rgba(0,0,0,.35)',
  });

  const btn = document.createElement('button');
  Object.assign(btn.style, {
    background: '#a8f040', color: '#0a0a0a', border: 'none', borderRadius: '24px',
    padding: '10px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(168,240,64,.45)',
    transition: 'transform .15s, background .15s, box-shadow .15s',
    whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '7px',
  });

  wrap.appendChild(toast);
  wrap.appendChild(btn);
  document.body.appendChild(wrap);

  btn.addEventListener('mouseenter', () => { btn.style.transform = 'translateY(-2px)'; });
  btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });

  /* ── FAB state ────────────────────────────────────────────────────────────── */
  const STATES = {
    idle:       ['#a8f040', 'rgba(168,240,64,.45)'],
    extracting: ['#fbbf24', 'rgba(251,191,36,.45)'],
    syncing:    ['#60a5fa', 'rgba(96,165,250,.45)'],
    success:    ['#34d399', 'rgba(52,211,153,.45)'],
    error:      ['#f87171', 'rgba(248,113,113,.45)'],
  };

  function setBtn(state, label) {
    const [bg, sh] = STATES[state] || STATES.idle;
    btn.style.background = bg;
    btn.style.boxShadow  = `0 4px 16px ${sh}`;
    btn.textContent = label;
  }

  function updateFabLabel() {
    const n = captured.size;
    setBtn('idle', n > 0 ? `⬆ Sync ${n} Leads` : '⬆ Extract Leads');
  }

  function showToast(msg) { toast.textContent = msg; toast.style.display = 'block'; }
  function hideToast()    { toast.style.display = 'none'; }

  updateFabLabel();

  /* ── Click handler ────────────────────────────────────────────────────────── */
  let busy = false;

  btn.addEventListener('click', async () => {
    if (busy) return;

    const { dashUrl, apiKey } = await chrome.storage.local.get(['dashUrl', 'apiKey']);
    if (!dashUrl || !apiKey) {
      setBtn('error', '✗ No settings');
      showToast('Open the Leadvault popup to configure your Dashboard URL and API key.');
      setTimeout(() => { updateFabLabel(); hideToast(); }, 4500);
      return;
    }

    busy = true;
    hideToast();

    // ── Primary: use API-intercepted leads ─────────────────────────────────────
    let leads = [...captured.values()];

    // ── Fallback: DOM scraping with auto-scroll ────────────────────────────────
    if (!leads.length) {
      setBtn('extracting', 'Extracting… (0 found)');
      try {
        leads = await scrollAndExtract((n) => setBtn('extracting', `Extracting… (${n} found)`));
      } catch {
        setBtn('error', '✗ Extraction failed');
        showToast('Could not read the page. Refresh LinkedIn and try again.');
        setTimeout(() => { updateFabLabel(); hideToast(); }, 4500);
        busy = false;
        return;
      }
    }

    if (!leads.length) {
      setBtn('error', '✗ No leads found');
      showToast('No profiles detected. Scroll through search results first so LinkedIn loads the data, then try again.');
      setTimeout(() => { updateFabLabel(); hideToast(); }, 5500);
      busy = false;
      return;
    }

    const count = leads.length;
    setBtn('syncing', `Syncing ${count} leads…`);

    try {
      const resp = await chrome.runtime.sendMessage({ action: 'importLeads', leads, dashUrl, apiKey });
      if (resp?.ok) {
        setBtn('success', `✓ ${count} synced`);
        showToast(`${count} leads synced → ${resp.inserted ?? 0} new, ${resp.updated ?? 0} updated.\nOpen your dashboard to view them.`);
        captured.clear(); // reset after successful sync
      } else {
        setBtn('error', '✗ Sync failed');
        showToast(resp?.error || 'Import failed. Check your API key in the Leadvault popup.');
      }
    } catch {
      setBtn('error', '✗ Network error');
      showToast('Could not reach the dashboard. Check your settings in the popup.');
    }

    setTimeout(() => { updateFabLabel(); hideToast(); }, 6000);
    busy = false;
  });

  /* ── DOM Fallback: scroll + extract ──────────────────────────────────────── */

  async function scrollAndExtract(onProgress) {
    const seen = new Map();
    const add  = (batch) => {
      let n = 0;
      for (const l of batch) {
        const k = l.linkedinUrl || (l.firstName + l.lastName + (l.companyName || ''));
        if (k && !seen.has(k)) { seen.set(k, l); n++; }
      }
      return n;
    };
    add(extractVisible());
    onProgress(seen.size);
    let stable = 0;
    for (let i = 0; i < 18 && stable < 2; i++) {
      window.scrollBy({ top: Math.floor(window.innerHeight * (0.65 + Math.random() * 0.3)), behavior: 'smooth' });
      await delay(rand(1400, 2800));
      if (add(extractVisible()) === 0) stable++; else stable = 0;
      onProgress(seen.size);
      if (i % 4 === 3) { window.scrollBy({ top: -rand(80, 160), behavior: 'smooth' }); await delay(rand(400, 800)); }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return [...seen.values()];
  }

  function extractVisible() {
    return isSalesNav ? extractSalesNav() : extractLinkedIn();
  }

  /* ── DOM: LinkedIn people search ─────────────────────────────────────────── */
  function extractLinkedIn() {
    const leads = []; const seen = new Set();
    let cards = [...document.querySelectorAll('[data-view-name="search-entity-result-universal-template"]')];
    if (!cards.length) cards = [...document.querySelectorAll('.entity-result')];
    if (!cards.length) {
      document.querySelectorAll('a[href*="/in/"]').forEach(link => {
        const url = link.href?.split('?')[0];
        if (!url || seen.has(url)) return;
        const card = link.closest('li') || link.closest('[class*="result"]') || link.parentElement;
        if (!card) return;
        seen.add(url);
        const l = parseLinkedInCard(card, link);
        if (l) leads.push(l);
      });
      return leads;
    }
    cards.forEach(card => {
      const l = parseLinkedInCard(card);
      if (!l) return;
      const k = l.linkedinUrl || l.fullName;
      if (seen.has(k)) return;
      seen.add(k); leads.push(l);
    });
    return leads;
  }

  function parseLinkedInCard(card, hint) {
    try {
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
      const sub  = card.querySelector('.entity-result__primary-subtitle,[class*="primary-subtitle"]')?.textContent?.trim() || '';
      const loc  = card.querySelector('.entity-result__secondary-subtitle,[class*="secondary-subtitle"]')?.textContent?.trim() || '';
      const at   = sub.lastIndexOf(' at ');
      const parts = fullName.split(' ');
      return {
        firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '', fullName,
        currentJob:  at > -1 ? sub.slice(0, at).trim() : sub,
        companyName: at > -1 ? sub.slice(at + 4).trim() : '',
        location: loc, linkedinUrl: url, source: 'linkedin-dom',
      };
    } catch { return null; }
  }

  /* ── DOM: Sales Navigator search ─────────────────────────────────────────── */
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

  function extractSalesNav() {
    const leads = []; const seen = new Set();
    const profMap = buildProfileMap();
    const links = [
      ...document.querySelectorAll('a[href*="/sales/lead/"]'),
      ...document.querySelectorAll('a[href*="/sales/people/"]'),
    ];
    links.forEach(link => {
      const snu = link.href?.split('?')[0];
      if (!snu || seen.has(snu)) return;
      const card = link.closest('li') || link.closest('[data-entity-urn]') ||
                   link.closest('[class*="result"]') || link.parentElement;
      if (!card) return;
      seen.add(snu);
      const leadId = snu.split('/sales/lead/')[1]?.split(',')[0] || snu.split('/sales/people/')[1]?.split(',')[0];
      const slug   = leadId ? profMap[leadId] : null;
      const liu    = slug ? `https://www.linkedin.com/in/${slug}`
                          : (card.querySelector('a[href*="linkedin.com/in/"]')?.href?.split('?')[0] || '');
      const l = parseSalesNavCard(card, link, snu, liu);
      if (l) leads.push(l);
    });
    // entity-urn fallback
    if (!leads.length) {
      document.querySelectorAll('[data-entity-urn*="member"]').forEach(card => {
        const link = card.querySelector('a[href*="/sales/lead/"]') ||
                     card.querySelector('a[href*="/sales/people/"]') ||
                     card.querySelector('a[href*="/in/"]');
        const snu  = link?.href?.split('?')[0];
        if (!snu || seen.has(snu)) return;
        seen.add(snu);
        const id   = snu.split('/sales/lead/')[1]?.split(',')[0];
        const slug = id ? profMap[id] : null;
        const liu  = slug ? `https://www.linkedin.com/in/${slug}` : '';
        const l = parseSalesNavCard(card, link, snu, liu);
        if (l) leads.push(l);
      });
    }
    return leads;
  }

  function parseSalesNavCard(card, link, salesNavUrl, linkedinUrl = '') {
    try {
      let fullName = '';
      const spans = [...link.querySelectorAll('span')].filter(s => !s.querySelector('span'));
      for (const s of spans) {
        const t = s.textContent.trim().replace(/\s+/g, ' ');
        if (t.length > 1 && t.length < 70) { fullName = t; break; }
      }
      if (!fullName) fullName = link.textContent.trim().replace(/\s+/g, ' ').split('\n')[0];
      if (!fullName || fullName.length > 70) return null;
      const texts = [...card.querySelectorAll('span,dt,dd,p')]
        .map(el => el.textContent.trim().replace(/\s+/g, ' '))
        .filter(t => t.length > 1 && t.length < 120 && t !== fullName && !t.includes(fullName));
      let jobTitle = texts[0] || '', company = '', location = '';
      if (jobTitle.includes(' at ')) {
        const i = jobTitle.lastIndexOf(' at ');
        company  = jobTitle.slice(i + 4).trim();
        jobTitle = jobTitle.slice(0, i).trim();
      } else if (texts[1]) { company = texts[1]; }
      if (texts[2] && texts[2] !== jobTitle && texts[2] !== company) location = texts[2];
      const parts = fullName.split(' ');
      return {
        firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '', fullName,
        currentJob: jobTitle, companyName: company, location,
        linkedinUrl, salesNavUrl, source: 'sales-navigator-dom',
      };
    } catch { return null; }
  }
})();
