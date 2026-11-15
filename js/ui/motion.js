/* =========================================================================
   SELAH · Tarjetas que se inclinan en 3D al pasar el mouse (.tilt)
   Solo en computadora (puntero fino); en el celular no hace nada.
   ========================================================================= */
(function () {
  if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let cur = null;
  const reset = () => {
    if (!cur) return;
    cur.classList.remove('is-tilting');
    cur.style.removeProperty('--rx');
    cur.style.removeProperty('--ry');
    cur = null;
  };
  document.addEventListener('pointermove', (e) => {
    const el = e.target && e.target.closest ? e.target.closest('.tilt') : null;
    if (cur && cur !== el) reset();
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
    el.style.setProperty('--ry', ((x - 0.5) * 9).toFixed(2) + 'deg');
    el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    el.classList.add('is-tilting');
    cur = el;
  }, { passive: true });
  document.addEventListener('pointerleave', reset);
  window.addEventListener('blur', reset);
})();
