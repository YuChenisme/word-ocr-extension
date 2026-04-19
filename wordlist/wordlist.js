const grid = document.getElementById('grid');
const emptyEl = document.getElementById('empty');
const countEl = document.getElementById('count');
const searchEl = document.getElementById('search');
const tpl = document.getElementById('card-tpl');

let allWords = [];
let keyword = '';

async function load() {
  allWords = await window.WordStorage.listWords();
  render();
}

function render() {
  grid.innerHTML = '';
  const kw = keyword.trim().toLowerCase();
  const filtered = kw
    ? allWords.filter(w =>
        (w.word || '').toLowerCase().includes(kw) ||
        (w.translation || '').includes(keyword) ||
        (w.pos || '').toLowerCase().includes(kw)
      )
    : allWords;

  countEl.textContent = `${allWords.length} 個單字${kw ? `（顯示 ${filtered.length}）` : ''}`;

  if (allWords.length === 0) {
    emptyEl.hidden = false;
    grid.hidden = true;
    return;
  }
  emptyEl.hidden = true;
  grid.hidden = false;

  for (const w of filtered) {
    grid.appendChild(makeCard(w));
  }
}

function makeCard(w) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.querySelector('.word').textContent = w.word;
  const posEl = node.querySelector('.pos');
  if (w.pos) posEl.textContent = w.pos; else posEl.remove();
  node.querySelector('.translation').textContent = w.translation || '';
  node.querySelector('.example-en').textContent = w.example_en || '';
  node.querySelector('.example-zh').textContent = w.example_zh || '';

  node.querySelector('.btn-speak').addEventListener('click', () => speak(w.word));
  node.querySelector('.btn-delete').addEventListener('click', async () => {
    if (!confirm(`確定要刪除「${w.word}」嗎？`)) return;
    await window.WordStorage.deleteWord(w.id);
    await load();
  });
  return node;
}

let currentAudio = null;

function speak(word) {
  // 優先使用 Google 翻譯 TTS，品質較好；失敗時退回瀏覽器內建 Web Speech API
  const url =
    'https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=' +
    encodeURIComponent(word);

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  const audio = new Audio(url);
  currentAudio = audio;
  audio.play().catch((err) => {
    console.warn('[speak] Google TTS 失敗，改用 Web Speech API', err);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-US';
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } else {
      alert('發音失敗：' + err.message);
    }
  });
}

searchEl.addEventListener('input', (e) => {
  keyword = e.target.value;
  render();
});

// 當其他分頁透過 OCR 新增單字，本頁即時更新
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.words) {
    load();
  }
});

load();
