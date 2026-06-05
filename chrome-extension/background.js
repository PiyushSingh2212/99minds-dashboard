chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'importLeads') {
    const { leads, dashUrl, apiKey } = msg;
    fetch(`${dashUrl}/leads/import`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body:    JSON.stringify({ leads }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          sendResponse({ ok: true, inserted: data.inserted ?? 0, updated: data.updated ?? 0 });
        } else {
          sendResponse({ ok: false, error: data.error || 'Import failed' });
        }
      })
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep message channel open for async response
  }

  if (msg.action === 'openPopup') {
    chrome.action.openPopup?.();
  }
});
