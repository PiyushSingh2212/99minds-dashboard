chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'openPopup') {
    chrome.action.openPopup?.();
  }
});
