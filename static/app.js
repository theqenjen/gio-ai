const form = document.querySelector('#chat-form');
const input = document.querySelector('#message-input');
const messagesEl = document.querySelector('#messages');
const welcome = document.querySelector('#welcome');
const sendButton = document.querySelector('#send-button');
const modelSelect = document.querySelector('#model-select');
const historyEl = document.querySelector('#chat-history');
const toastEl = document.querySelector('#toast');
let messages = [];
let busy = false;
let toastTimer;

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 4500);
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function renderMessage(role, text, pending = false) {
  const row = document.createElement('article');
  row.className = `message-row ${role}`;
  const avatar = role === 'assistant' ? '<span class="message-avatar">g</span>' : '';
  row.innerHTML = `${avatar}<div class="message-body"><div class="message-author">${role === 'assistant' ? 'Gio' : 'You'}</div><div class="message-content ${pending ? 'pending' : ''}">${text ? escapeHtml(text).replace(/\n/g, '<br>') : '<span class="typing-dots"><i></i><i></i><i></i></span>'}</div></div>`;
  messagesEl.appendChild(row);
  row.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return row.querySelector('.message-content');
}

function updateHistory() {
  if (!messages.length) {
    historyEl.innerHTML = '<div class="empty-history">Your conversations<br>will show up here.</div>';
    return;
  }
  const firstUserMessage = messages.find(message => message.role === 'user')?.content || 'New conversation';
  historyEl.innerHTML = '';
  const item = document.createElement('button');
  item.className = 'history-item active';
  item.textContent = firstUserMessage;
  item.title = firstUserMessage;
  historyEl.appendChild(item);
}

async function loadModels() {
  try {
    const response = await fetch('/api/models');
    const data = await response.json();
    modelSelect.innerHTML = '';
    if (!data.models?.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Ollama not connected';
      modelSelect.appendChild(option);
      if (data.error) showToast('Start Ollama and pull a model to begin chatting.');
      return;
    }
    for (const name of data.models) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      modelSelect.appendChild(option);
    }
    const preferred = data.models.find(name => name.startsWith('llama3.2'));
    if (preferred) modelSelect.value = preferred;
  } catch {
    modelSelect.innerHTML = '<option value="">Ollama not connected</option>';
    showToast('Could not reach Gio. Is the server running?');
  }
}

async function sendMessage(text) {
  const content = text.trim();
  if (!content || busy) return;
  busy = true;
  sendButton.disabled = true;
  input.value = '';
  input.style.height = 'auto';
  welcome.hidden = true;
  messages.push({ role: 'user', content });
  renderMessage('user', content);
  const assistantMessage = { role: 'assistant', content: '' };
  messages.push(assistantMessage);
  const output = renderMessage('assistant', '', true);
  updateHistory();
  let received = false;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.slice(0, -1), model: modelSelect.value || null })
    });
    if (!response.ok || !response.body) throw new Error(`Request failed (${response.status})`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let chunk;
        try { chunk = JSON.parse(line); } catch { continue; }
        if (chunk.error) throw new Error(chunk.error);
        const piece = chunk.message?.content || '';
        if (piece) {
          received = true;
          assistantMessage.content += piece;
          output.classList.remove('pending');
          output.innerHTML = escapeHtml(assistantMessage.content).replace(/\n/g, '<br>');
          output.closest('.message-row').scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
        if (chunk.done) break;
      }
    }
    if (buffer.trim()) {
      const chunk = JSON.parse(buffer);
      if (chunk.error) throw new Error(chunk.error);
      assistantMessage.content += chunk.message?.content || '';
    }
    if (!received && !assistantMessage.content) throw new Error('The model returned an empty response.');
  } catch (error) {
    messages.pop();
    output.closest('.message-row').remove();
    showToast(error.message || 'Something went wrong while generating a reply.');
  } finally {
    busy = false;
    sendButton.disabled = false;
    input.focus();
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  sendMessage(input.value);
});

input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
});

document.querySelectorAll('.suggestion').forEach(button => {
  button.addEventListener('click', () => sendMessage(button.dataset.prompt));
});

document.querySelector('#new-chat').addEventListener('click', () => {
  if (busy) return;
  messages = [];
  messagesEl.innerHTML = '';
  welcome.hidden = false;
  updateHistory();
  input.focus();
});

document.querySelector('#clear-chat').addEventListener('click', () => {
  if (busy) return;
  messages = [];
  messagesEl.innerHTML = '';
  welcome.hidden = false;
  updateHistory();
});

document.querySelector('#mobile-menu').addEventListener('click', () => {
  document.querySelector('#sidebar').classList.toggle('open');
});

document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.querySelector('#new-chat').click();
  }
});

loadModels();
