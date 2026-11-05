(async function () {
  const $ = (id) => document.getElementById(id);
  let cfg = await api.getConfig();
  let tokens = [], spans = [], pos = 0, mic = null, sys = null;
  const follower = new Matcher.Follower([]);
  let lastScript = null;

  function setStatus(msg, err) { $('status').textContent = msg; $('status').classList.toggle('err', !!err); }

  function applyUI() {
    document.documentElement.style.setProperty('--fs', cfg.ui.fontSize + 'px');
    document.documentElement.style.setProperty('--bgA', cfg.ui.opacity);
  }

  function renderScript() {
    const el = $('script');
    el.textContent = '';
    tokens = Matcher.tokenize(cfg.script);
    spans = tokens.map((t, i) => {
      const s = document.createElement('span');
      s.className = 'w'; s.textContent = t.raw; s.dataset.i = i;
      el.appendChild(s);
      el.appendChild(document.createTextNode(t.ws));
      return s;
    });
    follower.setTokens(tokens);
    setPos(0, true);
  }

  function setPos(p, jump) {
    pos = Math.max(0, Math.min(tokens.length, p));
    follower.pos = pos;
    for (let i = 0; i < spans.length; i++) {
      const c = i < pos ? 'w read' : i === pos ? 'w cur' : 'w';
      if (spans[i].className !== c) spans[i].className = c;
    }
    const target = spans[Math.min(pos, spans.length - 1)];
    if (target) {
      const sc = $('scroller');
      sc.scrollTo({ top: Math.max(0, target.offsetTop - sc.clientHeight * 0.3), behavior: jump ? 'auto' : 'smooth' });
    }
  }

  function makeCapturer(stream, handler) {
    let q = Promise.resolve();
    const cap = new Capturer(stream, { onChunk: (buf) => { q = q.then(() => handler(buf)).catch(() => {}); } });
    cap.start();
    return cap;
  }

  // ----- follow my voice -----
  async function onMicChunk(buf) {
    const prompt = tokens.slice(pos, pos + 25).map((t) => t.raw).join(' ');
    const r = await api.transcribe(buf, prompt);
    if (r.error) return setStatus(r.error, true);
    if (!r.text) return;
    setStatus('▸ ' + r.text.slice(-70));
    setPos(follower.feed(r.text));
  }
  async function startFollow() {
    try {
      const id = cfg.audio.micDeviceId;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: id && id !== 'default' ? { exact: id } : undefined, echoCancellation: true, noiseSuppression: true }
      });
      mic = makeCapturer(stream, onMicChunk);
      $('btnFollow').classList.add('on');
      setStatus('following your voice…');
    } catch (e) { setStatus('Mic error: ' + e.message, true); }
  }
  function stopFollow() { mic?.stop(); mic = null; $('btnFollow').classList.remove('on'); setStatus('idle'); }

  // ----- listen for questions -----
  let heard = '', lastHeard = '', heardTimer = null;
  async function onSysChunk(buf) {
    const r = await api.transcribe(buf, '');
    if (r.error) return setStatus(r.error, true);
    if (!r.text) return;
    heard += (heard ? ' ' : '') + r.text;
    lastHeard = (lastHeard + ' ' + r.text).split(/\s+/).slice(-60).join(' ');
    $('heard').textContent = '👂 ' + r.text;
    clearTimeout(heardTimer);
    heardTimer = setTimeout(() => {
      const t = heard.trim(); heard = '';
      if (cfg.ui.autoAsk && Detect.isQuestion(t)) api.ask(Detect.extractQuestion(t));
    }, 1800);
  }
  async function startListen() {
    try {
      let stream;
      if (cfg.audio.otherSource === 'system') {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        stream.getVideoTracks().forEach((t) => { stream.removeTrack(t); t.stop(); });
        if (!stream.getAudioTracks().length) throw new Error('no system audio; pick an input device in Settings (e.g. BlackHole on Mac)');
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: cfg.audio.otherSource } } });
      }
      sys = makeCapturer(stream, onSysChunk);
      $('btnListen').classList.add('on');
      setStatus('listening for questions…');
    } catch (e) { setStatus('Listen error: ' + e.message, true); }
  }
  function stopListen() { sys?.stop(); sys = null; $('btnListen').classList.remove('on'); setStatus('idle'); }

  // ----- UI wiring -----
  const toggleFollow = () => (mic ? stopFollow() : startFollow());
  const toggleListen = () => (sys ? stopListen() : startListen());
  $('btnFollow').onclick = toggleFollow;
  $('btnListen').onclick = toggleListen;
  $('btnAsk').onclick = () => { if (lastHeard) api.ask(lastHeard); else setStatus('nothing heard yet', true); };
  $('btnSettings').onclick = () => api.openControl();
  $('btnQuit').onclick = () => api.quit();
  $('fontUp').onclick = () => api.setConfig({ ui: { fontSize: Math.min(60, cfg.ui.fontSize + 2) } });
  $('fontDown').onclick = () => api.setConfig({ ui: { fontSize: Math.max(12, cfg.ui.fontSize - 2) } });
  $('script').addEventListener('click', (e) => { const i = e.target.dataset?.i; if (i !== undefined) setPos(Number(i)); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') setPos(pos + 1);
    else if (e.key === 'ArrowLeft') setPos(pos - 1);
    else if (e.key === 'ArrowDown') setPos(pos + 8);
    else if (e.key === 'ArrowUp') setPos(pos - 8);
  });
  attachGrip($('grip'));

  api.on('cmd:toggle-follow', toggleFollow);
  api.on('cmd:toggle-listen', toggleListen);
  api.on('cmd:nudge', (n) => setPos(pos + n));
  api.on('cmd:clickthrough', (on) => { $('clickthrough').style.display = on ? 'block' : 'none'; });
  api.on('config:updated', (c) => {
    cfg = c; applyUI();
    if (cfg.script !== lastScript) { lastScript = cfg.script; renderScript(); }
  });

  applyUI(); lastScript = cfg.script; renderScript();
})();
