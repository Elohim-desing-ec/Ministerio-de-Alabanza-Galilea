/* =========================================================================
   SELAH · Modo escenario + ensayo
   Pantalla completa, letra grande, canción por canción en la tonalidad
   del evento. Abajo: metrónomo (BPM, compás y cuenta) y el botón
   "Pistas", que abre el mezclador (batería, bajo, piano, guitarra, pad y
   click) y la vista de lo que toca cada instrumento.
   Teclas: ← → cambian de canción · espacio inicia/para las pistas ·
   S desplazamiento automático · Esc sale.
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, I = App.icon, esc = U.esc, P = App.practice;
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  let el = null;
  let st = null;
  let raf = null;
  let wakeLock = null;
  let unsub = null;

  function items() {
    if (st.eventId) {
      const ev = M.event(st.eventId);
      return ev ? ev.setlist.map((it) => ({ song: M.song(it.songId), key: it.key, leader: M.member(it.leaderId) })).filter((x) => x.song) : [];
    }
    const s = M.song(st.songId);
    return s ? [{ song: s, key: st.key || s.key, leader: null }] : [];
  }

  const curItem = () => items()[st.index];

  // ---------------------------------------------------------------------
  // Dibujos: teclado, guitarra, bajo y batería
  // ---------------------------------------------------------------------
  const noteName = (pc) => App.chords.formatChord(NOTE[((pc % 12) + 12) % 12], { key: P.song.key ? App.chords.transposeKey(P.song.key, 0) : null, mode: st.mode === 'numeros' ? 'letras' : st.mode });

  function pianoSVG(v) {
    const lo = 48, hi = 71;
    const lh = new Set(v.lh), rh = new Set(v.rh);
    const whites = [], blacks = [];
    let x = 0;
    for (let m = lo; m <= hi; m++) {
      const pc = m % 12;
      const black = [1, 3, 6, 8, 10].includes(pc);
      const cls = lh.has(m) ? 'k-lh' : rh.has(m) ? 'k-rh' : '';
      if (black) blacks.push(`<rect class="kb ${cls}" x="${x - 6}" y="0" width="12" height="54" rx="2"/>`);
      else {
        whites.push(`<rect class="kw ${cls}" x="${x}" y="0" width="20" height="86" rx="3"/>${cls ? `<text class="kl" x="${x + 10}" y="78">${esc(noteName(pc))}</text>` : ''}`);
        x += 20;
      }
    }
    const blackLabels = [];
    x = 0;
    for (let m = lo; m <= hi; m++) {
      const pc = m % 12;
      if ([1, 3, 6, 8, 10].includes(pc)) { if (lh.has(m) || rh.has(m)) blackLabels.push(`<circle class="kd" cx="${x}" cy="44" r="4"/>`); } else x += 20;
    }
    return `<svg class="piano" viewBox="-1 -1 ${x + 2} 88" role="img" aria-label="Teclado del piano">${whites.join('')}${blacks.join('')}${blackLabels.join('')}</svg>`;
  }

  function guitarSVG(shape) {
    if (!shape) return '<p class="xsmall faint">Sin posición</p>';
    const f = shape.frets;
    const pos = f.filter((x) => x > 0);
    const maxF = pos.length ? Math.max(...pos) : 0;
    const base = maxF <= 4 ? 1 : (shape.barre || Math.min(...pos));
    const sx = (s) => 14 + s * 14, fy = (k) => 24 + k * 18;
    let out = '';
    for (let k = 0; k <= 5; k++) out += `<line class="${k === 0 && base === 1 ? 'g-nut' : 'g-fret'}" x1="14" x2="84" y1="${fy(k)}" y2="${fy(k)}"/>`;
    for (let s = 0; s < 6; s++) out += `<line class="g-str" x1="${sx(s)}" x2="${sx(s)}" y1="${fy(0)}" y2="${fy(5)}"/>`;
    if (shape.barre && shape.barre >= base) {
      const strs = f.map((x, s) => ({ x, s })).filter((o) => o.x === shape.barre);
      if (strs.length > 1) out += `<rect class="g-barre" x="${sx(strs[0].s) - 5}" y="${fy(shape.barre - base) + 4}" width="${sx(strs[strs.length - 1].s) - sx(strs[0].s) + 10}" height="10" rx="5"/>`;
    }
    f.forEach((x, s) => {
      if (x < 0) out += `<text class="g-mark" x="${sx(s)}" y="16">×</text>`;
      else if (x === 0) out += `<circle class="g-open" cx="${sx(s)}" cy="12" r="3.5"/>`;
      else out += `<circle class="g-dot" cx="${sx(s)}" cy="${fy(x - base) + 9}" r="5.5"/>`;
    });
    if (base > 1) out += `<text class="g-base" x="2" y="${fy(0) + 13}">${base}</text>`;
    return `<svg class="guitar" viewBox="0 0 96 120" role="img" aria-label="Posición en la guitarra">${out}</svg>`;
  }

  function bassInfo(tn) {
    if (!tn) return '';
    const pc = tn.bass;
    const opts = [['Mi', (pc - 4 + 12) % 12], ['La', (pc - 9 + 12) % 12], ['Re', (pc - 2 + 12) % 12]];
    const best = opts.filter((o) => o[1] <= 5).sort((a, b) => a[1] - b[1])[0] || opts[0];
    return `<span class="sp-bass-note mono">${esc(noteName(pc))}</span><span class="small muted">Cuerda ${best[0]} · ${best[1] === 0 ? 'al aire' : 'traste ' + best[1]}</span>`;
  }

  function drumGrid() {
    const spb = P.meter.beats * P.meter.sub;
    const rows = [['h', 'Platillo'], ['s', 'Caja'], ['k', 'Bombo']];
    const hits = Array.from({ length: spb }, (_, i) => P.drumHits(i));
    return `<div class="dg" style="--steps:${spb}">${rows.map(([r, label]) => `
      <span class="dg-lbl">${label}</span>${hits.map((h, i) => `<span class="dg-cell ${i % P.meter.sub === 0 ? 'is-beat' : ''} ${(r === 'h' ? (h.h || h.o) : h[r]) ? 'is-hit' : ''} ${r === 'h' && h.o ? 'is-open' : ''}" data-col="${i}"></span>`).join('')}`).join('')}
    </div>`;
  }

  function strumText() {
    return P.strumPattern().map((x, i) => `<span class="${i % P.meter.sub === 0 ? 'is-beat' : ''}">${x === 'D' ? '↓' : x === 'U' ? '↑' : '·'}</span>`).join('');
  }

  const chordLabel = (ev) => (ev ? App.chords.formatChord(ev.chord, { n: P.song.n, key: P.song.key ? App.chords.transposeKey(curItem().song.key, 0) : null, mode: st.mode }) : '—');

  function instrumentsHTML() {
    const ev = P.current.ev || P.plan[0] || null;
    const next = P.current.ev ? P.current.next : P.plan[1] || null;
    const tn = ev ? P.tones(ev.chord) : null;
    return `
      <div class="sp-now">
        <div class="stack-sm"><span class="sp-cap">${P.playing && P.current.ev ? 'Ahora' : 'Primer acorde'}</span><span class="sp-chord mono" id="sp-chord">${esc(chordLabel(ev))}</span></div>
        <div class="stack-sm" style="text-align:right"><span class="sp-cap">Sigue</span><span class="sp-next mono" id="sp-next">${esc(chordLabel(next))}</span></div>
      </div>
      ${!P.plan.length ? '<p class="small sp-warn">Esta canción no tiene acordes escritos. Suena el metrónomo y la batería.</p>' : ''}
      <section class="sp-inst">
        <h4>${I('keys', 14)} Piano</h4>
        <div id="sp-piano">${pianoSVG(tn ? P.pianoVoicing(tn) : { lh: [], rh: [] })}</div>
        <p class="sp-legend"><span class="lg lg--lh"></span> Mano izquierda <span class="lg lg--rh"></span> Mano derecha</p>
      </section>
      <section class="sp-inst sp-inst--row">
        <div class="stack-sm grow">
          <h4>${I('guitar', 14)} Guitarra</h4>
          <p class="sp-strum">${strumText()}</p>
          <p class="xsmall sp-dim">Rasgueo por compás (↓ abajo · ↑ arriba)</p>
        </div>
        <div id="sp-guitar">${guitarSVG(tn ? P.guitarShape(tn) : null)}</div>
      </section>
      <section class="sp-inst">
        <h4>${I('bass', 14)} Bajo</h4>
        <div class="sp-bass" id="sp-bass">${bassInfo(tn)}</div>
      </section>
      <section class="sp-inst">
        <h4>${I('drum', 14)} Batería</h4>
        <div id="sp-drums">${drumGrid()}</div>
      </section>`;
  }

  function mixHTML(s) {
    const mix = P.mix;
    const active = P.activePreset();
    const pr = P.prefs;
    const leader = M.isLeader();
    const bpmChanged = s.bpm && P.song.bpm !== s.bpm;
    return `
      <div class="sp-presets">${P.PRESETS.map((p) => `<button class="sp-chip ${active === p.id ? 'is-on' : ''}" data-preset="${p.id}">${esc(p.label)}</button>`).join('')}</div>
      <div class="sp-tracks">${P.TRACKS.map((t) => {
        const on = P.gainOf(t.id) > 0;
        return `<div class="sp-track ${on ? '' : 'is-off'}">
          <span class="sp-ticon">${I(t.icon, 15)}</span>
          <span class="sp-tname">${esc(t.label)}</span>
          <button class="sp-ms ${mix[t.id].mute ? 'is-mute' : ''}" data-mute="${t.id}" aria-pressed="${mix[t.id].mute}" title="Silenciar">M</button>
          <button class="sp-ms ${mix[t.id].solo ? 'is-solo' : ''}" data-solo="${t.id}" aria-pressed="${mix[t.id].solo}" title="Dejar sola">S</button>
          <input class="sp-range" type="range" min="0" max="100" value="${Math.round(mix[t.id].vol * 100)}" data-vol="${t.id}" aria-label="Volumen de ${esc(t.label)}">
        </div>`;
      }).join('')}</div>
      <div class="sp-set">
        <div class="sp-row"><span>Ritmo</span><div class="stage-seg">${App.config.tempos.map((t) => `<button class="${P.song.tempo === t.id ? 'is-on' : ''}" data-feel="${t.id}">${esc(t.label)}</button>`).join('')}</div></div>
        <div class="sp-row"><span>Cada acorde dura</span><div class="stage-seg">${[[0.5, '½'], [1, '1'], [2, '2']].map(([v, l]) => `<button class="${pr.chordBars === v ? 'is-on' : ''}" data-bars="${v}">${l}</button>`).join('')}</div><span class="sp-dim xsmall">compás</span></div>
        <div class="sp-row sp-toggles">
          <button class="sp-chip ${pr.countIn ? 'is-on' : ''}" data-pref="countIn">${I('metronome', 13)} Cuenta inicial</button>
          <button class="sp-chip ${pr.loop ? 'is-on' : ''}" data-pref="loop">${I('loop', 13)} Repetir</button>
          <button class="sp-chip ${pr.follow ? 'is-on' : ''}" data-pref="follow">${I('eye', 13)} Seguir la letra</button>
        </div>
        <div class="sp-row"><span>${I('volume', 14)} General</span><input class="sp-range grow" type="range" min="0" max="100" value="${Math.round(pr.master * 100)}" data-master aria-label="Volumen general"></div>
        ${leader && bpmChanged ? `<button class="stage-btn" data-act="save-bpm">${I('check', 14)} Guardar ${P.song.bpm} BPM en la canción</button>` : ''}
      </div>
      <p class="sp-note">Las pistas se arman con los acordes de la hoja, en el tono y el tempo que elijas: no ocupan espacio ni se descargan. Toca un acorde de la letra para empezar desde ahí.</p>`;
  }

  function panelHTML(s) {
    return `
      <div class="sp-tabs">
        <button class="${st.panelTab === 'mezcla' ? 'is-on' : ''}" data-ptab="mezcla">${I('sliders', 14)} Mezcla</button>
        <button class="${st.panelTab === 'inst' ? 'is-on' : ''}" data-ptab="inst">${I('eye', 14)} Instrumentos</button>
        <button class="sp-close" data-act="panel" aria-label="Cerrar pistas">${I('x', 15)}</button>
      </div>
      <div class="sp-body" id="sp-body">${st.panelTab === 'inst' ? instrumentsHTML() : mixHTML(s)}</div>`;
  }

  function transportHTML(s) {
    const m = P.meter;
    const preset = P.PRESETS.find((p) => p.id === P.activePreset());
    return `
      <button class="tr-play ${P.playing ? 'is-live' : ''}" data-act="play" aria-label="${P.playing ? 'Parar' : 'Reproducir'}">${I(P.playing ? 'stop' : 'play', 20)}</button>
      <div class="tr-bpm">
        <button class="tr-step" data-act="bpm-" aria-label="Menos BPM">${I('minus', 14)}</button>
        <div class="tr-bpm-val"><span class="mono" id="tr-bpm">${P.song.bpm}</span><span class="tr-lbl">BPM · ${esc(s.time || '4/4')}</span></div>
        <button class="tr-step" data-act="bpm+" aria-label="Más BPM">${I('plus', 14)}</button>
        <button class="tr-tap" data-act="tap" title="Toca al ritmo para medir el tempo">${I('hand', 14)}<span>Tap</span></button>
      </div>
      <div class="tr-beats ${m.beats > 4 ? 'is-many' : ''}" id="tr-beats" aria-hidden="true">${Array.from({ length: m.beats }, (_, i) => `<span class="tr-dot ${i === 0 ? 'is-first' : ''}" data-b="${i}">${i + 1}</span>`).join('')}</div>
      <div class="tr-pos"><span class="tr-chord mono" id="tr-chord">${esc(P.current.ev ? chordLabel(P.current.ev) : '—')}</span><span class="tr-lbl" id="tr-sec">${esc(P.current.ev ? P.current.ev.section || '' : (P.plan.length ? 'Listo para ensayar' : 'Solo metrónomo'))}</span></div>
      <button class="tr-mix ${st.panel ? 'is-on' : ''}" data-act="panel">${I('sliders', 15)}<span class="tr-mix-txt"><span>Pistas</span><span class="tr-lbl">${esc(preset ? preset.label : 'Mezcla personal')}</span></span></button>`;
  }

  // ---------------------------------------------------------------------
  // Pantalla
  // ---------------------------------------------------------------------
  function ensureLoaded(cur) {
    const s = cur.song;
    const key = `${s.id}|${cur.key}|${s.chart.length}|${(s.arrangement || []).join(',')}|${s.time}`;
    if (st.loaded === key) return;
    P.load({
      id: s.id, chart: s.chart, arrangement: s.arrangement, n: App.chords.semitones(s.key, cur.key), key: cur.key,
      bpm: st.bpm[s.id] || s.bpm || 80, time: s.time, tempo: st.feel[s.id] || s.tempo || 'media'
    });
    st.loaded = key;
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
    ensureLoaded(cur);

    el.innerHTML = `
      <header class="stage-top">
        <div class="stage-title">
          <span class="stage-count mono">${st.index + 1}/${list.length}</span>
          <div class="grow">
            <h2>${esc(s.title)}</h2>
            <p>${ev ? esc(ev.title) + ' · ' : ''}${cur.leader ? 'Dirige ' + esc(cur.leader.name) + ' · ' : ''}<span class="mono">${esc(s.time || '4/4')}</span></p>
          </div>
          <span class="stage-key mono">${esc(App.chords.formatKey(cur.key, st.mode))}</span>
          <button class="stage-btn stage-x stage-x--m" data-act="close" aria-label="Salir del modo escenario">${I('x', 16)}</button>
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
          <button class="stage-btn ${st.scrolling ? 'is-live' : ''}" data-act="scroll" aria-label="Desplazamiento automático">${I(st.scrolling ? 'pause' : 'arrow-down', 14)} <span class="mono">${st.speed}×</span></button>
          <button class="stage-btn stage-x" data-act="close" aria-label="Salir del modo escenario">${I('x', 16)}</button>
        </div>
      </header>
      <div class="stage-main ${st.panel ? 'has-panel' : ''}">
        <div class="stage-body" id="stage-body">
          <div class="chart stage-chart ${st.chords ? '' : 'chart--lyrics'} ${P.playing || st.panel ? 'is-practice' : ''}" style="--chart-size:${st.size}px">
            ${App.chords.render(s.chart, { n, key: s.key, mode: st.mode, arrangement: s.arrangement })}
          </div>
          ${s.notes ? `<p class="stage-notes">${esc(s.notes)}</p>` : ''}
        </div>
        ${st.panel ? `<aside class="stage-panel" id="stage-panel" aria-label="Pistas de ensayo">${panelHTML(s)}</aside>` : ''}
      </div>
      <div class="stage-transport" id="stage-transport">${transportHTML(s)}</div>
      <footer class="stage-foot">
        <button class="stage-nav" data-act="prev" ${st.index === 0 ? 'disabled' : ''}>${I('chevron-left', 20)} <span>Anterior</span></button>
        <span class="stage-next">${next ? `Sigue: <strong>${esc(next.song.title)}</strong> <span class="mono">${esc(App.chords.formatKey(next.key, st.mode))}</span>` : 'Última canción'}</span>
        <button class="stage-nav" data-act="next" ${next ? '' : 'disabled'}><span>Siguiente</span> ${I('chevron-right', 20)}</button>
      </footer>
      <div class="stage-countin" id="stage-countin" hidden></div>`;
    highlight(P.current.ci, false);
  }

  function refreshTransport() {
    const cur = curItem();
    const t = el && el.querySelector('#stage-transport');
    if (t && cur) t.innerHTML = transportHTML(cur.song);
  }

  function refreshPanel() {
    const cur = curItem();
    const b = el && el.querySelector('#sp-body');
    if (!b || !cur) return;
    const top = b.scrollTop;
    b.innerHTML = st.panelTab === 'inst' ? instrumentsHTML() : mixHTML(cur.song);
    b.scrollTop = top;
  }

  // ---------------------------------------------------------------------
  // Lo que pasa mientras suena
  // ---------------------------------------------------------------------
  function highlight(ci, scroll = true) {
    if (!el) return;
    const body = el.querySelector('#stage-body');
    if (!body) return;
    body.querySelectorAll('.cc.is-now').forEach((x) => x.classList.remove('is-now'));
    body.querySelectorAll('.cl.is-now-line').forEach((x) => x.classList.remove('is-now-line'));
    if (ci == null || ci < 0) return;
    const c = body.querySelector(`.cc[data-ci="${ci}"]`);
    if (!c) return;
    c.classList.add('is-now');
    const line = c.closest('.cl');
    if (line) line.classList.add('is-now-line');
    if (!scroll || !P.prefs.follow || !line) return;
    const br = body.getBoundingClientRect(), lr = line.getBoundingClientRect();
    if (!lr.height) return;
    if (lr.top < br.top + br.height * 0.12 || lr.bottom > br.top + br.height * 0.62) {
      body.scrollTo({ top: body.scrollTop + (lr.top - br.top) - br.height * 0.28, behavior: 'smooth' });
    }
  }

  function paintInstruments(ev, next) {
    if (!el || !st.panel || st.panelTab !== 'inst') return;
    const tn = ev ? P.tones(ev.chord) : null;
    const q = (id) => el.querySelector(id);
    if (q('#sp-chord')) q('#sp-chord').textContent = chordLabel(ev);
    if (q('#sp-next')) q('#sp-next').textContent = chordLabel(next);
    if (q('#sp-piano')) q('#sp-piano').innerHTML = pianoSVG(tn ? P.pianoVoicing(tn) : { lh: [], rh: [] });
    if (q('#sp-guitar')) q('#sp-guitar').innerHTML = guitarSVG(tn ? P.guitarShape(tn) : null);
    if (q('#sp-bass')) q('#sp-bass').innerHTML = bassInfo(tn);
    const cap = el.querySelector('.sp-now .sp-cap');
    if (cap) cap.textContent = 'Ahora';
  }

  function onEngine(e) {
    if (!el) return;
    switch (e.type) {
      case 'count': {
        const box = el.querySelector('#stage-countin');
        if (!box) return;
        box.hidden = false;
        box.innerHTML = `<span class="ci-num" style="animation:none">${e.n}</span><span class="ci-lbl">${e.n === 1 ? 'Prepárate' : ''}</span>`;
        void box.offsetWidth;
        box.firstElementChild.style.animation = '';
        el.querySelectorAll('.tr-dot').forEach((d, i) => d.classList.toggle('is-on', i === e.n - 1));
        break;
      }
      case 'beat': {
        const box = el.querySelector('#stage-countin');
        if (box && !box.hidden) box.hidden = true;
        el.querySelectorAll('.tr-dot').forEach((d, i) => d.classList.toggle('is-on', i === e.beat));
        break;
      }
      case 'chord': {
        highlight(e.ev.ci);
        const ch = el.querySelector('#tr-chord');
        if (ch) ch.textContent = chordLabel(e.ev);
        const sec = el.querySelector('#tr-sec');
        if (sec) sec.textContent = e.ev.section || '';
        paintInstruments(e.ev, e.next);
        break;
      }
      case 'step': {
        const cells = el.querySelectorAll('.dg-cell');
        if (!cells.length) return;
        cells.forEach((c) => c.classList.toggle('is-now', Number(c.dataset.col) === e.sib));
        break;
      }
      case 'state': {
        refreshTransport();
        const chart = el.querySelector('.stage-chart');
        if (chart) chart.classList.toggle('is-practice', P.playing || st.panel);
        if (!P.playing) {
          el.querySelectorAll('.tr-dot.is-on, .dg-cell.is-now').forEach((d) => d.classList.remove('is-on', 'is-now'));
          const box = el.querySelector('#stage-countin');
          if (box) box.hidden = true;
        }
        break;
      }
      case 'end': App.ui.toast('Fin de la canción.', { kind: 'info' }); break;
      case 'bpm': { const b = el.querySelector('#tr-bpm'); if (b) b.textContent = e.bpm; break; }
      case 'mix': case 'prefs': refreshTransport(); refreshPanel(); break;
    }
  }

  // ---------------------------------------------------------------------
  // Auto-scroll manual
  // ---------------------------------------------------------------------
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

  function changeSong(delta) {
    P.stop();
    setScrolling(false);
    st.index += delta;
    P.current.ci = -1; P.current.ev = null;
    draw();
    const b = el.querySelector('#stage-body');
    if (b) b.scrollTop = 0;
  }

  function togglePlay(fromCi) {
    try { P.toggle(fromCi); } catch (err) { App.ui.toast(err.message || 'No se pudo iniciar el audio.', { kind: 'warn' }); }
  }

  function onKey(e) {
    if (!el) return;
    if (e.target && /input|select|textarea/i.test(e.target.tagName) && e.target.type !== 'range') return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') changeSong(1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') changeSong(-1);
    else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    else if (e.key === 's' || e.key === 'S') { setScrolling(!st.scrolling); keepScroll(draw); }
  }

  function keepScroll(fn) {
    const b = el.querySelector('#stage-body');
    const top = b ? b.scrollTop : 0;
    fn();
    const nb = el.querySelector('#stage-body');
    if (nb) nb.scrollTop = top;
  }

  function onClick(e) {
    const cur = curItem();
    const mode = e.target.closest('[data-mode]');
    if (mode) { st.mode = mode.dataset.mode; keepScroll(draw); return; }
    const cc = e.target.closest('.cc[data-ci]');
    if (cc && (P.playing || st.panel)) { P.stop(); togglePlay(Number(cc.dataset.ci)); return; }
    const ptab = e.target.closest('[data-ptab]');
    if (ptab) { st.panelTab = ptab.dataset.ptab; keepScroll(draw); return; }
    const pre = e.target.closest('[data-preset]');
    if (pre) { P.preset(pre.dataset.preset); return; }
    const mu = e.target.closest('[data-mute]');
    if (mu) { P.toggleMute(mu.dataset.mute); return; }
    const so = e.target.closest('[data-solo]');
    if (so) { P.toggleSolo(so.dataset.solo); return; }
    const fe = e.target.closest('[data-feel]');
    if (fe) { st.feel[cur.song.id] = fe.dataset.feel; P.setFeel(fe.dataset.feel); return; }
    const bars = e.target.closest('[data-bars]');
    if (bars) { P.setPref('chordBars', Number(bars.dataset.bars)); highlight(-1); return; }
    const pref = e.target.closest('[data-pref]');
    if (pref) { P.setPref(pref.dataset.pref, !P.prefs[pref.dataset.pref]); return; }

    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'close': close(); return;
      case 'prev': changeSong(-1); return;
      case 'next': changeSong(1); return;
      case 'play': togglePlay(); return;
      case 'bpm-': st.bpm[cur.song.id] = P.setBpm(P.song.bpm - 1); refreshPanelSoon(); return;
      case 'bpm+': st.bpm[cur.song.id] = P.setBpm(P.song.bpm + 1); refreshPanelSoon(); return;
      case 'tap': st.bpm[cur.song.id] = P.tap(); refreshPanelSoon(); return;
      case 'save-bpm':
        App.actions.saveSong(Object.assign(U.clone(cur.song), { bpm: P.song.bpm }));
        App.ui.toast(`"${cur.song.title}" quedó en ${P.song.bpm} BPM.`);
        refreshPanel();
        return;
      case 'panel': st.panel = !st.panel; keepScroll(draw); return;
      case 'chords': st.chords = !st.chords; break;
      case 'smaller': st.size = Math.max(16, st.size - 2); break;
      case 'bigger': st.size = Math.min(48, st.size + 2); break;
      case 'scroll':
        if (st.scrolling) { st.speed = st.speed >= 3 ? 1 : st.speed + 1; if (st.speed === 1) setScrolling(false); }
        else setScrolling(true);
        break;
      default: return;
    }
    keepScroll(draw);
  }

  const refreshPanelSoon = U.debounce(() => { if (st && st.panel && st.panelTab === 'mezcla') refreshPanel(); }, 400);

  function onInput(e) {
    const t = e.target;
    if (t.dataset.vol) {
      P.setVol(t.dataset.vol, Number(t.value) / 100);
      const row = t.closest('.sp-track');
      if (row) row.classList.toggle('is-off', P.gainOf(t.dataset.vol) <= 0);
    } else if ('master' in t.dataset) {
      P.prefs.master = Number(t.value) / 100;
      P.setPref('master', P.prefs.master);
    }
  }

  function open(opts) {
    if (el) close();
    st = Object.assign({ index: 0, mode: App.store.state.prefs.notation, chords: true, size: 26, scrolling: false, speed: 1, acc: 0, panel: false, panelTab: 'mezcla', bpm: {}, feel: {}, loaded: null }, opts);
    if (opts && opts.practice) st.panel = true;
    el = document.createElement('div');
    el.className = 'stage';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Modo escenario');
    document.body.appendChild(el);
    document.body.classList.add('no-scroll');
    P.current.ci = -1; P.current.ev = null;
    draw();
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    document.addEventListener('keydown', onKey);
    unsub = P.on(onEngine);
    try { if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); } catch (e) { /* sin pantalla completa */ }
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { wakeLock = w; }).catch(() => {}); } catch (e) { /* sin wake lock */ }
  }

  function close() {
    if (!el) return;
    P.stop();
    setScrolling(false);
    if (unsub) unsub();
    unsub = null;
    document.removeEventListener('keydown', onKey);
    try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) { /* nada */ }
    try { if (wakeLock) wakeLock.release(); } catch (e) { /* nada */ }
    wakeLock = null;
    el.remove();
    el = null;
    document.body.classList.remove('no-scroll');
  }

  App.stage = {
    openEvent: (eventId, index = 0, opts = {}) => open(Object.assign({ eventId, index }, opts)),
    openSong: (songId, key, opts = {}) => open(Object.assign({ songId, key }, opts)),
    close
  };
})();
