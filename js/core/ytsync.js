/* =========================================================================
   SELAH · La letra sigue al video de YouTube
   YouTube no deja leer su audio, pero sí saber en qué segundo va el video.
   Con una sincronización hecha una vez (tocar cuando empieza cada línea),
   los acordes y la letra cambian solos mientras suena el video.
   - Sincronización compartida: song.ytSync[videoId] = { marks, at, by }
     (la guarda el líder para todo el equipo).
   - Sincronización propia: se guarda en este celular.
   Marcas: [{ ci, t }] = el acorde número ci empieza en el segundo t.
   ========================================================================= */
(function () {
  const P = App.practice;
  const KEY = 'selah-ytsync-v1';
  let local = App.storage.load(KEY) || {};
  const saveLocal = () => App.storage.save(KEY, local);

  const listeners = new Set();
  const emit = (e) => listeners.forEach((fn) => { try { fn(e); } catch (err) { console.error(err); } });

  const state = { status: 'empty', songId: null, videoId: null, url: '', title: '', playing: false, time: 0, duration: 0, marks: [], shared: false, error: '' };
  let player = null, raf = null, lastCi = -2, lastTimeEmit = 0;

  // ---------------------------------------------------------------------
  // Marcas
  // ---------------------------------------------------------------------
  function marksFor(song, videoId) {
    const mine = local[song.id] && local[song.id][videoId];
    const shared = song.ytSync && song.ytSync[videoId];
    if (mine && mine.marks && mine.marks.length && (!shared || (mine.at || 0) > (shared.at || 0))) return { marks: mine.marks.slice(), shared: false };
    if (shared && shared.marks) return { marks: shared.marks.slice(), shared: true };
    return { marks: [], shared: false };
  }

  /** ¿Esta canción tiene la letra sincronizada con este video? */
  const hasSync = (song, videoId) => marksFor(song, videoId).marks.length >= 2;

  const stepOf = (plan, ci) => { const e = plan.find((x) => x.ci === ci); return e ? e.startStep : null; };

  function evAtStep(plan, step) {
    if (!plan.length || step < 0) return null;
    let lo = 0, hi = plan.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (plan[m].startStep <= step) lo = m; else hi = m - 1; }
    const ev = plan[lo];
    return step < ev.startStep + ev.steps ? ev : null;
  }

  /**
   * Acorde que suena en el segundo t. Entre dos marcas, los acordes se
   * reparten según su duración en la hoja; después de la última, se sigue
   * al ritmo que llevaba la canción.
   */
  function chordAt(marks, plan, t, bpm = 80, sub = 2) {
    if (!marks.length || !plan.length) return null;
    const ms = marks.slice().sort((a, b) => a.t - b.t);
    let a = null, b = null;
    for (const m of ms) { if (m.t <= t) a = m; else { b = m; break; } }
    if (!a) return null;
    const ia = plan.findIndex((x) => x.ci === a.ci);
    if (ia < 0) return null;
    const sa = plan[ia].startStep;
    if (b) {
      const ib = plan.findIndex((x) => x.ci === b.ci);
      // Si la siguiente marca vuelve atrás (se repite una parte), esta línea dura hasta esa marca
      let iEnd = ib;
      if (ib <= ia) { iEnd = ia + 1; while (iEnd < plan.length && !plan[iEnd].lineStart) iEnd++; }
      const lastEv = plan[plan.length - 1];
      const sEnd = iEnd < plan.length ? plan[iEnd].startStep : lastEv.startStep + lastEv.steps;
      const step = sa + ((t - a.t) / (b.t - a.t)) * (sEnd - sa);
      const ev = evAtStep(plan, step);
      const k = ev ? plan.indexOf(ev) : -1;
      return k >= iEnd ? plan[Math.max(ia, iEnd - 1)] : ev;
    }
    // Después de la última marca: velocidad promedio de las marcas (o el BPM)
    let secPerStep = 60 / bpm / sub;
    if (ms.length >= 2) {
      const f = ms[0], l = ms[ms.length - 1];
      const ds = stepOf(plan, l.ci) - stepOf(plan, f.ci);
      if (ds > 0 && l.t > f.t) secPerStep = (l.t - f.t) / ds;
    }
    return evAtStep(plan, sa + (t - a.t) / secPerStep);
  }

  /** Segundo en que empieza un acorde (para saltar a esa parte). */
  function timeOf(marks, plan, ci) {
    const ms = marks.slice().sort((x, y) => x.t - y.t);
    const exact = ms.find((m) => m.ci === ci);
    if (exact) return exact.t;
    const s = stepOf(plan, ci);
    if (s == null || !ms.length) return null;
    // Primera vez que la canción pasa por ese acorde
    for (let k = 0; k < ms.length - 1; k++) {
      const sa = stepOf(plan, ms[k].ci), sb = stepOf(plan, ms[k + 1].ci);
      if (sa <= s && s < sb) return ms[k].t + ((s - sa) / (sb - sa)) * (ms[k + 1].t - ms[k].t);
    }
    const before = ms.filter((m) => stepOf(plan, m.ci) <= s);
    return before.length ? before[before.length - 1].t : ms[0].t;
  }

  function setMarks(marks) {
    state.marks = marks.slice().sort((a, b) => a.t - b.t);
    local[state.songId] = local[state.songId] || {};
    local[state.songId][state.videoId] = { marks: state.marks, at: Date.now() };
    saveLocal();
    state.shared = false;
    lastCi = -2;
    emit({ type: 'marks' });
  }

  /** "Ahora empieza este acorde/línea". */
  function markNow(ci) {
    if (!player || !player.getCurrentTime) return;
    const t = Math.max(0, player.getCurrentTime() - 0.12);
    const plan = P.plan;
    const kept = state.marks.filter((m) => Math.abs(m.t - t) > 1.2);
    setMarks(kept.concat({ ci, t: Math.round(t * 100) / 100 }));
  }

  // ---------------------------------------------------------------------
  // Sincronizar sola: la app escucha el video una vez y acomoda la letra
  // ---------------------------------------------------------------------
  const auto = { status: 'idle', mode: 'mic', level: 0, secs: 0, error: '', confidence: '', shift: 0 };
  let cap = null, capVideoStart = 0;

  async function autoStart(song, mode) {
    if (!player) return;
    Object.assign(auto, { status: 'starting', mode, error: '', level: 0, secs: 0 });
    emit({ type: 'auto' });
    try {
      cap = await App.align.capture({ mode, onLevel: (l, s) => { auto.level = l; auto.secs = s; emit({ type: 'auto-level' }); } });
    } catch (e) {
      Object.assign(auto, { status: 'error', error: e && e.name === 'NotAllowedError' ? 'Hay que permitir el acceso para que la app pueda escuchar.' : (e.message || 'No se pudo escuchar.') });
      emit({ type: 'auto' });
      return;
    }
    seek(0);
    play();
    auto.status = 'listening';
    emit({ type: 'auto' });
    // Momento del video en que empezó a escuchar
    const waitFirst = () => new Promise((res) => { const t = setInterval(() => { if (cap && cap.startedAt()) { clearInterval(t); res(); } }, 30); });
    await waitFirst();
    const first = cap.startedAt();
    capVideoStart = Math.max(0, currentTime() - first.len - (mode === 'tab' ? 0.08 : 0.05));
  }

  async function autoFinish(song) {
    if (!cap || auto.status !== 'listening') return;
    const rec = cap.stop();
    cap = null;
    pause();
    if (rec.samples.length < rec.sr * 20) { Object.assign(auto, { status: 'error', error: 'Escuchó muy poco. Deja sonar la canción completa (o al menos un minuto).' }); emit({ type: 'auto' }); return; }
    auto.status = 'analyzing';
    emit({ type: 'auto' });
    try {
      const an = await App.beat.analyzeChannels([rec.samples], rec.sr, { hint: song.bpm || 0, beatsPerBar: P.meter.beats });
      const r = await App.align.align({ samples: rec.samples, sr: rec.sr, beats: an.beats, plan: P.plan, sub: P.meter.sub });
      setMarks(r.marks.map((m) => ({ ci: m.ci, t: Math.round((m.t + capVideoStart) * 100) / 100 })));
      Object.assign(auto, { status: 'done', confidence: r.confidence, shift: r.shift });
    } catch (e) {
      Object.assign(auto, { status: 'error', error: e.message || 'No se pudo acomodar la letra.' });
    }
    emit({ type: 'auto' });
  }

  function autoCancel() {
    if (cap) { try { cap.stop(); } catch (e) { /* nada */ } }
    cap = null;
    auto.status = 'idle';
    emit({ type: 'auto' });
  }

  function undoMark() { if (state.marks.length) setMarks(state.marks.slice(0, -1)); }
  function clearMarks() { setMarks([]); }

  function share(song) {
    App.actions.saveSong(Object.assign(App.utils.clone(song), {
      ytSync: Object.assign({}, song.ytSync, { [state.videoId]: { marks: state.marks.map((m) => ({ ci: m.ci, t: m.t })), at: Date.now(), by: App.model.me().id, title: state.title } })
    }));
    state.shared = true;
    emit({ type: 'yt' });
  }

  // ---------------------------------------------------------------------
  // Reproductor dentro del modo escenario
  // ---------------------------------------------------------------------
  async function open(song, url, host) {
    close(false);
    const info = App.media.parse(url);
    if (!info || info.kind !== 'youtube' || !info.id) return;
    if (App.player.active) App.player.close();
    const m = marksFor(song, info.id);
    Object.assign(state, {
      status: 'loading', songId: song.id, videoId: info.id, url: info.url, error: '',
      title: App.media.cachedTitle(info.url) || 'Video de YouTube', playing: false, time: 0, duration: 0,
      marks: m.marks, shared: m.shared
    });
    emit({ type: 'yt' });
    App.media.title(info).then((t) => { if (t && state.videoId === info.id) { state.title = t; emit({ type: 'yt' }); } });
    try {
      const YT = await App.player.loadYouTubeApi();
      host.hidden = false;
      host.innerHTML = '<div class="yt-video"><div id="yt-stage"></div></div>';
      player = new YT.Player('yt-stage', {
        host: 'https://www.youtube-nocookie.com',
        videoId: info.id,
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => { state.status = 'ready'; try { state.duration = player.getDuration() || 0; } catch (e) { /* nada */ } emit({ type: 'yt' }); },
          onStateChange: (ev) => {
            state.playing = ev.data === 1;
            if (ev.data === 0 && auto.status === 'listening') { const s = App.model.song(state.songId); if (s) autoFinish(s); }
            if (state.playing) { try { state.duration = player.getDuration() || state.duration; } catch (e) { /* nada */ } loop(); }
            emit({ type: 'state' });
          },
          onError: () => { state.status = 'error'; state.error = 'Este video no deja reproducirse fuera de YouTube.'; emit({ type: 'yt' }); }
        }
      });
    } catch (e) {
      state.status = 'error';
      state.error = 'No se pudo abrir YouTube. Revisa la conexión.';
      emit({ type: 'yt' });
    }
  }

  function loop() {
    if (raf) cancelAnimationFrame(raf);
    const step = () => {
      if (!player || !state.playing) { raf = null; return; }
      let t = 0;
      try { t = player.getCurrentTime(); } catch (e) { /* nada */ }
      state.time = t;
      const ev = chordAt(state.marks, P.plan, t, P.song.bpm, P.meter.sub);
      const ci = ev ? ev.ci : -1;
      if (ci !== lastCi) {
        lastCi = ci;
        const k = ev ? P.plan.indexOf(ev) : -1;
        const next = k >= 0 ? P.plan[k + 1] || null : (state.marks.length ? null : P.plan[0] || null);
        P.current.ci = ci; P.current.ev = ev; P.current.next = next;
        emit({ type: 'chord', ev, next });
      }
      const now = performance.now();
      if (now - lastTimeEmit > 200) { lastTimeEmit = now; emit({ type: 'time' }); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function play() { try { player && player.playVideo(); } catch (e) { /* nada */ } }
  function pause() { try { player && player.pauseVideo(); } catch (e) { /* nada */ } }
  function toggle() { if (state.playing) pause(); else play(); }
  function seek(t) {
    if (!player) return;
    try { player.seekTo(Math.max(0, t), true); } catch (e) { /* nada */ }
    state.time = t; lastCi = -2;
    emit({ type: 'time' });
  }
  function playFrom(ci) {
    const t = timeOf(state.marks, P.plan, ci);
    if (t == null) return false;
    seek(Math.max(0, t - 1));
    play();
    return true;
  }
  const currentTime = () => { try { return player ? player.getCurrentTime() : 0; } catch (e) { return 0; } };

  function close(notify = true) {
    if (cap) autoCancel();
    auto.status = 'idle';
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (player) { try { player.destroy(); } catch (e) { /* nada */ } }
    player = null;
    Object.assign(state, { status: 'empty', videoId: null, playing: false, marks: [], time: 0 });
    lastCi = -2;
    if (notify) emit({ type: 'yt' });
  }

  /** Acordes en el tiempo para una canción (sin cargar el motor de ensayo). */
  function planFor(song) {
    const meter = P.meterOf(song.time);
    const spb = meter.beats * meter.sub;
    let pos = 0;
    return App.chords.timeline(song.chart, { arrangement: song.arrangement }).map((it) => {
      const steps = Math.max(meter.sub, Math.round(spb * (P.prefs.chordBars || 1)));
      const ev = Object.assign({}, it, { startStep: pos, steps });
      pos += steps;
      return ev;
    });
  }

  App.yt = {
    planFor,
    state, open, close, play, pause, toggle, seek, playFrom, currentTime,
    markNow, undoMark, clearMarks, share,
    auto, autoStart, autoFinish, autoCancel,
    chordAt, timeOf, marksFor, hasSync,
    isActive: (songId) => state.status !== 'empty' && state.songId === songId,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
})();
