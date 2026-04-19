document.getElementById('open-wordlist').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('wordlist/wordlist.html') });
  window.close();
});

document.getElementById('open-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
