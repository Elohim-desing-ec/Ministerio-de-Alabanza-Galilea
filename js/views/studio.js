/* =========================================================================
   SELAH · Vista: Estudio
   #estudio          → tus canciones del Estudio y subir una nueva
   #estudio-<id>     → reproductor con pistas separadas, velocidad, tono,
                       metrónomo, conteo, acordes, secciones y letra
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc, S = App.studio, C = App.chords;
  const fmtT = (t) => { t = Math.max(0, t || 0); return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; };
  let unsub = null;

  // ---------------------------------------------------------------------
  // Subir una canción
  // ---------------------------------------------------------------------
  function upload(file) {
    const songs = M.songs().slice().sort((a, b) => a.title.localeCompare(b.title));
    const guess = songs.find((s) => U.normalize(file.name).includes(U.normalize(s.title)));
    let mode = '4';
    const m = ui.modal({
      title: 'Nueva canción en el Estudio',
      size: 'lg',
      body: `
        <div class="field"><label class="field-label" for="sd-name">Nombre</label><input class="input" id="sd-name" value="${esc(file.name.replace(/\.[a-z0-9]+$/i, ''))}"></div>
        <div class="field"><label class="field-label" for="sd-song">¿Qué alabanza es? (para ver la letra y las secciones)</label>
          <select class="select" id="sd-song"><option value="">Ninguna por ahora</option>${songs.map((s) => `<option value="${esc(s.id)}" ${guess && guess.id === s.id ? 'selected' : ''}>${esc(s.title)}</option>`).join('')}</select></div>
        <span class="field-label">Separación</span>
        <div class="sd-modes">
          ${[['2', 'Voz e instrumental', '2 pistas', 'mic'], ['4', 'Voz, batería, bajo y otros', '4 pistas', 'drum'], ['none', 'Sin separar', 'Velocidad, tono y acordes', 'music']].map(([id, t, sub, ic]) => `
            <button type="button" class="sd-mode ${id === mode ? 'is-on' : ''}" data-mode="${id}"><span class="sd-mode-icon">${I(ic, 20)}</span><span class="strong">${t}</span><span class="xsmall muted">${sub}</span></button>`).join('')}
        </div>
        <p class="xsmall muted">La separación se hace en este celular, sin costo y sin subir el audio a ningún lado. Sirve para bajar o quitar voz, batería y bajo; no queda tan limpia como la de Moises, que usa inteligencia artificial en sus servidores.</p>`,
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        {
          label: 'Procesar', kind: 'primary', icon: 'sparkle',
          onClick: async (api) => {
            const id = await S.create(file, { name: api.body.querySelector('#sd-name').value.trim(), mode, songId: api.body.querySelector('#sd-song').value || null });
            App.router.go('estudio', id);
          }
        }
      ]
    });
    m.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      mode = b.dataset.mode;
      m.body.querySelectorAll('.sd-mode').forEach((x) => x.classList.toggle('is-on', x === b));
    });
  }

  // ---------------------------------------------------------------------
  // Biblioteca
  // ---------------------------------------------------------------------
  async function library(root) {
    root.innerHTML = `
      <div class="view view--studio">
        <header class="view-head">
          <div class="titles">
            <span class="eyebrow">Ensayo</span>
            <h1 class="view-title">Estudio</h1>
            <p class="muted">Separa la voz, la batería y el bajo, cambia la velocidad y el tono, y ensaya con el metrónomo, los acordes y la letra. Gratis y en tu celular.</p>
          </div>
        </header>
        <label class="sd-drop" id="sd-drop">
          <input type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg" hidden id="sd-file">
          <span class="sd-drop-icon">${I('arrow-up', 26)}</span>
          <span class="strong">Sube una alabanza</span>
          <span class="small muted">MP3, M4A o WAV · toca aquí o arrastra el archivo</span>
        </label>
        <section class="section">
          <div class="section-head"><h2 class="section-title">Tus canciones en el Estudio</h2><span class="xsmall faint">Se guardan en este celular</span></div>
          <div class="sd-list" id="sd-list"><p class="small muted">Cargando…</p></div>
        </section>
      </div>`;
    const items = await S.list();
    const el = root.querySelector('#sd-list');
    if (!el) return;
    el.innerHTML = items.length ? items.map((it) => {
      const song = it.songId ? M.song(it.songId) : null;
      return `
        <article class="sd-item" data-open="${esc(it.id)}">
          <span class="sd-item-icon">${I('wave', 20)}</span>
          <div class="grow stack-sm">
            <span class="strong truncate">${esc(it.name)}</span>
            <span class="xsmall faint">${esc(S.MODES[it.mode || 'none'].label)}${song ? ' · ' + esc(song.title) : ''}${it.key ? ' · ' + esc(it.key) : ''}${it.an ? ' · ' + Math.round(it.an.bpm) + ' BPM' : ''}</span>
          </div>
          <button class="btn btn--plain btn--icon btn--sm" data-del="${esc(it.id)}" aria-label="Eliminar">${I('trash', 15)}</button>
        </article>`;
    }).join('') : ui.empty({ icon: 'wave', title: 'Todavía no hay canciones', text: 'Sube el MP3 de una alabanza para separar las pistas y ensayar.' });

    root.querySelector('#sd-file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) upload(f); e.target.value = ''; });
    const drop = root.querySelector('#sd-drop');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); const f = e.dataTransfer.files[0]; if (f) upload(f); });
    el.addEventListener('click', async (e) => {
      const d = e.target.closest('[data-del]');
      if (d) {
        e.stopPropagation();
        const ok = await ui.confirm({ title: 'Eliminar del Estudio', message: 'Se borra el audio y sus pistas de este celular.', confirmLabel: 'Eliminar', danger: true });
        if (ok) { await S.remove(d.dataset.del); App.app.refresh(); }
        return;
      }
      const o = e.target.closest('[data-open]');
      if (o) App.router.go('estudio', o.dataset.open);
    });
  }

  // ---------------------------------------------------------------------
  // Reproductor
  // ---------------------------------------------------------------------
  function playerHTML() {
    const st = S.state, it = st.item;
    const song = it && it.songId ? M.song(it.songId) : null;
    const mode = S.MODES[st.mode];
    const notation = App.store.state.prefs.notation;
    const key = st.key ? C.formatKey(C.transposeKey(st.key, st.semis) || st.key, notation) : '—';
    if (st.status !== 'ready') {
      return `
        <div class="view view--studio">
          <a class="back-link" href="#estudio">${I('chevron-left', 16)} Estudio</a>
          <section class="sd-loading">
            ${st.status === 'error' ? `${I('alert', 28)}<p class="strong">${esc(st.error)}</p>` : `
              <span class="sd-spin">${I('wave', 30)}</span>
              <p class="strong">${esc(it ? it.name : 'Abriendo…')}</p>
              <p class="small muted" id="sd-phase">${esc(st.phase || 'Preparando…')}</p>
              <div class="sd-bar"><span id="sd-bar" style="width:${Math.round(st.progress * 100)}%"></span></div>
              <p class="xsmall faint">La primera vez tarda un poco: escucha la canción, reconoce los acordes${st.mode !== 'none' ? ' y separa las pistas' : ''}. Después abre al instante.</p>`}
          </section>
        </div>`;
    }
    const upcoming = st.chords;
    return `
      <div class="view view--studio view--studio-player">
        <header class="view-head">
          <div class="titles">
            <a class="back-link" href="#estudio">${I('chevron-left', 16)} Estudio</a>
            <h1 class="view-title">${esc(it.name)}</h1>
            <div class="row sd-meta">
              <span class="tag">${esc(mode.label)}</span>
              <span class="sd-pill">${I('music', 13)} Tono <strong class="mono">${esc(key)}</strong></span>
              <span class="sd-pill">${I('metronome', 13)} <strong class="mono">${st.an ? Math.round(st.an.bpm * st.rate) : '—'}</strong> BPM</span>
              ${song ? `<a class="sd-pill sd-pill--link" href="#cancion-${esc(song.id)}">${I('text', 13)} ${esc(song.title)}</a>` : ''}
            </div>
          </div>
          <div class="view-actions">
            <button class="btn btn--ghost" data-sd="link">${I('link', 15)} ${song ? 'Cambiar alabanza' : 'Elegir la alabanza'}</button>
          </div>
        </header>

        <div class="sd-grid">
          <section class="sd-tracks card">
            <h2 class="sd-h">${I('sliders', 15)} Pistas</h2>
            ${mode.tracks.map((t) => {
              const tr = st.tracks[t.id];
              const anySolo = Object.values(st.tracks).some((x) => x.solo);
              return `
                <div class="sd-track ${tr.mute ? 'is-mute' : ''} ${tr.solo ? 'is-solo' : ''} ${tr.mute || (anySolo && !tr.solo) ? 'is-off' : ''}" data-track="${t.id}">
                  <span class="sd-ticon">${I(t.icon, 17)}</span>
                  <div class="grow stack-sm">
                    <div class="row-between"><span class="strong small">${esc(t.label)}</span><span class="mono xsmall faint" data-vol-of="${t.id}">${Math.round(tr.vol * 100)}%</span></div>
                    <input type="range" class="sd-range" min="0" max="150" value="${Math.round(tr.vol * 100)}" data-vol="${t.id}" aria-label="Volumen de ${esc(t.label)}">
                  </div>
                  <button class="sd-ms ${tr.mute ? 'is-on' : ''}" data-mute="${t.id}" title="Silenciar">M</button>
                  <button class="sd-ms sd-ms--s ${tr.solo ? 'is-on' : ''}" data-solo="${t.id}" title="Solo">S</button>
                </div>`;
            }).join('')}
            ${st.mono && st.mode !== 'none' ? '<p class="xsmall warn-text">Este audio es mono: la voz no se puede separar bien.</p>' : ''}
            <div class="sd-presets">
              ${st.mode === '4' ? `<button class="chip" data-preset="sin-voz">Sin voz</button><button class="chip" data-preset="sin-bateria">Sin batería</button><button class="chip" data-preset="solo-bateria">Solo batería</button><button class="chip" data-preset="solo-voz">Solo voz</button>` : ''}
              ${st.mode === '2' ? `<button class="chip" data-preset="sin-voz">Sin voz</button><button class="chip" data-preset="solo-voz">Solo voz</button>` : ''}
              <button class="chip" data-preset="todo">Todo</button>
            </div>
          </section>

          <section class="sd-chords card">
            <h2 class="sd-h">${I('music', 15)} Acordes</h2>
            <div class="sd-now"><span class="sd-now-chord mono" id="sd-chord">—</span><div class="sd-next" id="sd-next"></div></div>
            ${st.sections.length ? `<h2 class="sd-h">${I('list', 15)} Secciones</h2><div class="sd-sections">${st.sections.map((s, i) => `<button class="sd-sec" data-sec="${i}"><span>${esc(s.name)}</span><span class="mono xsmall">${fmtT(s.t0)}</span></button>`).join('')}</div><p class="xsmall faint">Toca para ir · doble toque para repetir la sección.</p>`
              : `<p class="xsmall faint">${song ? 'No se pudieron ubicar las secciones con esta grabación.' : 'Elige la alabanza para ver las secciones y la letra.'}</p>`}
          </section>

          ${song ? `<section class="sd-lyrics card"><h2 class="sd-h">${I('text', 15)} Letra</h2><div class="chart sd-chart" id="sd-chart">${C.render(song.chart, { n: st.shift + st.semis, key: song.key, mode: notation, arrangement: song.arrangement })}</div></section>` : ''}
        </div>

        <div class="sd-player">
          <div class="sd-seek">
            <span class="mono xsmall" id="sd-cur">${fmtT(st.pos)}</span>
            <div class="sd-track-bar">
              ${st.sections.map((s) => `<span class="sd-mark" style="left:${(s.t0 / st.duration) * 100}%" title="${esc(s.name)}"></span>`).join('')}
              ${st.loop.a != null && st.loop.b != null ? `<span class="sd-loop" style="left:${(st.loop.a / st.duration) * 100}%;width:${((st.loop.b - st.loop.a) / st.duration) * 100}%"></span>` : ''}
              <input type="range" class="sd-range sd-range--seek" id="sd-seek" min="0" max="${st.duration.toFixed(2)}" step="0.05" value="${st.pos.toFixed(2)}" aria-label="Posición">
            </div>
            <span class="mono xsmall">${fmtT(st.duration)}</span>
          </div>
          <div class="sd-controls">
            <div class="sd-transport">
              <button class="sd-round" data-sd="back" aria-label="Atrás 5 segundos">${I('prev', 16)}</button>
              <button class="sd-play ${st.playing ? 'is-on' : ''}" data-sd="play" aria-label="${st.playing ? 'Pausar' : 'Reproducir'}">${I(st.playing ? 'pause' : 'play', 24)}</button>
              <button class="sd-round" data-sd="fwd" aria-label="Adelante 5 segundos">${I('next', 16)}</button>
              <div class="sd-beats" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<span class="sd-dot ${i === 0 ? 'is-first' : ''}" data-b="${i}"></span>`).join('')}</div>
            </div>
            <div class="sd-opts">
            <div class="sd-box">
              <span class="sd-lbl">Velocidad</span>
              <div class="sd-step"><button data-sd="rate-">${I('minus', 13)}</button><span class="mono" id="sd-rate">${Math.round(st.rate * 100)}%</span><button data-sd="rate+">${I('plus', 13)}</button></div>
            </div>
            <div class="sd-box ${st.canShift ? '' : 'is-off'}" title="${st.canShift ? '' : 'Este navegador no permite cambiar el tono'}">
              <span class="sd-lbl">Tono</span>
              <div class="sd-step"><button data-sd="semi-">${I('minus', 13)}</button><span class="mono">${st.semis > 0 ? '+' : ''}${st.semis}</span><button data-sd="semi+">${I('plus', 13)}</button></div>
            </div>
            <div class="sd-box">
              <span class="sd-lbl">Metrónomo</span>
              <div class="sd-seg">
                <button class="${st.metro.on ? 'is-on' : ''}" data-sd="metro">${I('metronome', 14)}</button>
                ${[[0.5, '½×'], [1, '1×'], [2, '2×']].map(([v, l]) => `<button class="${st.metro.on && st.metro.mult === v ? 'is-on' : ''}" data-mult="${v}">${l}</button>`).join('')}
              </div>
            </div>
            <div class="sd-box">
              <span class="sd-lbl">Conteo</span>
              <div class="sd-seg">${[[0, 'No'], [1, '1 compás'], [2, '2']].map(([v, l]) => `<button class="${st.countIn === v ? 'is-on' : ''}" data-count="${v}">${l}</button>`).join('')}</div>
            </div>
            <div class="sd-box">
              <span class="sd-lbl">Repetir</span>
              <div class="sd-seg">
                <button class="${st.loop.a != null ? 'is-on' : ''}" data-sd="a">A</button>
                <button class="${st.loop.b != null ? 'is-on' : ''}" data-sd="b">B</button>
                <button class="${st.loop.on ? 'is-on' : ''}" data-sd="loop" ${st.loop.a != null && st.loop.b != null ? '' : 'disabled'}>${I('loop', 14)}</button>
                ${st.loop.a != null || st.loop.b != null ? `<button data-sd="noloop">${I('x', 13)}</button>` : ''}
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function paintChord(index) {
    const st = S.state;
    const notation = App.store.state.prefs.notation;
    const label = (c) => C.formatChord(c.name, { n: st.semis, key: st.key ? C.transposeKey(st.key.replace(/m$/, ''), 0) : null, mode: notation === 'numeros' ? 'letras' : notation });
    const cur = st.chords[index];
    const el = document.getElementById('sd-chord');
    if (!el) return;
    el.textContent = cur ? label(cur) : '—';
    el.classList.remove('is-pop'); void el.offsetWidth; el.classList.add('is-pop');
    const nx = document.getElementById('sd-next');
    if (nx) nx.innerHTML = st.chords.slice(index + 1, index + 5).map((c) => `<span class="mono">${esc(label(c))}</span>`).join('');
  }

  function paintLyrics(pos) {
    const st = S.state;
    const chart = document.getElementById('sd-chart');
    if (!chart || !st.marks.length) return;
    const song = M.song(st.item.songId);
    const ev = App.yt.chordAt(st.marks, st.plan, pos, st.an ? st.an.bpm : 80, P_sub(song));
    const ci = ev ? ev.ci : -1;
    if (chart.dataset.ci === String(ci)) return;
    chart.dataset.ci = ci;
    chart.querySelectorAll('.cc.is-now').forEach((x) => x.classList.remove('is-now'));
    chart.querySelectorAll('.cl.is-now-line').forEach((x) => x.classList.remove('is-now-line'));
    const c = ci >= 0 && chart.querySelector(`.cc[data-ci="${ci}"]`);
    if (!c) return;
    c.classList.add('is-now');
    const line = c.closest('.cl');
    if (line) {
      line.classList.add('is-now-line');
      const box = chart.closest('.sd-lyrics');
      const br = box.getBoundingClientRect(), lr = line.getBoundingClientRect();
      if (lr.top < br.top + 60 || lr.bottom > br.bottom - 40) box.scrollTo({ top: box.scrollTop + (lr.top - br.top) - br.height * 0.3, behavior: 'smooth' });
    }
  }
  const P_sub = (song) => App.practice.meterOf(song ? song.time : '4/4').sub;

  function linkSong() {
    const st = S.state;
    const songs = M.songs().slice().sort((a, b) => a.title.localeCompare(b.title));
    const m = ui.modal({
      title: '¿Qué alabanza es?',
      body: `<p class="small muted">La app acomoda la letra y las secciones con la grabación.</p>
        <div class="menu-list">${songs.map((s) => `<button class="menu-item ${st.item.songId === s.id ? 'is-on' : ''}" data-song="${esc(s.id)}">${ui.keyBadge(s.key)}<span class="grow"><span class="strong small">${esc(s.title)}</span><span class="xsmall faint">${esc(s.artist || '')}</span></span></button>`).join('')}
        <button class="menu-item" data-song="">${I('x', 16)}<span class="grow"><span class="strong small">Ninguna</span></span></button></div>`,
      actions: [{ label: 'Cerrar', kind: 'ghost' }]
    });
    m.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-song]');
      if (!b) return;
      m.close();
      S.linkSong(b.dataset.song || null);
    });
  }

  function preset(p) {
    const st = S.state;
    Object.keys(st.tracks).forEach((k) => Object.assign(st.tracks[k], { mute: false, solo: false }));
    const set = (k, patch) => { if (st.tracks[k]) Object.assign(st.tracks[k], patch); };
    if (p === 'sin-voz') set('voz', { mute: true });
    if (p === 'sin-bateria') set('bateria', { mute: true });
    if (p === 'solo-bateria') set('bateria', { solo: true });
    if (p === 'solo-voz') set('voz', { solo: true });
    S.setTrack(Object.keys(st.tracks)[0], {});
  }

  function player(root, id) {
    const render = () => {
      root.innerHTML = playerHTML();
      if (S.state.status === 'ready') {
        const pos = S.state.pos;
        paintChord(S.state.chords.findIndex((c) => pos >= c.t0 && pos < c.t1));
        paintLyrics(pos);
        const si = S.state.sections.findIndex((s) => pos >= s.t0 && pos < s.t1);
        root.querySelectorAll('.sd-sec').forEach((b, i) => b.classList.toggle('is-now', i === si));
      }
    };
    render();
    if (unsub) unsub();
    unsub = S.on((e) => {
      if (!document.body.contains(root)) return;
      switch (e.type) {
        case 'progress': {
          const ph = root.querySelector('#sd-phase'); if (ph) ph.textContent = S.state.phase;
          const b = root.querySelector('#sd-bar'); if (b) b.style.width = Math.round(S.state.progress * 100) + '%';
          break;
        }
        case 'state': case 'settings': render(); break;
        case 'mix': {
          const anySolo = Object.values(S.state.tracks).some((x) => x.solo);
          Object.entries(S.state.tracks).forEach(([k, tr]) => {
            const row = root.querySelector(`[data-track="${k}"]`);
            if (!row) return;
            row.classList.toggle('is-mute', tr.mute);
            row.classList.toggle('is-solo', tr.solo);
            row.classList.toggle('is-off', tr.mute || (anySolo && !tr.solo));
            row.querySelector('[data-mute]').classList.toggle('is-on', tr.mute);
            row.querySelector('[data-solo]').classList.toggle('is-on', tr.solo);
          });
          break;
        }
        case 'beat': root.querySelectorAll('.sd-dot').forEach((d, i) => d.classList.toggle('is-on', i === e.beat)); break;
        case 'chord': paintChord(e.index); break;
        case 'section': root.querySelectorAll('.sd-sec').forEach((b, i) => b.classList.toggle('is-now', i === e.index)); break;
        case 'time': {
          const pos = S.state.pos;
          const sk = root.querySelector('#sd-seek'); if (sk && !sk.matches(':active')) sk.value = pos;
          const cu = root.querySelector('#sd-cur'); if (cu) cu.textContent = fmtT(pos);
          paintLyrics(pos);
          if (!S.state.playing) {
            paintChord(S.state.chords.findIndex((c) => pos >= c.t0 && pos < c.t1));
            const si = S.state.sections.findIndex((x) => pos >= x.t0 && pos < x.t1);
            root.querySelectorAll('.sd-sec').forEach((b, i) => b.classList.toggle('is-now', i === si));
          }
          break;
        }
      }
    });
    root.addEventListener('click', (e) => {
      const st = S.state;
      const b = e.target.closest('[data-sd]');
      if (b && !b.disabled) {
        switch (b.dataset.sd) {
          case 'play': S.toggle(); break;
          case 'back': S.seek(S.position() - 5); break;
          case 'fwd': S.seek(S.position() + 5); break;
          case 'rate-': S.setRate(st.rate - 0.05); break;
          case 'rate+': S.setRate(st.rate + 0.05); break;
          case 'semi-': if (st.canShift) S.setSemis(st.semis - 1); else ui.toast('Este navegador no permite cambiar el tono.', { kind: 'info' }); break;
          case 'semi+': if (st.canShift) S.setSemis(st.semis + 1); else ui.toast('Este navegador no permite cambiar el tono.', { kind: 'info' }); break;
          case 'metro': S.setMetro({ on: !st.metro.on }); break;
          case 'a': S.setLoop({ a: S.position() }); break;
          case 'b': { const p = S.position(); S.setLoop(st.loop.a != null && p > st.loop.a ? { b: p, on: true } : { b: p }); break; }
          case 'loop': S.setLoop({ on: !st.loop.on }); break;
          case 'noloop': S.setLoop({ a: null, b: null, on: false }); break;
          case 'link': linkSong(); break;
        }
        return;
      }
      const mu = e.target.closest('[data-mute]');
      if (mu) { S.setTrack(mu.dataset.mute, { mute: !st.tracks[mu.dataset.mute].mute }); return; }
      const so = e.target.closest('[data-solo]');
      if (so) { S.setTrack(so.dataset.solo, { solo: !st.tracks[so.dataset.solo].solo }); return; }
      const pr = e.target.closest('[data-preset]');
      if (pr) { preset(pr.dataset.preset); return; }
      const mt = e.target.closest('[data-mult]');
      if (mt) { S.setMetro({ on: true, mult: Number(mt.dataset.mult) }); return; }
      const ct = e.target.closest('[data-count]');
      if (ct) { S.setCountIn(Number(ct.dataset.count)); return; }
      const sec = e.target.closest('[data-sec]');
      if (sec) { const i = Number(sec.dataset.sec); if (e.detail >= 2) { S.loopSection(i); ui.toast(`Repitiendo: ${st.sections[i].name}`); } else S.seek(st.sections[i].t0); return; }
      const cc = e.target.closest('#sd-chart .cc[data-ci]');
      if (cc && st.marks.length) { const t = App.yt.timeOf(st.marks, st.plan, Number(cc.dataset.ci)); if (t != null) S.seek(Math.max(0, t - 0.5)); }
    });
    root.addEventListener('input', (e) => {
      const t = e.target;
      if (t.id === 'sd-seek') { S.seek(Number(t.value)); return; }
      if (t.dataset.vol) {
        const v = Number(t.value) / 100;
        S.state.tracks[t.dataset.vol].vol = v;
        S.setTrack(t.dataset.vol, {});
        const lbl = root.querySelector(`[data-vol-of="${t.dataset.vol}"]`); if (lbl) lbl.textContent = Math.round(v * 100) + '%';
      }
    });
    // "mix" redibuja; durante el arrastre del volumen no hace falta
    S.open(id);
  }

  App.views.estudio = {
    title: 'Estudio',
    onLeave: () => { S.pause(); if (unsub) unsub(); unsub = null; },
    render(root, id) {
      if (id) player(root, id); else library(root);
    }
  };

})();
