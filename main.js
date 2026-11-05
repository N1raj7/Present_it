const { app, BrowserWindow, ipcMain, globalShortcut, screen, session, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

const DEFAULTS = {
  script: 'Paste your script in Settings (the gear button on the notch).\n\nStart following your voice with the Follow button, and the highlight will move as you speak.',
  stt: { baseUrl: 'https://api.groq.com/openai/v1', apiKey: '', model: 'whisper-large-v3-turbo', language: 'en' },
  llm: { baseUrl: 'https://api.groq.com/openai/v1', apiKey: '', model: 'llama-3.3-70b-versatile' },
  audio: { micDeviceId: 'default', otherSource: 'system' },
  ui: { fontSize: 22, opacity: 0.92, autoAsk: true, hideFromCapture: true },
  bounds: {}
};

let cfg, cfgPath;
const wins = {};
let history = [];
let inflight = null;

// ---------- config ----------
function merge(a, b) {
  const out = { ...a };
  for (const k in b) {
    const isObj = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]);
    out[k] = isObj && a[k] && typeof a[k] === 'object' ? merge(a[k], b[k]) : b[k];
  }
  return out;
}
function loadConfig() {
  cfgPath = path.join(app.getPath('userData'), 'config.json');
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
  cfg = merge(DEFAULTS, saved);
}
function saveConfig() {
  try { fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2)); } catch (e) { console.error(e); }
}
function broadcast(channel, ...args) {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel, ...args);
}
const isLocal = (url) => /localhost|127\.0\.0\.1/.test(url || '');

// ---------- windows ----------
function boundsVisible(b) {
  return b && screen.getAllDisplays().some(d => {
    const a = d.workArea;
    return b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y;
  });
}
function createOverlay(name, file, def) {
  const saved = cfg.bounds[name];
  const b = boundsVisible(saved) ? saved : def;
  const w = new BrowserWindow({
    ...b, frame: false, transparent: true, backgroundColor: '#00000000', alwaysOnTop: true,
    skipTaskbar: true, hasShadow: false, resizable: false, fullscreenable: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  w.setAlwaysOnTop(true, 'screen-saver');
  w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  w.setContentProtection(!!cfg.ui.hideFromCapture);
  w.loadFile(path.join(__dirname, 'src', file));
  w.once('ready-to-show', () => { if (name === 'notch') w.show(); });
  let t;
  const persist = () => { clearTimeout(t); t = setTimeout(() => { cfg.bounds[name] = w.getBounds(); saveConfig(); }, 400); };
  w.on('move', persist); w.on('resize', persist);
  wins[name] = w;
  return w;
}
function openControl() {
  if (wins.control && !wins.control.isDestroyed()) { wins.control.show(); wins.control.focus(); return; }
  const w = new BrowserWindow({
    width: 780, height: 700, title: 'Present_it settings', backgroundColor: '#141416', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  w.setContentProtection(!!cfg.ui.hideFromCapture);
  w.loadFile(path.join(__dirname, 'src', 'control.html'));
  wins.control = w;
}
function showAnswer() {
  const w = wins.answer;
  if (w && !w.isDestroyed() && !w.isVisible()) w.showInactive();
}
function applyProtection() {
  for (const w of BrowserWindow.getAllWindows()) w.setContentProtection(!!cfg.ui.hideFromCapture);
}

// ---------- IPC ----------
ipcMain.handle('config:get', () => cfg);
ipcMain.handle('config:set', (_e, patch) => {
  cfg = merge(cfg, patch);
  saveConfig();
  applyProtection();
  broadcast('config:updated', cfg);
  return cfg;
});
ipcMain.on('win:control', openControl);
ipcMain.on('win:hide-self', (e) => BrowserWindow.fromWebContents(e.sender)?.hide());
ipcMain.on('app:quit', () => app.quit());
ipcMain.on('llm:clear', () => { history = []; });

const resizeStart = new Map();
ipcMain.handle('win:resize-begin', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) resizeStart.set(w.id, w.getBounds());
});
ipcMain.on('win:resize-by', (e, dx, dy) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  const b = w && resizeStart.get(w.id);
  if (!b) return;
  w.setBounds({ x: b.x, y: b.y, width: Math.max(300, Math.round(b.width + dx)), height: Math.max(110, Math.round(b.height + dy)) });
});

const HALLUCINATIONS = new Set(['thank you', 'thank you.', 'thanks for watching', 'thanks for watching.', 'thank you for watching', 'thank you for watching.', 'you', 'bye', 'bye.', '.']);

ipcMain.handle('stt:transcribe', async (_e, arrayBuf, prompt) => {
  const c = cfg.stt;
  if (!c.apiKey && !isLocal(c.baseUrl)) return { error: 'Set a speech-to-text API key in Settings' };
  try {
    const form = new FormData();
    form.append('file', new Blob([Buffer.from(arrayBuf)], { type: 'audio/wav' }), 'audio.wav');
    form.append('model', c.model);
    form.append('response_format', 'json');
    form.append('temperature', '0');
    if (c.language) form.append('language', c.language);
    if (prompt) form.append('prompt', String(prompt).slice(-220));
    const res = await fetch(c.baseUrl.replace(/\/+$/, '') + '/audio/transcriptions', {
      method: 'POST',
      headers: c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {},
      body: form
    });
    if (!res.ok) return { error: `STT ${res.status}: ${(await res.text()).slice(0, 160)}` };
    const text = ((await res.json()).text || '').trim();
    if (HALLUCINATIONS.has(text.toLowerCase())) return { text: '' };
    return { text };
  } catch (err) {
    return { error: 'STT failed: ' + (err.message || err) };
  }
});

function systemPrompt() {
  return [
    'You are a discreet real-time assistant for someone who is presenting.',
    'Someone just asked them a question (captured by speech-to-text, so it may be noisy; infer the likely question).',
    'Reply with a short answer the presenter can say out loud: 2-4 sentences, plain text, no markdown, no preamble.',
    "Treat the presenter's script below as the main source of truth. If it does not cover the question, answer from general knowledge and say so briefly.",
    '', 'SCRIPT:', String(cfg.script || '').slice(0, 12000)
  ].join('\n');
}

async function streamChat(c, messages, signal, onToken) {
  const res = await fetch(c.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', ...(c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {}) },
    body: JSON.stringify({ model: c.model, messages, stream: true, temperature: 0.4, max_tokens: 500 })
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try { const t = JSON.parse(data).choices?.[0]?.delta?.content; if (t) onToken(t); } catch {}
    }
  }
}

