---
description: 在單字卡新增欄位（同步 Gemini prompt + storage + UI）
---

在單字卡新增一個欄位（例如 `synonyms` 同義字、`difficulty` 難度）。必須同步改 4 處，漏一處就會出現「Gemini 回傳了但卡片沒顯示」或「卡片沒欄位」的現象。

## 步驟

1. **Gemini 系統 prompt（兩處）** — 在 schema 的 JSON 範例加上新欄位
   - [content/content.js](content/content.js)：搜 `translation` 找到 inline prompt
   - [services/gemini.js](services/gemini.js)：同一段 prompt 需同步

2. **寫入紀錄** — [content/content.js](content/content.js) 的 `saveWord` 把新欄位放進 record 物件

3. **卡片模板** — [wordlist/wordlist.html](wordlist/wordlist.html) 的 `<template id="card-tpl">` 加一個新的 `.field-xxx` 節點

4. **渲染** — [wordlist/wordlist.js](wordlist/wordlist.js) 的 `makeCard` 讀 `w.新欄位` 寫入對應節點

## 驗證
改完後 reload 擴充功能 + refresh 測試分頁 → OCR 一個單字 → 看 `chrome.storage.local` 是否有新欄位 → 單字列表頁是否顯示。
