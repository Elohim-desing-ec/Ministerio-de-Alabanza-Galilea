/* =========================================================================
   SELAH · Ensayar con la música
   - Carga el audio de la alabanza (archivo del celular o link directo),
     detecta el tempo y cada pulso (App.beat) y reproduce la grabación con
     el click pegado a la banda.
   - La letra sigue a la música: avanza compás por compás con los pulsos
     detectados. Si se adelanta o atrasa, se toca la línea que se está
     cantando y queda ajustada (y guardada para la próxima vez).
   - Velocidad sin cambiar el tono, repetir una parte (A–B) y ajuste fino.
   - Micrófono: escucha 10 s la música que suena en la sala (YouTube,
     Spotify, la banda en vivo), detecta el tempo y arranca el metrónomo
     a tiempo.
   El audio se guarda solo en este celular (no ocupa la base de datos).
   ========================================================================= */
(function () {
  const P = App.practice, BT = App.beat;
  const PREF_KEY = 'selah-follow-v1';
  const prefs = Object.assign({ offsetMs: 0, vol: 0.9 }, App.storage.load(PREF_KEY) || {});
  const savePrefs = () => App.storage.save(PREF_KEY, prefs);

  const listeners = new Set();
  const emit = (e) => listeners.forEach((fn) => { try { fn(e); } catch (err) { console.error(err); } });

  const state = {
    status: 'empty',       // empty · loading · ready · error
    progress: 0, error: '', phase: '',
    auto: null,            // { confidence, shift } si la letra se acomodó sola
    songId: null, name: '', duration: 0,
    an: null,              // { bpm, beats, downbeat, confidence }
    marks: [],             // ajustes de la letra: [{ ci, t }]
    rate: 1, loop: false, a: null, b: null,
    playing: false, time: 0, saved: false, shared: false
  };
  const mic = { status: 'idle', left: 0, level: 0, bpm: 0, grid: null, error: '' };

  let el = null, url = null, node = null, gain = null, blob = null;
  let anchor = null, nextBeat = 0, ticker = null, raf = null, uiQ = [], lastCi = -2, lastTimeEmit = 0;
  let resolved = null;

  // ---------------------------------------------------------------------
  // Guardado en este celular (IndexedDB)
  // ---------------------------------------------------------------------
  function idb() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) { rej(new Error('sin IndexedDB')); return; }
      const r = indexedDB.open('selah-audio', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('files'); r.result.createObjectStore('meta'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function dbDo(store, mode, fn) {
    try {
      const db = await idb();
      return await new Promise((res) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => res(req && 'result' in req ? req.result : true);
        tx.onerror = () => res(null);
      });
    } catch (e) { return null; }
  }
  const saveFile = (id, rec) => dbDo('files', 'readwrite', (s) => s.put(rec, id));
  const saveMeta = (id, rec) => dbDo('meta', 'readwrite', (s) => s.put(rec, id));
  const getFile = (id) => dbDo('files', 'readonly', (s) => s.get(id));
  const getMeta = (id) => dbDo('meta', 'readonly', (s) => s.get(id));
  const delAll = (id) => Promise.all([dbDo('files', 'readwrite', (s) => s.delete(id)), dbDo('meta', 'readwrite', (s) => s.delete(id))]);

  function persistMeta() {
    if (!state.songId || !state.an) return;
    saveMeta(state.songId, { an: state.an, marks: state.marks, auto: state.auto, name: state.name, at: Date.now() });
  }

  function mono(buf) {
    if (buf.numberOfChannels === 1) return buf.getChannelData(0);
    const a = buf.getChannelData(0), b = buf.getChannelData(1), out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) * 0.5;
    return out;
  }

  /** Volver a acomodar la letra sola (por ejemplo, después de cambiar la hoja). */
  async function realign(song) {
    if (!blob || !state.an) return;
    state.status = 'loading'; state.progress = 0.5; state.phase = 'Acomodando la letra con la música…';
    emit({ type: 'follow' });
    try {
      const buf = await decode(await blob.arrayBuffer());
      const r = await App.align.align({ samples: mono(buf), sr: buf.sampleRate, beats: state.an.beats, plan: P.plan, sub: P.meter.sub, onProgress: (p) => { state.progress = 0.5 + p * 0.5; emit({ type: 'progress' }); } });
      state.marks = r.marks; state.auto = { confidence: r.confidence, shift: r.shift };
      resolved = null; lastCi = -2;
      persistMeta();
    } catch (e) { App.ui.toast(e.message || 'No se pudo acomodar la letra.', { kind: 'warn' }); }
    state.status = 'ready';
    emit({ type: 'follow' });
  }

  // ---------------------------------------------------------------------
  // Cargar y analizar
  // ---------------------------------------------------------------------
  function decode(buf) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    let ctx = null;
    try { ctx = new OAC(1, 22050, 22050); } catch (e) { ctx = P.audio(); }
    return new Promise((res, rej) => {
      const p = ctx.decodeAudioData(buf, res, rej);
      if (p && p.catch) p.catch(rej);
    });
  }

  function sharedMarks(song, an) {
    const sy = song && song.sync;
    if (sy && sy.marks && Math.abs((sy.duration || 0) - an.duration) < 2.5) { state.shared = true; return sy.marks.slice(); }
    return null;
  }

  async function load(source, { song, name, remember = true, cached = null } = {}) {
    unload(false);
    Object.assign(state, { status: 'loading', progress: 0, error: '', songId: song.id, name: name || 'Audio', shared: false, saved: false, marks: [], loop: false, a: null, b: null, rate: 1 });
    emit({ type: 'follow' });
    try {
      blob = source;
      let an = cached && cached.an;
      let buf = null;
      if (!an) {
        state.phase = 'Escuchando el ritmo…';
        buf = await decode(await blob.arrayBuffer());
        an = await BT.analyzeBuffer(buf, {
          hint: song.bpm || 0,
          beatsPerBar: P.meter.beats,
          onProgress: (p) => { state.progress = p * 0.5; emit({ type: 'progress' }); }
        });
      }
      state.an = an;
      state.duration = an.duration;
      state.marks = sharedMarks(song, an) || (cached && cached.marks) || [];
      state.auto = (cached && cached.auto) || null;
      // Sin sincronización todavía: la app acomoda la letra sola
      if (!state.marks.length && P.plan.length >= 2) {
        try {
          if (!buf) buf = await decode(await blob.arrayBuffer());
          state.phase = 'Acomodando la letra con la música…';
          emit({ type: 'progress' });
          const r = await App.align.align({ samples: mono(buf), sr: buf.sampleRate, beats: an.beats, plan: P.plan, sub: P.meter.sub, onProgress: (p) => { state.progress = 0.5 + p * 0.5; emit({ type: 'progress' }); } });
          state.marks = r.marks;
          state.auto = { confidence: r.confidence, shift: r.shift };
        } catch (e) { state.auto = null; }
      }
      resolved = null;
      mount();
      state.status = 'ready';
      if (remember) {
        if (!cached) await saveFile(song.id, { blob, name: state.name, at: Date.now() });
        persistMeta();
        state.saved = true;
      }
    } catch (e) {
      state.status = 'error';
      state.error = e && /decod|encod|format/i.test(`${e.name} ${e.message}`)
        ? 'El navegador no pudo leer este archivo. Usa un MP3 o M4A.'
        : (e && e.message) || 'No se pudo leer este audio.';
    }
    emit({ type: 'follow' });
  }

  async function loadUrl(link, opts) {
    const info = App.media.parse(link);
    const src = (info && info.src) || link;
    let res;
    try { res = await fetch(src); } catch (e) { throw new Error('Ese link no deja leer el audio desde la app. Descárgalo y elígelo como archivo.'); }
    if (!res.ok) throw new Error('No se pudo abrir el audio del link.');
    const b = await res.blob();
    return load(b, Object.assign({ name: (info && App.media.cachedTitle(info.url)) || App.media.fallbackTitle(info) }, opts));
  }

  /** Abre el audio guardado de esta canción, si hay. */
  async function restore(song) {
    if (!song || (state.songId === song.id && state.status !== 'empty')) return;
    unload(false);
    Object.assign(state, { status: 'empty', songId: song.id, error: '' });
    const [file, meta] = await Promise.all([getFile(song.id), getMeta(song.id)]);
    if (state.songId !== song.id) return;
    if (file && file.blob) {
      await load(file.blob, { song, name: file.name, cached: meta && meta.an ? meta : null });
      state.saved = true;
    } else emit({ type: 'follow' });
  }

  function mount() {
    url = URL.createObjectURL(blob);
    el = new Audio();
    el.preload = 'auto';
    el.src = url;
    el.preservesPitch = true; el.mozPreservesPitch = true; el.webkitPreservesPitch = true;
    el.setAttribute('playsinline', '');
    try {
      const ctx = P.audio();
      node = ctx.createMediaElementSource(el);
      gain = ctx.createGain();
      gain.gain.value = prefs.vol;
      node.connect(gain);
      gain.connect(ctx.destination);
    } catch (e) { node = null; gain = null; el.volume = prefs.vol; }
    ['play', 'seeked', 'ratechange'].forEach((t) => el.addEventListener(t, () => { anchor = null; resync(); }));
    el.addEventListener('ended', () => { state.playing = false; stopTimers(); emit({ type: 'state' }); });
    el.addEventListener('pause', () => { if (state.playing && !el.seeking) { state.playing = false; stopTimers(); emit({ type: 'state' }); } });
  }

  function unload(notify = true) {
    pause();
    if (node) try { node.disconnect(); } catch (e) { /* nada */ }
    if (gain) try { gain.disconnect(); } catch (e) { /* nada */ }
    if (el) { el.removeAttribute('src'); try { el.load(); } catch (e) { /* nada */ } }
    if (url) URL.revokeObjectURL(url);
    el = null; url = null; node = null; gain = null; blob = null; resolved = null;
    Object.assign(state, { status: 'empty', an: null, marks: [], duration: 0, time: 0, playing: false });
    if (notify) emit({ type: 'follow' });
  }

  async function remove() {
    const id = state.songId;
    unload();
    state.songId = id;
    if (id) await delAll(id);
    emit({ type: 'follow' });
  }

  // ---------------------------------------------------------------------
  // La letra sigue a la música
  // ---------------------------------------------------------------------
  function nearestBeat(t) {
    const b = state.an.beats;
    let lo = 0, hi = b.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (b[m] < t) lo = m + 1; else hi = m; }
    return lo > 0 && Math.abs(b[lo - 1] - t) < Math.abs(b[lo] - t) ? lo - 1 : lo;
  }

  /** Puntos de anclaje [{ ci, b }]: los ajustes, o el primer "1" de la música. */
  function anchors() {
    if (resolved) return resolved;
    const plan = P.plan;
    if (!state.an || !plan.length) return (resolved = []);
    const list = state.marks.map((m) => ({ ci: m.ci, b: nearestBeat(m.t) })).sort((x, y) => x.b - y.b);
    if (!list.length) {
      const first = list.length ? Math.min(state.an.downbeat, list[0].b) : state.an.downbeat;
      if (!list.length || list[0].b > first) list.unshift({ ci: plan[0].ci, b: first, auto: true });
    }
    return (resolved = list);
  }

  function evAtStep(step) {
    const plan = P.plan;
    let lo = 0, hi = plan.length - 1;
    if (!plan.length || step < 0) return null;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (plan[m].startStep <= step) lo = m; else hi = m - 1; }
    const ev = plan[lo];
    return step < ev.startStep + ev.steps ? ev : null;
  }

  function chordAtBeat(i) {
    const list = anchors();
    if (list.length >= 2) {
      const beats = state.an.beats;
      return App.yt.chordAt(list.map((x) => ({ ci: x.ci, t: beats[x.b] })), P.plan, beats[i] + 0.001, state.an.bpm, P.meter.sub);
    }
    let a = null, next = null;
    for (const x of list) { if (x.b <= i) a = x; else { next = x; break; } }
    if (!a) return null;
    const plan = P.plan;
    const start = plan.find((e) => e.ci === a.ci);
    if (!start) return null;
    // Entre dos marcas: los acordes se reparten en el tiempo real que hay entre ellas
    const end = next && plan.find((e) => e.ci === next.ci);
    if (end && next.b > a.b && end.startStep > start.startStep) {
      const step = start.startStep + ((i - a.b) / (next.b - a.b)) * (end.startStep - start.startStep);
      const ev = evAtStep(step);
      return ev && ev.ci >= next.ci ? plan[Math.max(0, plan.indexOf(end) - 1)] : ev;
    }
    let ev = evAtStep(start.startStep + (i - a.b) * P.meter.sub);
    if (ev && next && ev.ci >= next.ci) {
      const k = plan.findIndex((e) => e.ci === next.ci);
      ev = plan[Math.max(0, k - 1)];
    }
    return ev;
  }

  /** Momento de la grabación donde empieza un acorde. */
  function timeOfChord(ci) {
    const plan = P.plan, list = anchors();
    const target = plan.find((e) => e.ci === ci);
    if (!target || !list.length) return null;
    if (list.length >= 2) return App.yt.timeOf(list.map((x) => ({ ci: x.ci, t: state.an.beats[x.b] })), plan, ci);
    let a = list[0], next = null;
    for (const x of list) { if (x.ci <= ci) a = x; else if (!next) next = x; }
    const stepOf = (c) => (plan.find((e) => e.ci === c) || plan[0]).startStep;
    let b = a.b + Math.round((target.startStep - stepOf(a.ci)) / P.meter.sub);
    // Si choca con el siguiente ajuste, se cuenta hacia atrás desde ese ajuste
    if (next && b >= next.b) b = Math.max(a.b, next.b - Math.round((stepOf(next.ci) - target.startStep) / P.meter.sub));
    const beats = state.an.beats;
    return beats[Math.max(0, Math.min(beats.length - 1, b))];
  }

  /** "Esto es lo que se está cantando": ajusta la letra a este momento. */
  function markAt(ci) {
    if (!el || !state.an) return;
    const t = Math.max(0, el.currentTime - 0.12 * (el.playbackRate || 1)); // tiempo de reacción
    const b = nearestBeat(t);
    const tb = state.an.beats[b];
    state.marks = state.marks.filter((m) => Math.abs(nearestBeat(m.t) - b) > 2).concat({ ci, t: tb }).sort((x, y) => x.t - y.t);
    resolved = null;
    lastCi = -2;
    persistMeta();
    emit({ type: 'marks' });
  }

  function undoMark() {
    if (!state.marks.length) return;
    state.marks = state.marks.slice(0, -1);
    resolved = null; lastCi = -2; persistMeta(); emit({ type: 'marks' });
  }

  function clearMarks() { state.marks = []; resolved = null; lastCi = -2; persistMeta(); emit({ type: 'marks' }); }

  // ---------------------------------------------------------------------
  // Reproducir con el click pegado a la banda
  // ---------------------------------------------------------------------
  function resync() {
    if (!el || !state.an) return;
    const t = el.currentTime - prefs.offsetMs / 1000;
    const b = state.an.beats;
    let i = 0;
    while (i < b.length && b[i] < t - 0.005) i++;
    nextBeat = i;
    uiQ = [];
  }

  function mediaNow(ctx) {
    const real = el.currentTime;
    if (el.paused) return real;
    if (!anchor) { anchor = { m: real, c: ctx.currentTime }; return real; }
    const pred = anchor.m + (ctx.currentTime - anchor.c) * (el.playbackRate || 1);
    if (Math.abs(pred - real) > 0.06) { anchor = { m: real, c: ctx.currentTime }; return real; }
    return pred;
  }

  function beatInfo(i) {
    const B = P.meter.beats;
    const rel = i - state.an.downbeat;
    return { i, beat: ((rel % B) + B) % B, bar: Math.floor(rel / B), of: B, ev: chordAtBeat(i) };
  }

  function tick() {
    if (!state.playing || !el || !state.an) return;
    const ctx = P.audio();
    const rate = el.playbackRate || 1;
    const now = mediaNow(ctx);
    if (state.loop && state.a != null && state.b != null && state.b > state.a && now >= state.b) {
      el.currentTime = state.a;
      anchor = null; resync(); lastCi = -2;
      return;
    }
    const beats = state.an.beats, off = prefs.offsetMs / 1000;
    const ahead = now + 0.15 * rate;
    while (nextBeat < beats.length && beats[nextBeat] + off <= ahead) {
      const tc = ctx.currentTime + (beats[nextBeat] + off - now) / rate;
      if (tc >= ctx.currentTime - 0.02) {
        const info = beatInfo(nextBeat);
        P.clickAt(Math.max(tc, ctx.currentTime + 0.005), info.beat === 0);
        uiQ.push(Object.assign({ t: tc }, info));
      }
      nextBeat++;
    }
  }

  function uiLoop() {
    if (!state.playing) { raf = null; return; }
    const ctx = P.audio();
    const now = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
    while (uiQ.length && uiQ[0].t <= now) {
      const e = uiQ.shift();
      emit({ type: 'beat', beat: e.beat, bar: e.bar, of: e.of });
      const ci = e.ev ? e.ev.ci : -1;
      if (ci !== lastCi) {
        lastCi = ci;
        const k = e.ev ? P.plan.indexOf(e.ev) : -1;
        const next = k >= 0 ? P.plan[k + 1] || null : P.plan[0] || null;
        P.current.ci = ci; P.current.ev = e.ev; P.current.next = next;
        emit({ type: 'chord', ev: e.ev, next });
      }
    }
    const t = performance.now();
    if (t - lastTimeEmit > 200 && el) { lastTimeEmit = t; state.time = el.currentTime; emit({ type: 'time' }); }
    raf = requestAnimationFrame(uiLoop);
  }

  function startTimers() {
    stopTimers();
    try {
      const w = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),25)'], { type: 'text/javascript' })));
      w.onmessage = tick;
      ticker = w;
    } catch (e) {
      const id = setInterval(tick, 25);
      ticker = { terminate: () => clearInterval(id) };
    }
    raf = requestAnimationFrame(uiLoop);
  }

  function stopTimers() {
    if (ticker) { ticker.terminate(); ticker = null; }
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    uiQ = [];
  }

  function play() {
    if (!el || state.status !== 'ready') return;
    P.stop();
    stopMic();
    P.audio();
    el.playbackRate = state.rate;
    const p = el.play();
    if (p && p.catch) p.catch(() => { state.playing = false; stopTimers(); emit({ type: 'state' }); App.ui.toast('Toca ▶ otra vez para empezar.', { kind: 'info' }); });
    state.playing = true;
    anchor = null; lastCi = -2;
    resync();
    startTimers();
    emit({ type: 'state' });
  }

  function pause() {
    if (el && !el.paused) el.pause();
    if (!state.playing) return;
    state.playing = false;
    stopTimers();
    emit({ type: 'state' });
  }

  function seek(t) {
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(Math.max(0, state.duration - 0.05), t));
    state.time = el.currentTime;
    anchor = null; resync(); lastCi = -2;
    emit({ type: 'time' });
  }

  /** Ir a una parte de la letra (con la música en pausa). */
  function playFrom(ci) {
    const t = timeOfChord(ci);
    if (t == null) return;
    seek(Math.max(0, t - 60 / state.an.bpm)); // un pulso antes
    play();
  }

  function setRate(r) { state.rate = r; if (el) el.playbackRate = r; anchor = null; emit({ type: 'follow' }); }
  function setVol(v) { prefs.vol = v; savePrefs(); if (gain) gain.gain.value = v; else if (el) el.volume = v; }
  function setOffset(ms) { prefs.offsetMs = Math.max(-300, Math.min(300, Math.round(ms))); savePrefs(); resync(); emit({ type: 'follow' }); }

  function setLoopPoint(which) {
    if (!el) return;
    state[which] = el.currentTime;
    if (state.a != null && state.b != null && state.b <= state.a) { const x = state.a; state.a = state.b; state.b = x; }
    if (state.a != null && state.b != null) state.loop = true;
    emit({ type: 'follow' });
  }
  function toggleLoop() { state.loop = !state.loop && state.a != null && state.b != null; emit({ type: 'follow' }); }
  function clearLoop() { state.loop = false; state.a = null; state.b = null; emit({ type: 'follow' }); }

  function fix(kind) {
    if (!state.an) return;
    if (kind === 'half') state.an = BT.halve(state.an);
    if (kind === 'double') state.an = BT.double(state.an);
    if (kind === 'shift') state.an = Object.assign({}, state.an, { downbeat: (state.an.downbeat + 1) % P.meter.beats });
    resolved = null; lastCi = -2; resync();
    persistMeta();
    emit({ type: 'follow' });
  }

  /** El líder comparte la sincronización de la letra con el equipo. */
  function share(song) {
    if (!state.an) return;
    App.actions.saveSong(Object.assign(App.utils.clone(song), {
      sync: { name: state.name, duration: Math.round(state.duration * 10) / 10, bpm: Math.round(state.an.bpm * 10) / 10, marks: state.marks.map((m) => ({ ci: m.ci, t: Math.round(m.t * 1000) / 1000 })) }
    }));
    state.shared = true;
    emit({ type: 'follow' });
  }

  // ---------------------------------------------------------------------
  // Micrófono: detectar el tempo de la música que suena en la sala
  // ---------------------------------------------------------------------
  let micStop = null;

  async function listen(song, seconds = 10) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Este navegador no deja usar el micrófono.');
    pause();
    P.stop();
    const ctx = P.audio();
    Object.assign(mic, { status: 'listening', left: seconds, level: 0, error: '', grid: null });
    emit({ type: 'mic' });
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      Object.assign(mic, { status: 'error', error: 'Permite el micrófono para que la app pueda escuchar la música.' });
      emit({ type: 'mic' });
      return;
    }
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    const chunks = [];
    let total = 0, first = null, done = false;
    const need = seconds * ctx.sampleRate;
    const cleanup = () => {
      try { proc.disconnect(); src.disconnect(); mute.disconnect(); } catch (e) { /* nada */ }
      stream.getTracks().forEach((t) => t.stop());
      micStop = null;
    };
    micStop = () => { done = true; cleanup(); Object.assign(mic, { status: 'idle' }); emit({ type: 'mic' }); };

    await new Promise((resolve) => {
      proc.onaudioprocess = (e) => {
        if (done) return;
        const d = new Float32Array(e.inputBuffer.getChannelData(0));
        if (first == null) first = ctx.currentTime - d.length / ctx.sampleRate - (ctx.baseLatency || 0);
        chunks.push(d);
        total += d.length;
        let s = 0;
        for (let i = 0; i < d.length; i += 4) s += d[i] * d[i];
        mic.level = Math.min(1, Math.sqrt(s / (d.length / 4)) * 4);
        mic.left = Math.max(0, (need - total) / ctx.sampleRate);
        emit({ type: 'mic-level' });
        if (total >= need) { done = true; resolve(); }
      };
      src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
    });
    if (mic.status !== 'listening') return;
    cleanup();
    mic.status = 'analyzing';
    emit({ type: 'mic' });
    const all = new Float32Array(total);
    let o = 0;
    chunks.forEach((c) => { all.set(c, o); o += c.length; });
    try {
      const an = await BT.analyzeChannels([all], ctx.sampleRate, { hint: song.bpm || 0, beatsPerBar: P.meter.beats });
      const period = 60 / an.bpm;
      const last = an.beats.length - 1;
      mic.grid = { t0: first + an.beats[last], period, downIdx: an.downbeat - last };
      mic.bpm = an.bpm;
      mic.status = 'ready';
      P.setBpm(an.bpm);
      startOnGrid(null);
    } catch (e) {
      Object.assign(mic, { status: 'error', error: 'No se escuchó un ritmo claro. Sube el volumen de la música y acerca el celular.' });
    }
    emit({ type: 'mic' });
  }

  /** Próximo "1" del compás según lo que escuchó el micrófono. */
  function nextDownbeat(minAhead = 0.15) {
    const g = mic.grid;
    if (!g) return null;
    const ctx = P.audio();
    const B = P.meter.beats;
    let k = Math.ceil((ctx.currentTime + minAhead - g.t0) / g.period);
    while (((k - g.downIdx) % B + B) % B !== 0) k++;
    return g.t0 + k * g.period + prefs.offsetMs / 1000;
  }

  /** Arranca el metrónomo/pistas alineado con la música que se escuchó. */
  function startOnGrid(ci) {
    const at = nextDownbeat();
    if (at == null) return;
    P.stop();
    P.play(ci, { startAt: at, countIn: false });
  }

  function stopMic() {
    if (micStop) micStop();
    if (mic.status !== 'idle') { mic.status = 'idle'; mic.grid = null; emit({ type: 'mic' }); }
  }

  App.follow = {
    state, mic, prefs,
    load, loadUrl, restore, unload, remove,
    play, pause, toggle() { if (state.playing) pause(); else play(); },
    seek, playFrom, markAt, clearMarks, undoMark, timeOfChord, realign,
    currentTime: () => (el ? el.currentTime : 0),
    setRate, setVol, setOffset, setLoopPoint, toggleLoop, clearLoop, fix, share,
    listen, stopMic, startOnGrid,
    isActive: (songId) => state.status === 'ready' && state.songId === songId,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
})();
