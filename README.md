# 英文單字 OCR 速查（Chrome / Edge Extension）

用快捷鍵或右鍵選單框選畫面上的英文單字，立即取得中文翻譯、詞性、AI 例句，並收錄到個人單字卡。

## 功能
- 🔍 **螢幕選取**：`Ctrl/Cmd + Shift + O` 或右鍵選單「OCR 選取英文單字」→ 拖曳矩形框選
- 🤖 **一次到位**：Gemini Vision 同時完成「影像辨識 + 中文翻譯 + 詞性 + AI 例句」
- 📚 **單字卡**：卡片式列表，可發音（Web Speech API）、可刪除、可搜尋
- ⚙️ **設定頁**：只需輸入 Gemini API Key，存於 `chrome.storage.sync`

## 安裝

### 1. 載入擴充功能
1. 開啟 Chrome / Edge → `chrome://extensions` 或 `edge://extensions`
2. 右上角開啟「**開發人員模式**」
3. 點「**載入未封裝項目**」/「**載入解壓縮**」→ 選擇本專案資料夾
4. 載入完成後，點工具列擴充功能圖示 → 「設定」→ 貼上 Gemini API Key → 「儲存」
5. （可選）按「測試連線」確認 API Key 有效

取得 Gemini API Key：<https://aistudio.google.com/app/apikey>

## 使用
1. 打開任何網頁（有英文的都行，PDF 也可以）
2. 按 `Cmd+Shift+O`（Mac）/ `Ctrl+Shift+O`（Win）或按右鍵選「OCR 選取英文單字」
3. 拖曳框選一個英文單字
4. 翻譯氣泡跳出，同時單字自動存入單字卡
5. 點擴充功能圖示 → 「單字列表」查看全部單字，可發音 / 刪除 / 搜尋

按 `Esc` 可取消選取。

## 檔案結構
```
manifest.json          Manifest V3 設定
background.js          Service Worker：選單、快捷鍵、截圖
content/               頁面注入：矩形選取 + Gemini Vision 管線
popup/                 工具列彈窗（兩顆按鈕）
options/               設定頁（API Key）
wordlist/              單字卡列表頁
services/              storage / gemini 共用函式
```

## 技術選型
| 功能 | 方案 |
|-----|-----|
| OCR + 翻譯 + 例句 | Google `gemini-2.5-flash`（Vision + JSON 模式，單次呼叫）|
| 發音 | Web Speech API（瀏覽器內建）|
| 儲存 | `chrome.storage.local`（單字）、`chrome.storage.sync`（Key）|

## 已知限制
- 框選區域太小或對比度太低時 Gemini 可能辨識錯誤；可放大網頁後重試
- 每次呼叫會消耗少量 token，`gemini-2.5-flash` 有每日免費額度，個人使用通常夠用
- 發音品質依系統 TTS 而定（Mac 的 Samantha、Win 的 Zira 等）
