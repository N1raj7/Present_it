(async function () {
  let cfg = await api.getConfig();
  const PRESETS = {
    'stt:groq': { stt: { baseUrl: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo' } },
    'stt:local': { stt: { baseUrl: 'http://localhost:8000/v1', model: 'Systran/faster-whisper-small' } },
    'llm:groq': { llm: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' } },
    'llm:gemini': { llm: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' } },
    'llm:ollama': { llm: { baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' } }
  };
  const get = (o, p) => p.split('.').reduce((a, k) => (a ? a[k] : undefined), o);
  const set = (o, p, v) => { const ks = p.split('.'); const l = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[l] = v; };
  const fields = [...document.querySelectorAll('[data-key]')];

  async function devices() {
    try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop()); } catch {}
    const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    const mk = (sel, first) => {
      sel.textContent = '';
      for (const [v, t] of [...first, ...list.map((d) => [d.deviceId, d.label || 'Input ' + d.deviceId.slice(0, 6)])]) {
        const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o);
      }
    };
    mk(document.getElementById('micSel'), [['default', 'System default']]);
    mk(document.getElementById('otherSel'), [['system', 'System audio (what you hear)']]);
  }

  function fill() {
    for (const el of fields) {
      const v = get(cfg, el.dataset.key);
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
    }
  }

  fill();
  // device list loads in the background so it can never block Save
  Promise.race([devices(), new Promise((r) => setTimeout(r, 4000))]).then(fill).catch(() => {});

  document.querySelectorAll('[data-preset]').forEach((b) => (b.onclick = () => {
    const p = PRESETS[b.dataset.preset];
    for (const sec in p) for (const k in p[sec]) document.querySelector(`[data-key="${sec}.${k}"]`).value = p[sec][k];
  }));

  async function save(quiet) {
    const patch = {};
    for (const el of fields) {
      const v = el.type === 'checkbox' ? el.checked : el.type === 'number' || el.type === 'range' ? Number(el.value) : el.value;
      set(patch, el.dataset.key, v);
    }
    const s = document.getElementById('saved');
    try {
      cfg = await api.setConfig(patch);
      const words = (cfg.script.match(/\S+/g) || []).length;
      s.style.color = '#46d37a';
      s.textContent = quiet ? '' : `Saved ✓  (${words} words in script)`;
      if (!quiet) setTimeout(() => (s.textContent = ''), 3000);
    } catch (e) {
      s.style.color = '#ff6b6b';
      s.textContent = 'Save failed: ' + e.message;
    }
  }
  document.getElementById('save').onclick = () => save(false);
  // autosave the script shortly after you stop typing/pasting
  let t;
  document.querySelector('[data-key="script"]').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => save(true), 500); });
})();
