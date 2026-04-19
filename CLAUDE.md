# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome / Edge extension (Manifest V3) that lets the user drag-select a rectangle over any English word on-screen and get an instant Chinese translation, part of speech, English example, and Chinese example translation, saved into a card-based word list. UI text is Traditional Chinese (繁體).

Trigger: keyboard shortcut `Ctrl/Cmd+Shift+O` or right-click → "OCR 選取英文單字".

## No build, no tests

- Vanilla HTML / CSS / JS — no bundler, no transpiler, no package manager.
- No automated test suite. Verification is manual: reload the extension in `chrome://extensions` / `edge://extensions` (↻ on the card) and exercise the flow on a real page.
- After changing `content/content.js` or `content/content.css`, you must also **refresh any open tab** — already-loaded content scripts keep running the old code.
- After changing `background.js` or `manifest.json`, the ↻ reload is enough.

## Architecture — three isolated contexts

The codebase is structured around the fact that extensions have three JS execution environments that **cannot share module state**:

1. **Service worker** ([background.js](background.js)) — handles context menu, keyboard command (`chrome.commands`), and `chrome.tabs.captureVisibleTab` (which can only run here). Routes messages between contexts. Lazily injects the content script if it's missing (useful for tabs that existed before install).

2. **Content script** ([content/content.js](content/content.js)) — runs in the page's isolated world. Handles overlay drawing, drag-to-select, cropping, the Gemini Vision call, the translation bubble, and writing to storage. Must be **self-contained** — it cannot `<script src=…>` in `services/*.js` because content scripts are injected programmatically, not loaded via HTML. This is why the Gemini fetch logic and storage logic are **duplicated inline** here rather than imported from `services/`.

3. **Extension pages** (`popup/`, `options/`, `wordlist/`) — normal HTML pages loaded from `chrome-extension://…/`. They load `services/*.js` via plain `<script>` tags, which attach `window.WordStorage` and `window.AIService` as globals. Page scripts use those globals directly — there are no ES modules.

### The OCR pipeline (single round trip)

`content/content.js::runOcrPipeline` does everything in one pass:

1. `captureTab` → ask background to `captureVisibleTab` (returns PNG data URL of viewport).
2. `cropImage` → draw to an off-screen canvas using the selection rect scaled by `devicePixelRatio` (the screenshot is at physical pixels, the rect is in CSS pixels).
3. `analyzeImage` → one `fetch` to `generativelanguage.googleapis.com/.../gemini-2.5-flash:generateContent` with the cropped image as `inlineData` and `responseMimeType: application/json`. The system prompt tells Gemini to return `{word, translation, pos, example_en, example_zh}` — so OCR + translation + POS + example are one call, not a pipeline.
4. Show bubble + `chrome.storage.local` append (dedup by lowercased word).

If Gemini can't find a word in the image, it returns `word: ""` and the bubble shows a retry message.

## Storage layout

- `chrome.storage.local.words` — array of `{id, word, translation, pos, example_en, example_zh, createdAt}`. `id` is a random prefix + timestamp. Dedup is by lowercased `word` (a re-query of the same word overwrites the existing entry and refreshes `createdAt`).
- `chrome.storage.sync.gemini_api_key` — the Gemini API key. `sync` means it follows the user across Chrome profiles on different machines.
- The storage key name is referenced in **two places**: [services/storage.js](services/storage.js) (`API_KEY` constant) and [content/content.js](content/content.js) (inline `chrome.storage.sync.get('gemini_api_key')`). Changing the key requires updating both.

## MV3 CSP constraint (important history)

The isolated world of content scripts in MV3 **forbids `eval` and `new Function`**. This project originally used Tesseract.js for local OCR but was migrated to Gemini Vision because Tesseract's emscripten-generated WASM glue relies on `new Function` and is blocked by CSP. **Do not reintroduce libraries that need eval unless you are willing to load them via a sandbox iframe** (declared in `manifest.json` under `sandbox`). The leftover `lib/tesseract/` directory on disk is gitignored and unused — do not reference it.

## Pronunciation

[wordlist/wordlist.js](wordlist/wordlist.js)::`speak` uses the unofficial Google Translate TTS endpoint (`translate.google.com/translate_tts?client=tw-ob`) for natural voice. It falls back to the browser's Web Speech API if the fetch fails. The endpoint is unofficial and could break without warning — if it does, the fallback keeps things working.

## Common edit patterns

- **Adding a new field to a word card**: update the Gemini system prompt in both [content/content.js](content/content.js) and [services/gemini.js](services/gemini.js), extend the record written in `saveWord`, and update the card template in [wordlist/wordlist.html](wordlist/wordlist.html) + render logic in [wordlist/wordlist.js](wordlist/wordlist.js).
- **Changing the Gemini model**: it's set in two places — `MODEL` in [services/gemini.js](services/gemini.js) and the inline URL in [content/content.js](content/content.js)'s `analyzeImage`.
- **Adding permissions**: edit `manifest.json` `permissions` / `host_permissions`, then reload the extension. New `host_permissions` may require the user to re-grant.

## Repo

Remote: <https://github.com/YuChenisme/word-ocr-extension> (public, `main` branch). Standard `git add . && git commit && git push` workflow.
