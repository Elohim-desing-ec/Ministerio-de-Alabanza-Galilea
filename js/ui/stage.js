/* =========================================================================
   SELAH · Modo escenario
   Pantalla completa, fondo oscuro, letra grande, canción por canción
   en la tonalidad del evento. Teclas: ← → cambian de canción,
   espacio inicia/pausa el desplazamiento automático, Esc sale.
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, I = App.icon, esc = U.esc;

  let el = null;
  let st = null;
  let raf = null;
  let wakeLock = null;

  function items() {
    if (st.eventId) {
      const ev = M.event(st.eventId);
      return ev ? ev.setlist.map((it) => ({ song: M.song(it.songId), key: it.key, leader: M.member(it.leaderId) })).filter((x) => x.song) : [];
    }
    const s = M.song(st.songId);
    return s ? [{ song: s, key: st.key || s.key, leader: null }] : [];
  }

  function draw() {
    const list = items();
    if (!list.length) { close(); return; }
    st.index = Math.min(Math.max(0, st.index), list.length - 1);
    const cur = list[st.index];
    const next = list[st.index + 1];
    const s = cur.song;
    const n = App.chords.semitones(s.key, cur.key);
    const ev = st.eventId ? M.event(st.eventId) : null;

    el.innerHTML = `
      <header class="stage-top">
        <div class="stage-title">
          <span class="stage-count mono">${st.index + 1}/${list.length}</span>
          <div class="grow">
            <h2>${esc(s.title)}</h2>
            <p>${ev ? esc(ev.title) + ' · ' : ''}${cur.leader ? 'Dirige ' + esc(cur.leader.name) + ' · ' : ''}<span class="mono">${s.bpm} BPM · ${esc(s.time || '4/4')}</span></p>
          </div>
          <span class="stage-key mono">${esc(App.chords.formatKey(cur.key, st.mode))}</span>
        </div>
        <div class="stage-tools">
          <div class="stage-seg">
            <button class="${st.mode === 'letras' ? 'is-on' : ''}" data-mode="letras">C</button>
            <button class="${st.mode === 'latino' ? 'is-on' : ''}" data-mode="latino">Do</button>
            <button class="${st.mode === 'numeros' ? 'is-on' : ''}" data-mode="numeros">1</button>
          </div>
          <button class="stage-btn ${st.chords ? '' : 'is-off'}" data-act="chords">${st.chords ? 'Acordes' : 'Solo letra'}</button>
          <button class="stage-btn" data-act="smaller" aria-label="Letra más pequeña">A−</button>
          <button class="stage-btn" data-act="bigger" aria-label="Letra más grande">A+</button>
          <button class="stage-btn ${st.scrolling ? 'is-live' : ''}" data-act="scroll" aria-label="Desplazamiento automático">${I(st.scrolling ? 'pause' : 'play', 14)} <span class="mono">${st.speed}×</span></button>
          <button class="stage-btn" data-act="close" aria-label="Salir del modo escenario">${I('x', 16)}</button>
        </div>
      </header>
      <div class="stage-body" id="stage-body">
        <div class="chart stage-chart ${st.chords ? '' : 'chart--lyrics'}" style="--chart-size:${st.size}px">
          ${App.chords.render(s.chart, { n, key: s.key, mode: st.mode, arrangement: s.arrangement })}
        </div>
        ${s.notes ? `<p class="stage-notes">${esc(s.notes)}</p>` : ''}
      </div>
      <footer class="stage-foot">
        <button class="stage-nav" data-act="prev" ${st.index === 0 ? 'disabled' : ''}>${I('chevron-left', 20)} Anterior</button>
        <span class="stage-next">${next ? `Sigue: <strong>${esc(next.song.title)}</strong> <span class="mono">${esc(App.chords.formatKey(next.key, st.mode))}</span>` : 'Última canción'}</span>
        <button class="stage-nav" data-act="next" ${next ? '' : 'disabled'}>Siguiente ${I('chevron-right', 20)}</button>
      </footer>`;
  }

  function tick() {
    const body = el && el.querySelector('#stage-body');
    if (!body || !st.scrolling) { raf = null; return; }
    st.acc += 0.25 * st.speed;
    if (st.acc >= 1) { body.scrollTop += Math.floor(st.acc); st.acc -= Math.floor(st.acc); }
    raf = requestAnimationFrame(tick);
  }

  function setScrolling(on) {
    st.scrolling = on;
    if (on && !raf) { st.acc = 0; raf = requestAnimationFrame(tick); }
    if (!on && raf) { cancelAnimationFrame(raf); raf = null; }
  }

  function onKey(e) {
    if (!el) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') { st.index++; setScrolling(false); draw(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { st.index--; setScrolling(false); draw(); }
    else if (e.key === ' ') { e.preventDefault(); setScrolling(!st.scrolling); draw(); }
  }

  function onClick(e) {
    const mode = e.target.closest('[data-mode]');
    if (mode) { st.mode = mode.dataset.mode; draw(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'close': close(); return;
      case 'prev': st.index--; setScrolling(false); el.querySelector('#stage-body').scrollTop = 0; break;
      case 'next': st.index++; setScrolling(false); el.querySelector('#stage-body').scrollTop = 0; break;
      case 'chords': st.chords = !st.chords; break;
      case 'smaller': st.size = Math.max(16, st.size - 2); break;
      case 'bigger': st.size = Math.min(48, st.size + 2); break;
      case 'scroll':
        if (st.scrolling) { st.speed = st.speed >= 3 ? 1 : st.speed + 1; if (st.speed === 1) setScrolling(false); }
        else setScrolling(true);
        break;
    }
    const top = el.querySelector('#stage-body').scrollTop;
    draw();
    if (b.dataset.act !== 'prev' && b.dataset.act !== 'next') el.querySelector('#stage-body').scrollTop = top;
  }

  function open(opts) {
    if (el) close();
    st = Object.assign({ index: 0, mode: App.store.state.prefs.notation, chords: true, size: 26, scrolling: false, speed: 1, acc: 0 }, opts);
    el = document.createElement('div');
    el.className = 'stage';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Modo escenario');
    document.body.appendChild(el);
    document.body.classList.add('no-scroll');
    draw();
    el.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    try { if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); } catch (e) { /* sin pantalla completa */ }
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { wakeLock = w; }).catch(() => {}); } catch (e) { /* sin wake lock */ }
  }

  function close() {
    if (!el) return;
    setScrolling(false);
    document.removeEventListener('keydown', onKey);
    try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) { /* nada */ }
    try { if (wakeLock) wakeLock.release(); } catch (e) { /* nada */ }
    wakeLock = null;
    el.remove();
    el = null;
    document.body.classList.remove('no-scroll');
  }

  App.stage = {
    openEvent: (eventId, index = 0) => open({ eventId, index }),
    openSong: (songId, key) => open({ songId, key }),
    close
  };
})();
