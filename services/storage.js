// 單字與 API Key 儲存封裝。
// 可在 popup / options / wordlist 頁面以 <script src="../services/storage.js"></script> 載入，
// 也可在 content script 中透過 chrome.runtime.getURL 動態 import。
// 匯出到 window.WordStorage 供非模組使用者調用。

(function () {
  const WORDS_KEY = 'words';
  const API_KEY = 'gemini_api_key';

  function uuid() {
    return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  async function listWords() {
    const data = await chrome.storage.local.get(WORDS_KEY);
    const words = data[WORDS_KEY] || [];
    return words.slice().sort((a, b) => b.createdAt - a.createdAt);
  }

  async function addWord(entry) {
    const data = await chrome.storage.local.get(WORDS_KEY);
    const words = data[WORDS_KEY] || [];
    const normalized = (entry.word || '').trim().toLowerCase();
    if (!normalized) throw new Error('單字為空');

    const existingIdx = words.findIndex(w => (w.word || '').toLowerCase() === normalized);
    const record = {
      id: existingIdx >= 0 ? words[existingIdx].id : uuid(),
      word: entry.word,
      translation: entry.translation || '',
      pos: entry.pos || '',
      example_en: entry.example_en || '',
      example_zh: entry.example_zh || '',
      createdAt: Date.now()
    };

    if (existingIdx >= 0) {
      words[existingIdx] = record;
    } else {
      words.push(record);
    }
    await chrome.storage.local.set({ [WORDS_KEY]: words });
    return record;
  }

  async function deleteWord(id) {
    const data = await chrome.storage.local.get(WORDS_KEY);
    const words = (data[WORDS_KEY] || []).filter(w => w.id !== id);
    await chrome.storage.local.set({ [WORDS_KEY]: words });
  }

  async function getApiKey() {
    const data = await chrome.storage.sync.get(API_KEY);
    return data[API_KEY] || '';
  }

  async function setApiKey(key) {
    await chrome.storage.sync.set({ [API_KEY]: key });
  }

  const api = { listWords, addWord, deleteWord, getApiKey, setApiKey };
  if (typeof window !== 'undefined') window.WordStorage = api;
  if (typeof self !== 'undefined') self.WordStorage = api;
})();
