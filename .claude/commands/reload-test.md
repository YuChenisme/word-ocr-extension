---
description: 手動驗證擴充功能流程
---

專案沒有自動化測試，改完程式要走一次手動 checklist。

## Reload 規則
| 改了哪裡 | 要做什麼 |
|---------|---------|
| `manifest.json` / `background.js` | `chrome://extensions` 按 ↻ |
| `content/content.js` / `content/content.css` | ↻ **加上** refresh 已開的測試分頁（舊 content script 不會自動換掉）|
| `popup/*` / `options/*` / `wordlist/*` | 關掉再開該頁即可 |
| `services/*` 被 extension pages 引用 | 同上（關掉頁面重開） |

## 功能驗證流程
1. 打開英文網頁（Wikipedia 英文版適合測試）
2. `Cmd+Shift+O`（Mac）/ `Ctrl+Shift+O`（Win）或右鍵選「OCR 選取英文單字」
3. 拖曳框選一個英文單字
4. 2–3 秒內應彈出翻譯氣泡（word / pos / translation / example）
5. 開 DevTools → Application → Storage → `chrome.storage.local.words` 確認有新紀錄
6. 點擴充功能圖示 → 單字列表 → 看到剛剛的單字 → 🔊 應播英文發音 → 🗑️ 可刪除

## 邊界測試
- 未設定 API Key：氣泡要提示去設定頁
- 框選空白區：優雅失敗（Gemini 回 `word: ""`，氣泡顯示「沒偵測到單字」）
- `Esc`：取消選取、移除 overlay
