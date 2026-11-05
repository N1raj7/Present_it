const { contextBridge, ipcRenderer } = require('electron');

const CHANNELS = new Set([
  'config:updated', 'answer:start', 'answer:chunk', 'answer:done', 'answer:error',
  'cmd:toggle-follow', 'cmd:toggle-listen', 'cmd:nudge', 'cmd:clickthrough'
]);

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  transcribe: (buf, prompt) => ipcRenderer.invoke('stt:transcribe', buf, prompt),
  ask: (question) => ipcRenderer.invoke('llm:ask', question),
  clearHistory: () => ipcRenderer.send('llm:clear'),
  openControl: () => ipcRenderer.send('win:control'),
  hideSelf: () => ipcRenderer.send('win:hide-self'),
  resizeBegin: () => ipcRenderer.invoke('win:resize-begin'),
  resizeBy: (dx, dy) => ipcRenderer.send('win:resize-by', dx, dy),
  quit: () => ipcRenderer.send('app:quit'),
  on: (channel, cb) => {
    if (CHANNELS.has(channel)) ipcRenderer.on(channel, (_e, ...args) => cb(...args));
  }
});
