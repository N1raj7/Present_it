(async function () {
  const $ = (id) => document.getElementById(id);
  const cfg = await api.getConfig();
  const apply = (c) => document.documentElement.style.setProperty('--bgA', c.ui.opacity);
  apply(cfg);
  api.on('config:updated', apply);

  api.on('answer:start', (q) => { $('qBox').textContent = '“' + q + '”'; $('aBox').textContent = '…'; $('aBox').classList.remove('err'); });
  api.on('answer:chunk', (t) => { const a = $('aBox'); if (a.textContent === '…') a.textContent = ''; a.textContent += t; a.scrollTop = a.scrollHeight; });
  api.on('answer:error', (m) => { $('aBox').textContent = m; $('aBox').classList.add('err'); });
  api.on('answer:done', () => {});

  const send = () => { const v = $('askInput').value.trim(); if (v) { api.ask(v); $('askInput').value = ''; } };
  $('askBtn').onclick = send;
  $('askInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  $('btnClear').onclick = () => { api.clearHistory(); $('qBox').textContent = ''; $('aBox').textContent = 'Memory cleared.'; };
  $('btnHide').onclick = () => api.hideSelf();
  attachGrip($('grip'));
})();
