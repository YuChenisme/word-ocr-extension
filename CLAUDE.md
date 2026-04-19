# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Chrome / Edge extension (Manifest V3) — drag-select OCR on English words via Gemini Vision, saved into a word-card list. UI is 繁體中文。See [README.md](README.md) for user-facing docs.

## No build, no tests

Vanilla HTML/CSS/JS — no bundler, no package manager, no automated tests. Verification is manual (see `/reload-test`).

## Architecture — three isolated JS contexts

Extensions have three execution environments that **cannot share module state**. This drives the whole code layout:

1. **Service worker** ([background.js](background.js)) — context menu, `chrome.commands` shortcut, and `chrome.tabs.captureVisibleTab` (only callable here). Routes messages. Lazily injects content script via `chrome.scripting.executeScript` if missing.

2. **Content script** ([content/content.js](content/content.js)) — isolated world in the page. Handles overlay / drag-select / crop / Gemini call / bubble / storage write. Must be **self-contained** — cannot `<script src>` in `services/*.js`. This is why Gemini fetch and storage logic are **inlined here, duplicated** from `services/`.

3. **Extension pages** (`popup/`, `options/`, `wordlist/`) — load `services/*.js` via plain `<script>` tags which attach `window.WordStorage` and `window.AIService` as globals. No ES modules.

## Hard constraints (don't violate)

- **No `eval` / `new Function`** — MV3 isolated-world CSP forbids them. Tesseract.js was removed because its emscripten glue uses `new Function`. The leftover `lib/tesseract/` directory is gitignored and unused; do not reference it. Any new library needing eval must be loaded via a `sandbox` iframe declared in manifest.
- **Storage key `gemini_api_key` is referenced in TWO places** — [services/storage.js](services/storage.js) `API_KEY` constant AND inline in [content/content.js](content/content.js). Rename = update both.
- **Gemini model is set in TWO places** — see `/change-gemini-model`.

## Storage shape

- `chrome.storage.local.words` — array of `{id, word, translation, pos, example_en, example_zh, createdAt}`. Dedup by lowercased `word` (re-query overwrites + refreshes `createdAt`).
- `chrome.storage.sync.gemini_api_key` — API key (syncs across the user's Chrome profiles).

## Available skills

- `/reload-test` — manual verification checklist + which files require tab refresh
- `/add-word-field` — add a new field to word cards (touches 4 files)
- `/change-gemini-model` — change model safely (two call sites)
- `/add-permission` — edit manifest permissions + reload rules
