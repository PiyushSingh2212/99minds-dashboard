/* Leadvault background service worker v3.1
   Runs outside any page context — has access to chrome.cookies and can make
   cross-origin authenticated requests to LinkedIn (cookies auto-attached). */

/* ── Deep-walk helper (same logic as injected.js) ───────────────── */
function findSlug(obj, depth) {
  if (!obj || typeof obj !== 'object' || depth > 8) return '';
  for (const k of ['publicIdentifier', 'profileIdentifier']) {
    if (typeof obj[k] === 'string' && obj[k]) return obj[k];
  }
  for (const k of ['flagshipProfileUrl', 'memberProfileUrl', 'linkedInProfileUrl', 'profileUrl']) {
    if (typeof obj[k] === 'string') {
      const m = obj[k].match(/linkedin\.com\/in\/([^/?#\s]+)/);
      if (m) return m[1];
    }
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') {
      const found = findSlug(v, depth + 1);
      if (found) return found;
    }
  }
  return '';
}

/* ── Get LinkedIn CSRF token (JSESSIONID cookie) ─────────────────── */
async function getCsrf() {
  return new Promise(resolve =>
    chrome.cookies.get({ url: 'https://www.linkedin.com', name: 'JSESSIONID' },
      c => resolve((c?.value || '').replace(/"/g, ''))
    )
  );
}

/* ── Resolve LinkedIn profile slugs via Sales Nav profile API ──────
   LinkedIn's salesApiProfiles endpoint returns publicIdentifier when
   called with proper headers — same approach used by Evaboot.        */
async function resolveProfileSlugs(entityUrns) {
  if (!entityUrns.length) return {};

  const csrf = await getCsrf();
  const headers = {
    'Accept':                    'application/json',
    'csrf-token':                csrf,
    'x-restli-protocol-version': '2.0.0',
    'x-li-lang':                 'en_US',
    'x-li-track':                JSON.stringify({ clientVersion: '1.13.6374', osName: 'web' }),
  };

  const slugMap = {}; // entityUrn → slug

  // Process in batches of 10 to avoid URL length limits
  for (let i = 0; i < entityUrns.length; i += 10) {
    const batch = entityUrns.slice(i, i + 10);

    // Extract profile IDs from URNs: urn:li:fs_salesProfile:(ACwAAA...,NAME_SEARCH,x)
    const profileIds = batch.map(urn => {
      const m = urn.match(/\(([^)]+)\)/);
      return m ? m[1] : null;
    }).filter(Boolean);

    if (!profileIds.length) continue;

    // Try salesApiProfiles batch endpoint
    try {
      const ids = profileIds.map(id => encodeURIComponent(id)).join(',');
      const url = `https://www.linkedin.com/sales-api/salesApiProfiles?q=memberIdentities&memberIdentities=List(${ids})`;
      const res = await fetch(url, { credentials: 'include', headers });

      if (res.ok) {
        const data = await res.json();
        const elements = data?.elements || data?.results || [];

        for (let j = 0; j < elements.length; j++) {
          const slug = findSlug(elements[j], 0);
          if (slug && batch[j]) slugMap[batch[j]] = slug;
        }
      }
    } catch (_) {}

    // For any still unresolved, try individual voyager profile lookup
    for (const urn of batch) {
      if (slugMap[urn]) continue;
      const profileIdMatch = urn.match(/\(([^,)]+)/);
      if (!profileIdMatch) continue;
      const profileId = profileIdMatch[1];

      try {
        // Sales Nav single-profile endpoint
        const url = `https://www.linkedin.com/sales-api/salesApiProfiles?q=memberIdentity&memberIdentity=${encodeURIComponent(urn)}`;
        const res = await fetch(url, { credentials: 'include', headers });
        if (res.ok) {
          const data = await res.json();
          const slug = findSlug(data, 0);
          if (slug) slugMap[urn] = slug;
        }
      } catch (_) {}
    }
  }

  return slugMap; // { entityUrn → publicIdentifier }
}

/* ── Message handler ─────────────────────────────────────────────── */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  /* Import leads to dashboard */
  if (msg.action === 'importLeads') {
    const { leads, dashUrl, apiKey } = msg;
    fetch(`${dashUrl}/leads/import`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body:    JSON.stringify({ leads }),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        sendResponse(ok
          ? { ok: true,  inserted: data.inserted ?? 0, updated: data.updated ?? 0 }
          : { ok: false, error: data.error || 'Import failed' }
        );
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  /* Resolve LinkedIn profile URLs for leads missing them (Evaboot-style) */
  if (msg.action === 'resolveLinkedInUrls') {
    const { leads } = msg; // array of { entityUrn, salesNavUrl }
    const toResolve = leads.filter(l => l.entityUrn && !l.linkedinUrl);

    if (!toResolve.length) {
      sendResponse({ ok: true, resolved: {} });
      return true;
    }

    resolveProfileSlugs(toResolve.map(l => l.entityUrn))
      .then(slugMap => {
        // Build salesNavUrl → linkedinUrl map
        const resolved = {};
        for (const l of toResolve) {
          const slug = slugMap[l.entityUrn];
          if (slug) resolved[l.salesNavUrl] = `https://www.linkedin.com/in/${slug}`;
        }
        sendResponse({ ok: true, resolved });
      })
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.action === 'openPopup') {
    chrome.action.openPopup?.();
  }
});
