// Heuristic "was that a question?" detector for transcribed audience speech.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Detect = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const WH = /^(what|why|how|when|where|who|whom|whose|which)\b/i;
  const AUX = /^(can|could|would|should|will|do|does|did|is|are|was|were|have|has|had|may|might|shall|isn't|aren't|don't|doesn't|won't|can't|couldn't|wouldn't)\b/i;
  const IMP = /^(tell me|explain|walk me through|any thoughts|i was wondering|my question)\b/i;
  const strip = (s) => s.replace(/^((so|and|but|ok|okay|um|uh|well|right|sorry|hi|hey)[,\s]+)+/i, '').trim();
  const sentences = (t) => t.split(/(?<=[.!?])\s+/).filter(Boolean);

  function isQuestion(text) {
    const t = (text || '').trim();
    if (t.split(/\s+/).length < 3) return false;
    if (t.includes('?')) return true;
    const last = strip(sentences(t).pop() || '');
    return WH.test(last) || AUX.test(last) || IMP.test(last);
  }
  function extractQuestion(text) {
    const s = sentences((text || '').trim());
    return s.slice(-2).join(' ').slice(-400);
  }
  return { isQuestion, extractQuestion };
});
