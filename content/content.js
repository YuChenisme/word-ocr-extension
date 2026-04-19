// 內容腳本：
// 1. 收到 START_OCR 後顯示全螢幕半透明遮罩，讓使用者拖曳矩形
// 2. 放開滑鼠 → 請 background 截圖 → 用 Canvas 依座標裁切
// 3. 把裁切後的圖片 base64 直接丟給 Gemini Vision，一次回傳
//    { word, translation, pos, example_en, example_zh }
// 4. 彈翻譯氣泡 → 存入 chrome.storage
//
// 所有注入的 DOM 節點 id 都以 ocr-ext- 前綴，避免與頁面衝突。

(function () {
  if (window.__ocr_ext_loaded__) return;
  window.__ocr_ext_loaded__ = true;

  let overlay = null;
  let selection = null;
  let hint = null;
  let startX = 0;
  let startY = 0;
  let isDragging = false;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'START_OCR') {
      startSelection();
      sendResponse({ ok: true });
    } else if (msg?.type === 'PING') {
      sendResponse({ ok: true, pong: true });
    }
    return false;
  });

  function startSelection() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'ocr-ext-overlay';

    hint = document.createElement('div');
    hint.id = 'ocr-ext-hint';
    hint.textContent = '拖曳滑鼠框選英文單字，按 Esc 取消';

    document.body.appendChild(overlay);
    document.body.appendChild(hint);

    overlay.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
  }

  function cleanupSelectionUI() {
    overlay?.remove();
    selection?.remove();
    hint?.remove();
    overlay = null;
    selection = null;
    hint = null;
    isDragging = false;
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cleanupSelectionUI();
    }
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    isDragging = true;
    selection = document.createElement('div');
    selection.id = 'ocr-ext-selection';
    selection.style.left = startX + 'px';
    selection.style.top = startY + 'px';
    selection.style.width = '0px';
    selection.style.height = '0px';
    document.body.appendChild(selection);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!isDragging || !selection) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    selection.style.left = x + 'px';
    selection.style.top = y + 'px';
    selection.style.width = w + 'px';
    selection.style.height = h + 'px';
  }

  async function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    const rect = selection?.getBoundingClientRect();
    const anchor = rect ? { x: rect.right, y: rect.bottom } : { x: e.clientX, y: e.clientY };

    if (!rect || rect.width < 5 || rect.height < 5) {
      cleanupSelectionUI();
      return;
    }

    const crop = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    cleanupSelectionUI();
    await runOcrPipeline(crop, anchor);
  }

  // ----- 主流程：截圖 → 裁切 → Gemini Vision → 顯示氣泡 → 存檔 -----
  async function runOcrPipeline(crop, anchor) {
    const bubble = showBubble(anchor, { status: 'loading', text: '擷取影像中...' });
    try {
      const dataUrl = await captureTab();
      const croppedDataUrl = await cropImage(dataUrl, crop);

      updateBubble(bubble, { status: 'loading', text: 'AI 辨識與翻譯中...' });
      const result = await analyzeImage(croppedDataUrl);
      if (!result.word) {
        updateBubble(bubble, { status: 'error', text: '圖片中未偵測到英文單字，請重新框選' });
        return;
      }

      updateBubble(bubble, { status: 'done', data: result });
      await saveWord(result);
    } catch (err) {
      console.error('[OCR] pipeline 失敗', err);
      if (err.code === 'NO_API_KEY') {
        updateBubble(bubble, {
          status: 'error',
          text: '尚未設定 Gemini API Key',
          actionLabel: '前往設定',
          action: () => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' })
        });
      } else {
        updateBubble(bubble, { status: 'error', text: err.message || String(err) });
      }
    }
  }

  function captureTab() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'CAPTURE_TAB' }, (resp) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!resp?.ok) return reject(new Error(resp?.error || '截圖失敗'));
        resolve(resp.dataUrl);
      });
    });
  }

  function cropImage(dataUrl, crop) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / window.innerWidth; // devicePixelRatio
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(crop.width * ratio));
        canvas.height = Math.max(1, Math.round(crop.height * ratio));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
          img,
          crop.left * ratio, crop.top * ratio,
          crop.width * ratio, crop.height * ratio,
          0, 0,
          canvas.width, canvas.height
        );
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('圖片載入失敗'));
      img.src = dataUrl;
    });
  }

  // ----- Gemini Vision：圖片 → 單字 + 翻譯 + 詞性 + 例句 -----
  async function analyzeImage(imageDataUrl) {
    const apiKey = (await chrome.storage.sync.get('gemini_api_key'))['gemini_api_key'] || '';
    if (!apiKey) {
      const err = new Error('尚未設定 Gemini API Key');
      err.code = 'NO_API_KEY';
      throw err;
    }

    // 去掉 data URL 前綴，只保留 base64 本體
    const base64 = imageDataUrl.replace(/^data:image\/png;base64,/, '');

    const systemPrompt =
      '你是一個專業的英文學習助教。使用者會傳來一張圖片，圖片中應包含一個英文單字。' +
      '你的任務是：辨識圖中最明顯的英文單字（若有多個，選取置中或最清楚的那一個），' +
      '然後回傳一個嚴格的 JSON 物件，包含：' +
      'word（辨識到的單字，小寫原形；若圖中沒有任何英文字，回傳空字串）、' +
      'translation（繁體中文翻譯，簡潔）、' +
      'pos（詞性，使用 n./v./adj./adv./prep./conj./pron. 這類縮寫，多詞性用斜線分隔，例如 n./v.）、' +
      'example_en（一句自然、日常、長度適中的英文例句，務必包含該單字）、' +
      'example_zh（上述英文例句的繁體中文翻譯）。' +
      '除了 JSON 物件本身外，不要輸出任何其他文字。';

    const resp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{
            role: 'user',
            parts: [
              { text: '請辨識這張圖片中的英文單字並回傳 JSON。' },
              { inlineData: { mimeType: 'image/png', data: base64 } }
            ]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        })
      }
    );

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Gemini ${resp.status}：${text.slice(0, 200)}`);
    }
    const data = await resp.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error('Gemini 回傳為空');
    const parsed = JSON.parse(content);
    return {
      word: (parsed.word || '').trim(),
      translation: parsed.translation || '',
      pos: parsed.pos || '',
      example_en: parsed.example_en || '',
      example_zh: parsed.example_zh || ''
    };
  }

  async function saveWord(entry) {
    const data = await chrome.storage.local.get('words');
    const words = data.words || [];
    const normalized = (entry.word || '').trim().toLowerCase();
    if (!normalized) return;
    const idx = words.findIndex(w => (w.word || '').toLowerCase() === normalized);
    const record = {
      id: idx >= 0 ? words[idx].id : ('w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)),
      word: entry.word,
      translation: entry.translation,
      pos: entry.pos,
      example_en: entry.example_en,
      example_zh: entry.example_zh,
      createdAt: Date.now()
    };
    if (idx >= 0) words[idx] = record; else words.push(record);
    await chrome.storage.local.set({ words });
  }

  // ----- 翻譯氣泡 UI -----
  function showBubble(anchor, state) {
    const el = document.createElement('div');
    el.id = 'ocr-ext-bubble';
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    let left = anchor.x + 8;
    let top = anchor.y + 8;
    if (left + 320 > viewportW) left = Math.max(12, viewportW - 332);
    if (top + 200 > viewportH) top = Math.max(12, anchor.y - 200);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    document.body.appendChild(el);
    updateBubble(el, state);
    return el;
  }

  function updateBubble(el, state) {
    if (!el) return;
    el.innerHTML = '';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => el.remove());
    el.appendChild(closeBtn);

    if (state.status === 'loading') {
      const row = document.createElement('div');
      row.className = 'status';
      const spin = document.createElement('span');
      spin.className = 'spinner';
      const txt = document.createElement('span');
      txt.textContent = state.text;
      row.appendChild(spin);
      row.appendChild(txt);
      el.appendChild(row);
    } else if (state.status === 'error') {
      const row = document.createElement('div');
      row.className = 'status error';
      row.textContent = state.text;
      el.appendChild(row);
      if (state.action && state.actionLabel) {
        const btn = document.createElement('button');
        btn.className = 'link';
        btn.textContent = state.actionLabel;
        btn.style.marginTop = '6px';
        btn.addEventListener('click', state.action);
        el.appendChild(btn);
      }
    } else if (state.status === 'done') {
      const d = state.data;
      const wordEl = document.createElement('div');
      wordEl.className = 'word';
      wordEl.textContent = d.word;
      el.appendChild(wordEl);

      const trRow = document.createElement('div');
      trRow.className = 'translation';
      if (d.pos) {
        const pos = document.createElement('span');
        pos.className = 'pos';
        pos.textContent = d.pos;
        trRow.appendChild(pos);
      }
      trRow.appendChild(document.createTextNode(d.translation));
      el.appendChild(trRow);

      if (d.example_en) {
        const ex = document.createElement('div');
        ex.className = 'example';
        const en = document.createElement('div');
        en.className = 'example-en';
        en.textContent = d.example_en;
        ex.appendChild(en);
        if (d.example_zh) {
          const zh = document.createElement('div');
          zh.className = 'example-zh';
          zh.textContent = d.example_zh;
          ex.appendChild(zh);
        }
        el.appendChild(ex);
      }
    }
  }
})();
