// Service Worker：
// 1. 建立右鍵選單
// 2. 監聽快捷鍵 / 選單點擊 → 通知 content script 啟動 OCR
// 3. 處理來自 content script 的訊息（截圖、開設定頁）

const CONTEXT_MENU_ID = 'ocr-select-word';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'OCR 選取英文單字',
    contexts: ['page', 'image', 'selection']
  });
});

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content/content.css']
      });
      return true;
    } catch (err) {
      console.error('[OCR] 無法注入 content script：', err);
      return false;
    }
  }
}

async function triggerOcr(tabId) {
  if (!tabId) return;
  await ensureContentScript(tabId);
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'START_OCR' });
  } catch (err) {
    console.error('[OCR] 無法啟動：', err);
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID && tab?.id) {
    triggerOcr(tab.id);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'start-ocr') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) triggerOcr(tab.id);
  }
});

// 共用 async 訊息處理：無論走哪條分支，最後都會 sendResponse
async function handleMessage(msg, sender) {
  if (msg?.type === 'CAPTURE_TAB') {
    const windowId = sender.tab ? sender.tab.windowId : chrome.windows.WINDOW_ID_CURRENT;
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    return { ok: true, dataUrl };
  }

  if (msg?.type === 'OPEN_OPTIONS') {
    await chrome.runtime.openOptionsPage();
    return { ok: true };
  }

  if (msg?.type === 'PING') {
    return { ok: true, pong: true };
  }

  return { ok: false, error: '未知訊息類型：' + msg?.type };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender)
    .then((resp) => sendResponse(resp))
    .catch((err) => {
      console.error('[BG] 訊息處理錯誤：', err);
      sendResponse({ ok: false, error: err?.message || String(err) });
    });
  return true; // 保持 channel 開啟，等待非同步回應
});