ipcMain.handle('llm:ask', async (_e, question) => {
  question = String(question || '').trim();
  if (!question) return;
  if (inflight) inflight.abort();
  const ac = new AbortController();
  inflight = ac;
  const out = wins.answer;
  const send = (ch, ...a) => { if (out && !out.isDestroyed()) out.webContents.send(ch, ...a); };
  showAnswer();
  send('answer:start', question);
  const c = cfg.llm;
  if (!c.apiKey && !isLocal(c.baseUrl)) { send('answer:error', 'Set an LLM API key in Settings'); return; }
  try {
    const messages = [{ role: 'system', content: systemPrompt() }, ...history.slice(-6), { role: 'user', content: question }];
    let full = '';
    await streamChat(c, messages, ac.signal, (t) => { full += t; send('answer:chunk', t); });
    history.push({ role: 'user', content: question }, { role: 'assistant', content: full });
    send('answer:done');
  } catch (err) {
    if (err.name === 'AbortError') return;
    send('answer:error', String(err.message || err));
  }
});

// ---------- app ----------
app.whenReady().then(() => {
  loadConfig();
  if (process.platform === 'darwin') app.dock?.hide();

  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === 'media');
  // Lets the renderer capture "what you hear" (other people's voices) via getDisplayMedia.
  session.defaultSession.setDisplayMediaRequestHandler(async (_req, cb) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      cb({ video: sources[0], audio: 'loopback' });
    } catch { cb({}); }
  });

  const wa = screen.getPrimaryDisplay().workArea;
  createOverlay('notch', 'notch.html', { x: Math.round(wa.x + (wa.width - 680) / 2), y: wa.y, width: 680, height: 170 });
  createOverlay('answer', 'answer.html', { x: wa.x + wa.width - 380, y: wa.y + 90, width: 360, height: 440 });

  if (!cfg.stt.apiKey || !cfg.llm.apiKey) openControl();

  const reg = (key, fn) => globalShortcut.register(key, fn);
  let hidden = false;
  reg('CommandOrControl+Shift+H', () => {
    hidden = !hidden;
    for (const n of ['notch', 'answer']) {
      const w = wins[n];
      if (!w || w.isDestroyed()) continue;
      if (hidden) w.hide(); else if (n === 'notch') w.showInactive();
    }
  });
  reg('CommandOrControl+Shift+A', () => {
    const w = wins.answer;
    if (w) (w.isVisible() ? w.hide() : w.showInactive());
  });
  reg('CommandOrControl+Shift+M', () => wins.notch?.webContents.send('cmd:toggle-follow'));
  reg('CommandOrControl+Shift+L', () => wins.notch?.webContents.send('cmd:toggle-listen'));
  reg('CommandOrControl+Shift+Down', () => wins.notch?.webContents.send('cmd:nudge', 8));
  reg('CommandOrControl+Shift+Up', () => wins.notch?.webContents.send('cmd:nudge', -8));
  let through = false;
  reg('CommandOrControl+Shift+C', () => {
    through = !through;
    wins.notch?.setIgnoreMouseEvents(through, { forward: true });
    wins.notch?.webContents.send('cmd:clickthrough', through);
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { /* overlays stay alive; quit via the X button */ });
