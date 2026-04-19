// Gemini API 封裝：給定英文單字，回傳 JSON（中文翻譯 / 詞性 / 英文例句 / 例句中譯）。
// 使用 gemini-2.5-flash（快速、經濟）。透過 responseMimeType 強制 JSON 輸出。

(function () {
  const MODEL = 'gemini-2.5-flash';
  const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const SYSTEM_PROMPT =
    '你是一個專業的英文學習助教。使用者會給你一個英文單字，你必須回傳一個嚴格的 JSON 物件，' +
    '包含以下欄位：word（原單字，小寫原形）、translation（繁體中文翻譯，簡潔）、' +
    'pos（詞性，使用 n./v./adj./adv./prep./conj./pron. 這類縮寫，多詞性用斜線分隔，例如 n./v.）、' +
    'example_en（一句自然、日常、長度適中的英文例句，務必包含該單字）、' +
    'example_zh（上述英文例句的繁體中文翻譯）。除了 JSON 物件本身外，不要輸出任何其他文字。';

  async function callGemini(apiKey, body) {
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Gemini API 錯誤 ${resp.status}：${text.slice(0, 300)}`);
    }
    return resp.json();
  }

  async function translate(word) {
    const apiKey = await window.WordStorage.getApiKey();
    if (!apiKey) {
      const err = new Error('尚未設定 Gemini API Key');
      err.code = 'NO_API_KEY';
      throw err;
    }

    const data = await callGemini(apiKey, {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: 'user',
        parts: [{ text: `請處理這個英文單字：${word}` }]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    });

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error('Gemini 回傳內容為空');

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      throw new Error('Gemini 回傳非合法 JSON：' + content);
    }

    return {
      word: parsed.word || word,
      translation: parsed.translation || '',
      pos: parsed.pos || '',
      example_en: parsed.example_en || '',
      example_zh: parsed.example_zh || ''
    };
  }

  async function ping() {
    const apiKey = await window.WordStorage.getApiKey();
    if (!apiKey) throw new Error('尚未設定 API Key');
    await callGemini(apiKey, {
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      generationConfig: { maxOutputTokens: 1 }
    });
    return true;
  }

  const api = { translate, ping };
  if (typeof window !== 'undefined') window.AIService = api;
})();
