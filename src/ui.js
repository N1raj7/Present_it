// Shared: bottom-right resize grip for frameless overlay windows.
window.attachGrip = function (el) {
  el.addEventListener('mousedown', async (e) => {
    e.preventDefault();
    await api.resizeBegin();
    const sx = e.screenX, sy = e.screenY;
    const move = (ev) => api.resizeBy(ev.screenX - sx, ev.screenY - sy);
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });
};
