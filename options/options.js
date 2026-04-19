const input = document.getElementById('api-key');
const saveBtn = document.getElementById('save');
const testBtn = document.getElementById('test');
const toggleBtn = document.getElementById('toggle-visibility');
const statusEl = document.getElementById('status');

function showStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + (kind || '');
  if (kind === 'success') {
    setTimeout(() => {
      if (statusEl.textContent === msg) {
        statusEl.textContent = '';
        statusEl.className = 'status';
      }
    }, 2500);
  }
}

async function init() {
  const key = await window.WordStorage.getApiKey();
  if (key) input.value = key;
}

saveBtn.addEventListener('click', async () => {
  const key = input.value.trim();
  if (!key) {
    showStatus('請先輸入 API Key', 'error');
    return;
  }
  await window.WordStorage.setApiKey(key);
  showStatus('已儲存 ✓', 'success');
});

testBtn.addEventListener('click', async () => {
  const key = input.value.trim();
  if (!key) {
    showStatus('請先輸入 API Key', 'error');
    return;
  }
  await window.WordStorage.setApiKey(key);
  showStatus('連線測試中...', '');
  testBtn.disabled = true;
  try {
    await window.AIService.ping();
    showStatus('連線成功 ✓', 'success');
  } catch (e) {
    showStatus('連線失敗：' + e.message, 'error');
  } finally {
    testBtn.disabled = false;
  }
});

toggleBtn.addEventListener('click', () => {
  input.type = input.type === 'password' ? 'text' : 'password';
});

init();
