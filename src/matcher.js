// Script-following engine: tokenizer + fuzzy "where am I in the script" matcher.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Matcher = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const STOP = new Set(('a an the and or but of to in on at for with is are was were be been it its this that these those ' +
    'i you we they he she as by from so if then than not no do does did have has had will would can could should just very really').split(' '));

  const norm = (w) => w.toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}]/gu, '');

  function tokenize(text) {
    const out = [];
    const re = /(\S+)(\s*)/g;
    let m;
    while ((m = re.exec(text || ''))) out.push({ raw: m[1], ws: m[2], norm: norm(m[1]) });
    return out;
  }

  function within1(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
    if (a.length > b.length) return a.slice(i + 1) === b.slice(i);
    return a.slice(i) === b.slice(i + 1);
  }
  const same = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && within1(a, b));

  class Follower {
    constructor(tokens = [], opts = {}) {
      this.lookahead = opts.lookahead || 60;
      this.setTokens(tokens);
    }
    setTokens(tokens) {
      this.norms = tokens.map((t) => t.norm);
      this.pos = 0; // index of the NEXT word you are expected to say
    }
    feed(text) {
      const spoken = tokenize(text).map((t) => t.norm).filter(Boolean);
      if (!spoken.length || !this.norms.length) return this.pos;
      const tail = spoken.slice(-8);
      const weights = tail.map((w) => (STOP.has(w) ? 0.35 : 1));
      const W = weights.reduce((a, b) => a + b, 0);
      const lo = Math.max(0, this.pos - 4);
      const hi = Math.min(this.norms.length - 1, this.pos + (tail.length === 1 ? 12 : this.lookahead));
      let best = -1, bestRaw = 0, bestAdj = -Infinity;
      for (let i = lo; i <= hi; i++) {
        const ws = Math.max(0, i - tail.length - 1);
        const used = new Array(i - ws + 1).fill(false);
        let raw = 0;
        for (let k = tail.length - 1; k >= 0; k--) {
          for (let j = i - ws; j >= 0; j--) {
            if (!used[j] && this.norms[ws + j] && same(tail[k], this.norms[ws + j])) { used[j] = true; raw += weights[k]; break; }
          }
        }
        if (this.norms[i] && same(tail[tail.length - 1], this.norms[i])) raw += weights[tail.length - 1];
        const endHit = this.norms[i] && tail.some((t) => same(t, this.norms[i])) ? 0.3 : 0; // prefer ending on a word you said
        const adj = raw + endHit - 0.004 * Math.abs(i - (this.pos + tail.length - 1));
        if (adj > bestAdj) { bestAdj = adj; best = i; bestRaw = raw; }
      }
      const need = Math.min(2.5, 0.5 * W + 0.8);
      if (best >= 0 && bestRaw >= need) this.pos = best + 1;
      return this.pos;
    }
  }
  return { tokenize, Follower, norm };
});
