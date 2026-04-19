---
description: 更換 Gemini 模型（同步兩處）
---

換模型（例如從 `gemini-2.5-flash` 換到 `gemini-2.5-pro`）要同步改 **兩處**，只改一處會造成 content script 跟 options 測試連線用不同模型、debug 困難。

## 步驟

1. [services/gemini.js](services/gemini.js) — 頂部 `const MODEL = '...'`
2. [content/content.js](content/content.js) — `analyzeImage` 內 inline 的 URL（搜 `generativelanguage.googleapis.com`）

## 驗證
Reload 擴充功能 → 設定頁按「測試連線」確認新模型能通 → 跑一次完整 OCR 流程確認回傳正常。
