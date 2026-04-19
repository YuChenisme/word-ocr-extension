---
description: 新增 Chrome 擴充功能權限
---

在 [manifest.json](manifest.json) 新增 `permissions` 或 `host_permissions`。

## 步驟

1. 編輯 [manifest.json](manifest.json) 的 `permissions` 或 `host_permissions` 陣列
2. 到 `chrome://extensions` / `edge://extensions` 按 ↻ reload 擴充功能
3. **新增 `host_permissions` 時**：Chrome 可能要求使用者重新授權。去擴充功能詳情頁檢查「網站存取權」設定。

## 注意
- `permissions` 愈少愈好，使用者安裝時會看到權限清單，過多權限降低信任
- 避免用 `<all_urls>` 以外沒必要的 host — 目前已經是 `<all_urls>` + Gemini API，通常不用再加
