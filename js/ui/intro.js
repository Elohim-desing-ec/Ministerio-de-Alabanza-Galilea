/* =========================================================================
   SELAH · Intro al abrir la app
   Oscuridad total: el arco del logo aparece como un hilo de luz neón,
   gira en 3D hasta mostrarse completo, destella, se enciende el punto,
   aparece su reflejo y luego el nombre del ministerio.
   Dura unos 3 segundos (menos con "reducir movimiento") y se salta con
   un toque. Mientras tanto la app se conecta con la base de datos.
   Uso: const intro = App.intro.show(); await intro.ready; await intro.leave();
   ========================================================================= */
(function () {
  const esc = App.utils.esc;

  // Logo (arco + punto). También lo usa la pantalla de entrada.
  const MARK = `
    <svg class="intro-logo" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="intro-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#FFFFFF"/>
          <stop offset=".55" stop-color="#E6E4FF"/>
          <stop offset="1" stop-color="#C9D6FF"/>
        </linearGradient>
      </defs>
      <path class="intro-arc" d="M22.5 77.5a37.5 37.5 0 0 1 75 0" pathLength="1" fill="none" stroke="url(#intro-arc)" stroke-width="9" stroke-linecap="round"/>
      <circle class="intro-dot" cx="60" cy="78" r="8.5" fill="#fff"/>
      <path class="intro-base" d="M18 97.5h84" pathLength="1" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/>
    </svg>`;

  // Logo de neón para la intro
  const NEON = `
    <svg class="neon-svg" viewBox="0 0 120 120" aria-hidden="true">
      <path class="neon-arc" d="M22.5 77.5a37.5 37.5 0 0 1 75 0" pathLength="1" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
      <circle class="neon-dot" cx="60" cy="78" r="7.5" fill="#fff"/>
    </svg>`;

  App.intro = {
    MARK,
    show() {
      const s = (App.store.state && App.store.state.settings) || {};
      const church = s.churchName || App.config.churchName;
      const ministry = s.ministryName || App.config.ministryName;
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const el = document.createElement('div');
      el.className = 'intro';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-label', `${ministry} ${church}`);
      el.innerHTML = `
        <div class="intro-bg" aria-hidden="true"><span class="intro-halo"></span><span class="intro-rim"></span><span class="intro-floor"></span></div>
        <div class="intro-center">
          <div class="intro-stage" aria-hidden="true">
            <div class="intro-neon">
              ${NEON}
              <span class="intro-flare"></span>
              <span class="intro-streak"></span>
            </div>
            <div class="intro-reflect">${NEON}</div>
          </div>
          <p class="intro-eyebrow">${esc(ministry)}</p>
          <h1 class="intro-title" aria-hidden="true">${Array.from(church).map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('')}</h1>
          <p class="intro-tag">${esc(App.config.appName)} · ${esc(App.config.appTagline)}</p>
        </div>
        <p class="intro-status"><span class="typing"><span></span><span></span><span></span></span> Conectando con el ministerio…</p>
        <p class="intro-hint">Toca para continuar</p>`;
      document.body.appendChild(el);
      if (reduce) el.classList.add('is-reduced');

      let resolveReady;
      const ready = new Promise((r) => { resolveReady = r; });
      const minTime = reduce ? 600 : 3000;
      const t = setTimeout(() => resolveReady(), minTime);
      const waitTimer = setTimeout(() => el.classList.add('is-waiting'), minTime + 350);
      const skip = () => { clearTimeout(t); el.classList.add('is-skipped'); resolveReady(); };
      const onKey = (e) => { if (['Enter', ' ', 'Escape'].includes(e.key)) skip(); };
      el.addEventListener('click', skip);
      document.addEventListener('keydown', onKey);

      return {
        ready,
        leave() {
          clearTimeout(waitTimer);
          document.removeEventListener('keydown', onKey);
          el.classList.add('is-leaving');
          return new Promise((r) => setTimeout(() => { el.remove(); r(); }, reduce ? 160 : 800));
        }
      };
    }
  };
})();
