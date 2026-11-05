// Turns a MediaStream into speech-bounded 16 kHz mono WAV chunks (simple energy-based VAD).
(function () {
  function encodeWav(float32, sampleRate) {
    const buf = new ArrayBuffer(44 + float32.length * 2);
    const v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + float32.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, float32.length * 2, true);
    let o = 44;
    for (let i = 0; i < float32.length; i++, o += 2) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buf;
  }

  class Capturer {
    constructor(stream, o) {
      this.stream = stream;
      this.onChunk = o.onChunk;
      this.maxSec = o.maxSeconds || 4;       // flush at least this often while speaking
      this.silenceSec = o.silenceSeconds || 0.5;
      this.threshold = o.threshold || 0.012;
      this.rate = 16000;
      this.frames = []; this.samples = 0; this.speech = false; this.silent = 0;
    }
    start() {
      this.ctx = new AudioContext({ sampleRate: this.rate });
      this.src = this.ctx.createMediaStreamSource(this.stream);
      this.proc = this.ctx.createScriptProcessor(4096, 1, 1);
      this.proc.onaudioprocess = (e) => this._frame(e.inputBuffer.getChannelData(0));
      this.src.connect(this.proc);
      this.proc.connect(this.ctx.destination); // outputs silence; required for the node to run
    }
    _frame(data) {
      const f = new Float32Array(data);
      let sum = 0;
      for (let i = 0; i < f.length; i++) sum += f[i] * f[i];
      const rms = Math.sqrt(sum / f.length);
      const dur = f.length / this.rate;
      this.frames.push(f); this.samples += f.length;
      if (rms > this.threshold) { this.speech = true; this.silent = 0; } else this.silent += dur;
      if (!this.speech) { while (this.frames.length > 3) this.frames.shift(); this.samples = this.frames.length * f.length; return; }
      const total = this.samples / this.rate;
      if ((this.silent >= this.silenceSec && total > 0.8) || total >= this.maxSec) this._flush();
    }
    _flush() {
      const out = new Float32Array(this.samples);
      let o = 0;
      for (const f of this.frames) { out.set(f, o); o += f.length; }
      this.frames = []; this.samples = 0; this.speech = false; this.silent = 0;
      this.onChunk(encodeWav(out, this.rate));
    }
    stop() {
      try { this.proc.disconnect(); this.src.disconnect(); this.ctx.close(); } catch {}
      this.stream.getTracks().forEach((t) => t.stop());
    }
  }
  window.Capturer = Capturer;
})();
