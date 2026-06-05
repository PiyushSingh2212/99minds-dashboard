/* Leadvault — API interceptor v3
   Runs in MAIN world (document_start) on all linkedin.com pages.
   Patches fetch + XHR to capture Sales Navigator & voyager search responses,
   then posts structured lead objects to the content script via postMessage. */
(function () {
  if (window.__lv_injected) return;
  window.__lv_injected = true;

  /* ── Endpoints that carry lead data ──────────────────────────────────────── */
  const INTERCEPT = [
    'salesApiLeadSearch',
    'salesApiProspectSearch',
    'salesApiSavedLeadSearch',
    'salesApiPeopleSearch',
    '/voyager/api/search/blended',
    '/voyager/api/search/dash/clusters',
    '/voyager/api/search/hits',
  ];
  const shouldIntercept = (url) => url && INTERCEPT.some(p => url.includes(p));

  /* ── Helpers ─────────────────────────────────────────────────────────────── */
  // urn:li:fs_salesProfile:(ACwAAA...,NAME_SEARCH,...) → Sales Nav URL
  function urnToSalesNavUrl(urn) {
    if (!urn) return '';
    const m = urn.match(/\(([^)]+)\)/);
    return m ? `https://www.linkedin.com/sales/lead/${m[1]}` : '';
  }

  // Pick the largest profile picture artifact
  function extractPic(img) {
    if (!img) return '';
    const root = img.rootUrl || '';
    const arts = img.artifacts || [];
    if (!arts.length) return root;
    const best = arts.slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    return root + (best.fileIdentifyingUrlPathSegment || '');
  }

  /* ── Sales Navigator format ──────────────────────────────────────────────── */
  // Response shape: { elements: [ { firstName, lastName, fullName, headline,
  //   geoRegion, currentPositions: [{title, companyName, yearsInPosition, ...}],
  //   entityUrn, publicIdentifier, profilePictureDisplayImage, numOfConnections,
  //   openLink, premium } ] }
  function extractSalesNavLeads(elements) {
    const leads = [];
    for (const el of elements) {
      if (!el || (!el.firstName && !el.fullName)) continue;
      const pos  = el.currentPositions?.[0] || {};
      // publicIdentifier may be top-level or nested in various places
      const slug = el.publicIdentifier
        || el.memberIdentity?.publicIdentifier
        || el.profileIdentifier
        || el.linkedInMemberUrn?.match(/urn:li:member:([^,)]+)/)?.[1]
        || '';
      // Company logo sometimes nested inside position resolution result
      const coLogo = extractPic(pos.companyUrnResolutionResult?.logo || pos.logo);
      leads.push({
        firstName:        el.firstName        || '',
        lastName:         el.lastName         || '',
        fullName:         el.fullName         || `${el.firstName || ''} ${el.lastName || ''}`.trim(),
        currentJob:       pos.title           || (el.headline || '').split(' at ')[0] || '',
        companyName:      pos.companyName     || '',
        location:         el.geoRegion        || '',
        headline:         el.headline         || '',
        summary:          el.summary          || '',
        linkedinUrl:      slug ? `https://www.linkedin.com/in/${slug}` : '',
        salesNavUrl:      urnToSalesNavUrl(el.entityUrn || ''),
        profilePicture:   extractPic(el.profilePictureDisplayImage),
        companyLogo:      coLogo,
        connections:      el.numOfConnections  ? Number(el.numOfConnections)  : null,
        yearsInPosition:  pos.yearsInPosition  ? Number(pos.yearsInPosition)  : null,
        monthsInPosition: pos.monthsInPosition ? Number(pos.monthsInPosition) : null,
        isPremium:        el.premium           === true,
        isOpenToWork:     el.openLink          === true,
        source:           'sales-navigator-api',
      });
    }
    return leads;
  }

  /* ── Voyager (LinkedIn.com people search) format ─────────────────────────── */
  function extractVoyagerLeads(data) {
    const leads = [];
    const seen  = new Set();

    function tryMiniProfile(mp) {
      if (!mp || !mp.firstName || seen.has(mp.entityUrn)) return;
      seen.add(mp.entityUrn || (mp.firstName + mp.lastName));
      const slug = mp.publicIdentifier || '';
      leads.push({
        firstName:   mp.firstName   || '',
        lastName:    mp.lastName    || '',
        fullName:    `${mp.firstName} ${mp.lastName}`.trim(),
        currentJob:  mp.occupation  || '',
        companyName: '',
        location:    '',
        headline:    mp.occupation  || '',
        linkedinUrl: slug ? `https://www.linkedin.com/in/${slug}` : '',
        salesNavUrl: '',
        profilePicture: extractPic(mp.picture),
        source:      'linkedin-api',
      });
    }

    function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 12) return;
      if (Array.isArray(node)) { node.forEach(n => walk(n, depth + 1)); return; }

      // Legacy voyager: hitInfo.SearchProfile.miniProfile
      const sp = node['com.linkedin.voyager.search.SearchProfile'];
      if (sp?.miniProfile) { tryMiniProfile(sp.miniProfile); return; }
      if (node.miniProfile && node.miniProfile.firstName) { tryMiniProfile(node.miniProfile); return; }

      // Newer voyager: entityResult with navigationUrl + title
      if (node.entityResult) {
        const er    = node.entityResult;
        const title = er.title?.text || er.titleV2?.text || '';
        const sub   = er.primarySubtitle?.text || er.primarySubtitleV2?.text || '';
        const loc   = er.secondarySubtitle?.text || er.secondarySubtitleV2?.text || '';
        const nav   = er.navigationUrl || '';
        const slugM = nav.match(/linkedin\.com\/in\/([^/?#]+)/);
        const slug  = slugM?.[1] || '';
        if (title && !seen.has(nav || title)) {
          seen.add(nav || title);
          const at = sub.lastIndexOf(' at ');
          leads.push({
            firstName:   title.split(' ')[0] || '',
            lastName:    title.split(' ').slice(1).join(' ') || '',
            fullName:    title,
            currentJob:  at > -1 ? sub.slice(0, at).trim() : sub,
            companyName: at > -1 ? sub.slice(at + 4).trim() : '',
            location:    loc,
            headline:    sub,
            linkedinUrl: slug ? `https://www.linkedin.com/in/${slug}` : '',
            salesNavUrl: '',
            source:      'linkedin-api',
          });
        }
        return;
      }

      for (const v of Object.values(node)) walk(v, depth + 1);
    }

    walk(data, 0);
    return leads;
  }

  /* ── Main processor ───────────────────────────────────────────────────────── */
  function processResponse(url, data) {
    try {
      let leads = [];
      // Sales Nav responses have a top-level `elements` array with firstName fields
      const elements = data?.elements || data?.data?.elements || [];
      if (Array.isArray(elements) && elements.length > 0 &&
          (elements[0]?.firstName !== undefined || elements[0]?.entityUrn?.includes('salesProfile'))) {
        leads = extractSalesNavLeads(elements);
      } else {
        leads = extractVoyagerLeads(data);
      }
      if (leads.length > 0) {
        window.postMessage({ type: 'LV_LEADS', leads }, '*');
      }
    } catch (_) {/* swallow */}
  }

  /* ── Patch fetch ─────────────────────────────────────────────────────────── */
  const _fetch = window.fetch;
  window.fetch = function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    if (!shouldIntercept(url)) return _fetch.apply(this, args);
    return _fetch.apply(this, args).then(res => {
      res.clone().json().then(d => processResponse(url, d)).catch(() => {});
      return res;
    });
  };

  /* ── Patch XMLHttpRequest ─────────────────────────────────────────────────── */
  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._lvUrl = typeof url === 'string' ? url : '';
    return _open.call(this, method, url, ...rest);
  };
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (this._lvUrl && shouldIntercept(this._lvUrl)) {
      const u = this._lvUrl;
      this.addEventListener('load', () => {
        try { processResponse(u, JSON.parse(this.responseText)); } catch {}
      });
    }
    return _send.apply(this, args);
  };
})();
