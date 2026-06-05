// Runs on linkedin.com/search/results/people/*
// Adds a floating "Extract with Leadvault" button to the page.
(function () {
  if (document.getElementById('leadvault-fab')) return;

  const fab = document.createElement('button');
  fab.id = 'leadvault-fab';
  fab.textContent = '↑ Extract with Leadvault';
  Object.assign(fab.style, {
    position:     'fixed',
    bottom:       '24px',
    right:        '24px',
    zIndex:       '99999',
    background:   '#a8f040',
    color:        '#0a0a0a',
    border:       'none',
    borderRadius: '24px',
    padding:      '10px 18px',
    fontSize:     '13px',
    fontWeight:   '600',
    fontFamily:   '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    cursor:       'pointer',
    boxShadow:    '0 4px 16px rgba(168,240,64,.45)',
    transition:   'transform .15s, box-shadow .15s',
  });

  fab.addEventListener('mouseenter', () => {
    fab.style.transform  = 'translateY(-2px)';
    fab.style.boxShadow  = '0 6px 20px rgba(168,240,64,.55)';
  });
  fab.addEventListener('mouseleave', () => {
    fab.style.transform  = '';
    fab.style.boxShadow  = '0 4px 16px rgba(168,240,64,.45)';
  });

  // Clicking the FAB opens the extension popup
  fab.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openPopup' }));

  document.body.appendChild(fab);
})();
