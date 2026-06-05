/* Leadvault Lead Extractor — content script v2
   Runs on: LinkedIn People Search + Sales Navigator People Search */
(function () {
  if (document.getElementById('lv-fab')) return;

  const isSalesNav = location.href.includes('/sales/search/people');
  const rand = (min, max) => min + Math.floor(Math.random() * (max - min));
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ─── FAB shell ──────────────────────────────────────────────── */
  const wrap = document.createElement('div');
  wrap.id = 'lv-fab';
  Object.assign(wrap.style, {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: '99999',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px',
  });

  const toast = document.createElement('div');
  Object.assign(toast.style, {
    background: '#0a0a0a', color: '#e5e5e5',
    borderRadius: '10px', padding: '9px 14px',
    fontSize: '12px', fontWeight: '500', lineHeight: '1.5',
    display: 'none', maxWidth: '240px',
    boxShadow: '0 4px 16px rgba(0,0,0,.35)',
  });

  const btn = document.createElement('button');
  Object.assign(btn.style, {
    background: '#a8f040', color: '#0a0a0a',
    border: 'none', borderRadius: '24px',
    padding: '10px 18px', fontSize: '13px', fontWeight: '600',
    cursor: 'pointer', boxShadow: '0 4px 16px rgba(168,240,64,.45)',
    transition: 'transform .15s, background .15s, box-shadow .15s',
    whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '7px',
  });

  wrap.appendChild(toast);
  wrap.appendChild(btn);
  document.body.appendChild(wrap);

  /* ─── FAB state helpers ───────────────────────────────────────── */
  const STATES = {
    idle:       ['#a8f040', 'rgba(168,240,64,.45)'],
    extracting: ['#fbbf24', 'rgba(251,191,36,.45)'],
    syncing:    ['#60a5fa', 'rgba(96,165,250,.45)'],
    success:    ['#34d399', 'rgba(52,211,153,.45)'],
    error:      ['#f87171', 'rgba(248,113,113,.45)'],
  };

  function setBtn(state, label) {
    const [bg, shadow] = STATES[state] || STATES.idle;
    btn.style.background = bg;
    btn.style.boxShadow  = `0 4px 16px ${shadow}`;
    btn.textContent = label;
  }

  function showToast(msg) { toast.textContent = msg; toast.style.display = 'block'; }
  function hideToast()    { toast.style.display = 'none'; }

  setBtn('idle', '⬆ Extract Leads');

  btn.addEventListener('mouseenter', () => { btn.style.transform = 'translateY(-2px)'; });
  btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });

  /* ─── DOM extraction ─────────────────────────────────────────── */

  function extractVisible() {
    return isSalesNav ? extractSalesNav() : extractLinkedIn();
  }

  function extractLinkedIn() {
    const leads = [];
    const seen  = new Set();

    // Strategy 1: stable data-view-name attr
    let cards = [...document.querySelectorAll('[data-view-name="search-entity-result-universal-template"]')];
    // Strategy 2: class fallback
    if (!cards.length) cards = [...document.querySelectorAll('.entity-result')];

    // Strategy 3: profile link heuristic
    if (!cards.length) {
      document.querySelectorAll('a[href*="/in/"]').forEach((link) => {
        const profileUrl = link.href?.split('?')[0];
        if (!profileUrl || seen.has(profileUrl)) return;
        const card = link.closest('li') || link.closest('[class*="result"]') || link.parentElement;
        if (!card) return;
        seen.add(profileUrl);
        const lead = parseLinkedInCard(card, link);
        if (lead) leads.push(lead);
      });
      return leads;
    }

    cards.forEach((card) => {
      const lead = parseLinkedInCard(card);
      if (!lead) return;
      const k = lead.linkedinUrl || lead.fullName;
      if (seen.has(k)) return;
      seen.add(k);
      leads.push(lead);
    });
    return leads;
  }

  function parseLinkedInCard(card, hintLink) {
    try {
      const profileLink =
        hintLink ||
        card.querySelector('a[href*="/in/"]') ||
        card.querySelector('a.app-aware-link');
      const profileUrl = profileLink?.href?.split('?')[0] || '';
      if (!profileUrl) return null;

      // Name — multiple fallback selectors
      let fullName = '';
      const nameSelectors = [
        '.entity-result__title-text a span[aria-hidden="true"]',
        'span[aria-hidden="true"]',
        '.entity-result__title-text',
        '[class*="title"] span',
        'span[dir="ltr"]',
      ];
      for (const sel of nameSelectors) {
        const el = card.querySelector(sel);
        const t  = el?.textContent?.trim();
        if (t && t.length > 1 && t.length < 80 && !t.includes('LinkedIn')) {
          fullName = t; break;
        }
      }
      if (!fullName && profileLink) {
        fullName = profileLink.textContent.trim().split('\n')[0].trim();
      }
      if (!fullName) return null;

      const titleEl    = card.querySelector('.entity-result__primary-subtitle') || card.querySelector('[class*="primary-subtitle"]');
      const locationEl = card.querySelector('.entity-result__secondary-subtitle') || card.querySelector('[class*="secondary-subtitle"]');
      const titleText  = titleEl?.textContent?.trim() || '';
      const location   = locationEl?.textContent?.trim() || '';

      const atIdx   = titleText.lastIndexOf(' at ');
      const jobTitle = atIdx > -1 ? titleText.substring(0, atIdx).trim() : titleText;
      const company  = atIdx > -1 ? titleText.substring(atIdx + 4).trim() : '';

      const parts = fullName.split(' ');
      return {
        firstName: parts[0] || '',
        lastName:  parts.slice(1).join(' ') || '',
        fullName,
        currentJob:  jobTitle,
        companyName: company,
        location,
        linkedinUrl: profileUrl,
        source: 'linkedin-search',
      };
    } catch { return null; }
  }

  function extractSalesNav() {
    const leads = [];
    const seen  = new Set();

    // Sales Nav uses /sales/lead/ in search results, /sales/people/ on profile pages
    const salesLinks = [
      ...document.querySelectorAll('a[href*="/sales/lead/"]'),
      ...document.querySelectorAll('a[href*="/sales/people/"]'),
    ];

    salesLinks.forEach((link) => {
      const profileUrl = link.href?.split('?')[0];
      if (!profileUrl || seen.has(profileUrl)) return;
      const container =
        link.closest('li') ||
        link.closest('[data-entity-urn]') ||
        link.closest('[class*="result"]') ||
        link.parentElement;
      if (!container) return;
      seen.add(profileUrl);
      const lead = parseSalesNavCard(container, link, profileUrl);
      if (lead) leads.push(lead);
    });

    // Fallback: entity-urn containers
    if (!leads.length) {
      document.querySelectorAll('[data-entity-urn*="member"]').forEach((card) => {
        const link = card.querySelector('a[href*="/sales/lead/"]') ||
                     card.querySelector('a[href*="/sales/people/"]') ||
                     card.querySelector('a[href*="/in/"]');
        const profileUrl = link?.href?.split('?')[0];
        if (!profileUrl || seen.has(profileUrl)) return;
        seen.add(profileUrl);
        const lead = parseSalesNavCard(card, link, profileUrl);
        if (lead) leads.push(lead);
      });
    }

    return leads;
  }

  function parseSalesNavCard(card, link, profileUrl) {
    try {
      // Name: find the deepest/innermost span in the link (avoids wrapper spans)
      let fullName = '';
      const spans = [...link.querySelectorAll('span')].filter(s => !s.querySelector('span'));
      for (const s of spans) {
        const t = s.textContent.trim().replace(/\s+/g, ' ');
        if (t.length > 1 && t.length < 70) { fullName = t; break; }
      }
      if (!fullName) fullName = link.textContent.trim().replace(/\s+/g, ' ').split('\n')[0];
      if (!fullName || fullName.length > 70) return null;

      let jobTitle = '', company = '', location = '';

      // Pull all short text nodes from the card; skip the name itself
      const texts = [...card.querySelectorAll('span, dt, dd, p')]
        .map((el) => el.textContent.trim().replace(/\s+/g, ' '))
        .filter((t) => t.length > 1 && t.length < 120 && t !== fullName && !t.includes(fullName));

      if (texts[0]) jobTitle = texts[0];

      // Parse "Title at Company" if combined
      if (jobTitle.includes(' at ')) {
        const idx = jobTitle.lastIndexOf(' at ');
        company   = jobTitle.substring(idx + 4).trim();
        jobTitle  = jobTitle.substring(0, idx).trim();
      } else if (texts[1] && texts[1] !== jobTitle) {
        company = texts[1];
      }
      if (texts[2] && texts[2] !== jobTitle && texts[2] !== company) {
        location = texts[2];
      }

      const parts = fullName.split(' ');
      return {
        firstName: parts[0] || '',
        lastName:  parts.slice(1).join(' ') || '',
        fullName,
        currentJob:  jobTitle,
        companyName: company,
        location,
        linkedinUrl: profileUrl,
        source: 'sales-navigator',
      };
    } catch { return null; }
  }

  /* ─── Scroll + extract loop ──────────────────────────────────── */

  async function scrollAndExtract(onProgress) {
    const seen = new Map();

    const add = (batch) => {
      let n = 0;
      for (const lead of batch) {
        const k = lead.linkedinUrl || (lead.firstName + lead.lastName + lead.companyName);
        if (k && !seen.has(k)) { seen.set(k, lead); n++; }
      }
      return n;
    };

    // Extract what's already visible
    add(extractVisible());
    onProgress(seen.size);

    let stable = 0;
    for (let round = 0; round < 18 && stable < 2; round++) {
      // Human-like scroll — partial viewport height, not always full
      window.scrollBy({ top: Math.floor(window.innerHeight * (0.65 + Math.random() * 0.3)), behavior: 'smooth' });
      await delay(rand(1400, 2800)); // 1.4 – 2.8 s random delay

      if (add(extractVisible()) === 0) {
        stable++;
      } else {
        stable = 0;
      }
      onProgress(seen.size);

      // Occasionally scroll back a little (more human-like)
      if (round % 4 === 3) {
        window.scrollBy({ top: -rand(80, 160), behavior: 'smooth' });
        await delay(rand(400, 800));
      }
    }

    // Return to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return [...seen.values()];
  }

  /* ─── Click handler ──────────────────────────────────────────── */

  let busy = false;

  btn.addEventListener('click', async () => {
    if (busy) return;

    const { dashUrl, apiKey } = await chrome.storage.local.get(['dashUrl', 'apiKey']);
    if (!dashUrl || !apiKey) {
      setBtn('error', '✗ No settings');
      showToast('Open the Leadvault popup to set your Dashboard URL and API key first.');
      setTimeout(() => { setBtn('idle', '⬆ Extract Leads'); hideToast(); }, 4500);
      return;
    }

    busy = true;
    hideToast();
    setBtn('extracting', 'Extracting… (0 found)');

    let leads = [];
    try {
      leads = await scrollAndExtract((count) => {
        setBtn('extracting', `Extracting… (${count} found)`);
      });
    } catch (err) {
      setBtn('error', '✗ Extraction failed');
      showToast('Could not read the page. Refresh LinkedIn and try again.');
      setTimeout(() => { setBtn('idle', '⬆ Extract Leads'); hideToast(); }, 4500);
      busy = false;
      return;
    }

    if (!leads.length) {
      setBtn('error', '✗ No leads found');
      showToast('No profile cards detected. Make sure you\'re on a LinkedIn People search results page.');
      setTimeout(() => { setBtn('idle', '⬆ Extract Leads'); hideToast(); }, 5000);
      busy = false;
      return;
    }

    setBtn('syncing', `Syncing ${leads.length} leads…`);

    try {
      const resp = await chrome.runtime.sendMessage({ action: 'importLeads', leads, dashUrl, apiKey });
      if (resp?.ok) {
        setBtn('success', `✓ ${leads.length} synced`);
        showToast(`${leads.length} leads synced → ${resp.inserted ?? 0} new, ${resp.updated ?? 0} updated. Open your dashboard to view them.`);
      } else {
        setBtn('error', '✗ Sync failed');
        showToast(resp?.error || 'Import failed. Check your API key in the Leadvault popup.');
      }
    } catch {
      setBtn('error', '✗ Network error');
      showToast('Could not reach the dashboard. Check your settings in the Leadvault popup.');
    }

    setTimeout(() => { setBtn('idle', '⬆ Extract Leads'); hideToast(); }, 6000);
    busy = false;
  });
})();
