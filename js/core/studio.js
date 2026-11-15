/* =========================================================================
   SELAH · Estudio (como Moises, gratis y en el celular)
   - Separa la canción en pistas (js/workers/stems.js, sin IA).
   - Mezclador: volumen, silenciar (M) y solo (S) por pista.
   - Velocidad sin cambiar el tono y tono sin cambiar la velocidad
     (cambiador de tono en tiempo real con AudioWorklet).
   - Metrónomo pegado a los pulsos de la canción (½×, 1×, 2×) y conteo.
   - Acordes detectados de la grabación y su tono.
   - Si se elige la alabanza: secciones y letra que sigue a la música.
   Todo se guarda solo en este celular (IndexedDB).
   ========================================================================= */
(function () {
  const P = App.practice;

  // ---------------------------------------------------------------------
  // Guardado en este celular
  // ---------------------------------------------------------------------
  function idb() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) { rej(new Error('sin IndexedDB')); return; }
      const r = indexedDB.open('selah-studio', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('items'); r.result.createObjectStore('files'); r.result.createObjectStore('stems'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function db(store, mode, fn) {
    try {
      const d = await idb();
      return await new Promise((res) => {
        const tx = d.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => res(req && 'result' in req ? req.result : true);
        tx.onerror = () => res(null);
      });
    } catch (e) { return null; }
  }
  const put = (store, id, v) => db(store, 'readwrite', (s) => s.put(v, id));
  const get = (store, id) => db(store, 'readonly', (s) => s.get(id));
  const del = (store, id) => db(store, 'readwrite', (s) => s.delete(id));
  const all = (store) => db(store, 'readonly', (s) => s.getAll());

  async function list() { return ((await all('items')) || []).sort((a, b) => (b.at || 0) - (a.at || 0)); }

  async function remove(id) {
    if (state.item && state.item.id === id) unload();
    await Promise.all([del('items', id), del('files', id), del('stems', id + ':2'), del('stems', id + ':4')]);
  }

  const toI16 = (f) => { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) o[i] = Math.max(-32768, Math.min(32767, f[i] * 32767)); return o; };
  const toF32 = (s) => { const o = new Float32Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s[i] / 32767; return o; };

  // ---------------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------------
  const MODES = {
    none: { label: 'Sin separar', tracks: [{ id: 'mix', label: 'Canción', icon: 'music' }] },
    2: { label: 'Voz e instrumental', tracks: [{ id: 'voz', label: 'Voz', icon: 'mic' }, { id: 'instrumental', label: 'Instrumental', icon: 'keys' }] },
    4: { label: 'Voz, batería, bajo y otros', tracks: [{ id: 'voz', label: 'Voz', icon: 'mic' }, { id: 'bateria', label: 'Batería', icon: 'drum' }, { id: 'bajo', label: 'Bajo', icon: 'bass' }, { id: 'otros', label: 'Otros (guitarra, piano…)', icon: 'guitar' }] }
  };

  const state = {
    status: 'idle', progress: 0, phase: '', error: '',
    item: null, mode: 'none', duration: 0,
    playing: false, pos: 0,
    rate: 1, semis: 0, canShift: false,
    tracks: {}, metro: { on: false, vol: 0.7, mult: 1 }, countIn: 0,
    loop: { a: null, b: null, on: false },
    an: null, chords: [], key: '', marks: [], plan: [], sections: [], shift: 0
  };
  const listeners = new Set();
  const emit = (e) => listeners.forEach((fn) => { try { fn(e); } catch (err) { console.error(err); } });

  let buffers = {};
  let graph = null, sources = [], anchor = null, ticker = null, raf = null, nextBeat = 0, lastChord = -1, lastSection = -1, uiQ = [], lastTime = 0;

  // ---------------------------------------------------------------------
  // Cambiador de tono en tiempo real (AudioWorklet)
  // ---------------------------------------------------------------------
  const SHIFTER = `
    class Shifter extends AudioWorkletProcessor {
      static get parameterDescriptors() { return [{ name: 'ratio', defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: 'k-rate' }]; }
      constructor() { super(); this.W = Math.floor(sampleRate * 0.07); this.len = this.W * 4; this.buf = [new Float32Array(this.len), new Float32Array(this.len)]; this.w = 0; this.ph = 0; }
      read(c, d) { let x = this.w - d; while (x < 0) x += this.len; const i = Math.floor(x), f = x - i, b = this.buf[c]; return b[i % this.len] * (1 - f) + b[(i + 1) % this.len] * f; }
      process(inputs, outputs, params) {
        const inp = inputs[0], out = outputs[0], r = params.ratio[0];
        if (!inp || !inp.length) return true;
        const n = out[0].length, W = this.W, step = (1 - r) / W;
        for (let i = 0; i < n; i++) {
          for (let c = 0; c < 2; c++) this.buf[c][this.w] = (inp[c] || inp[0])[i];
          if (Math.abs(r - 1) < 1e-4) {
            for (let c = 0; c < out.length; c++) out[c][i] = (inp[c] || inp[0])[i];
          } else {
            const p1 = this.ph, p2 = (this.ph + 0.5) % 1;
            const g1 = Math.sin(Math.PI * p1), g2 = Math.sin(Math.PI * p2);
            for (let c = 0; c < out.length; c++) out[c][i] = this.read(c % 2, p1 * W + 1) * g1 + this.read(c % 2, p2 * W + 1) * g2;
            this.ph += step; this.ph -= Math.floor(this.ph);
          }
          this.w = (this.w + 1) % this.len;
        }
        return true;
      }
    }
    registerProcessor('selah-shifter', Shifter);`;

  async function ensureGraph() {
    const ctx = P.audio();
    if (graph && graph.ctx === ctx) return graph;
    const master = ctx.createGain();
    master.connect(ctx.destination);
    const bus = ctx.createGain();
    let shifter = null;
    try {
      if (ctx.audioWorklet) {
        await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([SHIFTER], { type: 'application/javascript' })));
        shifter = new AudioWorkletNode(ctx, 'selah-shifter', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      }
    } catch (e) { shifter = null; }
    if (shifter) { bus.connect(shifter); shifter.connect(master); } else bus.connect(master);
    const click = ctx.createGain();
    click.gain.value = state.metro.vol;
    click.connect(master);
    graph = { ctx, master, bus, shifter, click, gains: {} };
    state.canShift = !!shifter;
    return graph;
  }

  // ---------------------------------------------------------------------
  // Análisis: tono, acordes, secciones y letra
  // ---------------------------------------------------------------------
  const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  function detectKey(chroma) {
    const avg = new Float32Array(12);
    chroma.forEach((c) => { if (!c.quiet) for (let i = 0; i < 12; i++) avg[i] += c.v[i]; });
    let best = { s: -Infinity, key: 'C' };
    const corr = (prof, r) => {
      let ma = 0, mb = 0;
      for (let i = 0; i < 12; i++) { ma += avg[i]; mb += prof[i]; }
      ma /= 12; mb /= 12;
      let ab = 0, aa = 0, bb = 0;
      for (let i = 0; i < 12; i++) { const a = avg[(i + r) % 12] - ma, b = prof[i] - mb; ab += a * b; aa += a * a; bb += b * b; }
      return ab / Math.sqrt(aa * bb || 1);
    };
    for (let r = 0; r < 12; r++) {
      const a = corr(MAJ, r), b = corr(MIN, r);
      if (a > best.s) best = { s: a, key: NAMES[r] };
      if (b > best.s) best = { s: b, key: NAMES[r] + 'm' };
    }
    return best.key;
  }

  /** Acordes por pulso (mayores y menores) con suavizado (Viterbi). */
  function detectChords(chroma, beats) {
    const T = [];
    for (let r = 0; r < 12; r++) {
      [[0, 4, 7, ''], [0, 3, 7, 'm']].forEach(([a, b, c, q]) => {
        const v = new Float32Array(12);
        v[r] = 1; v[(r + b) % 12] = 0.8; v[(r + c) % 12] = 0.8;
        const n = Math.sqrt(1 + 0.64 + 0.64);
        for (let i = 0; i < 12; i++) v[i] /= n;
        T.push({ name: NAMES[r] + q, v });
      });
    }
    const S = T.length, N = chroma.length, SW = 0.18;
    let prev = new Float32Array(S);
    const back = [];
    for (let i = 0; i < N; i++) {
      const cur = new Float32Array(S), bk = new Int16Array(S);
      let bestPrev = 0;
      for (let s = 1; s < S; s++) if (prev[s] > prev[bestPrev]) bestPrev = s;
      for (let s = 0; s < S; s++) {
        let sc = 0;
        if (!chroma[i].quiet) for (let k = 0; k < 12; k++) sc += chroma[i].v[k] * T[s].v[k];
        const stay = prev[s], move = prev[bestPrev] - SW;
        if (stay >= move) { cur[s] = stay + sc; bk[s] = s; } else { cur[s] = move + sc; bk[s] = bestPrev; }
      }
      back.push(bk);
      prev = cur;
    }
    let s = 0;
    for (let k = 1; k < S; k++) if (prev[k] > prev[s]) s = k;
    const path = new Array(N);
    for (let i = N - 1; i >= 0; i--) { path[i] = s; s = back[i][s]; }
    const out = [];
    path.forEach((st, i) => {
      const name = chroma[i].quiet ? 'N' : T[st].name;
      const t0 = beats[i], t1 = beats[i + 1] != null ? beats[i + 1] : t0 + (beats[i] - (beats[i - 1] || t0 - 0.5));
      if (out.length && out[out.length - 1].name === name) out[out.length - 1].t1 = t1;
      else out.push({ name, t0, t1 });
    });
    return out.filter((c) => c.name !== 'N');
  }

  function buildSections() {
    state.sections = [];
    if (!state.marks.length || !state.plan.length) return;
    const ms = state.marks.slice().sort((a, b) => a.t - b.t);
    ms.forEach((m, i) => {
      const ev = state.plan.find((e) => e.ci === m.ci);
      if (!ev || (!ev.sectionStart && i)) return;
      state.sections.push({ name: ev.section || 'Inicio', t0: m.t, t1: state.duration });
    });
    state.sections.forEach((s, i) => { if (state.sections[i + 1]) s.t1 = state.sections[i + 1].t0; });
  }

  function mono(buf) {
    if (buf.numberOfChannels === 1) return buf.getChannelData(0);
    const a = buf.getChannelData(0), b = buf.getChannelData(1), out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) * 0.5;
    return out;
  }

  async function decode(blob) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    let ctx;
    try { ctx = new OAC(2, 22050, 22050); } catch (e) { ctx = P.audio(); }
    const ab = await blob.arrayBuffer();
    return new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); });
  }

  function setPhase(phase, progress) { state.phase = phase; state.progress = progress; emit({ type: 'progress' }); }

  function separate(L, R, sr, stems) {
    return new Promise((res, rej) => {
      let w;
      try { w = new Worker('js/workers/stems.js'); } catch (e) { rej(new Error('Este navegador no puede separar pistas.')); return; }
      w.onmessage = (e) => {
        const d = e.data;
        if (d.type === 'progress') setPhase('Separando las pistas…', 0.35 + d.p * 0.55);
        if (d.type === 'done') { w.terminate(); res(d.stems); }
        if (d.type === 'error') { w.terminate(); rej(new Error(d.message)); }
      };
      w.onerror = (e) => { w.terminate(); rej(new Error(e.message || 'No se pudo separar.')); };
      w.postMessage({ L: L.slice(), R: R.slice(), sr, stems });
    });
  }

  // ---------------------------------------------------------------------
  // Crear y abrir
  // ---------------------------------------------------------------------
  async function create(file, { name, mode, songId }) {
    const id = 'st' + Date.now().toString(36);
    const item = { id, name: name || file.name.replace(/\.[a-z0-9]+$/i, ''), mode: String(mode), songId: songId || null, at: Date.now(), size: file.size };
    await put('files', id, file);
    await put('items', id, item);
    return id;
  }

  async function open(id) {
    if (state.item && state.item.id === id && state.status === 'ready') return;
    unload();
    const item = await get('items', id);
    if (!item) { Object.assign(state, { status: 'error', error: 'No encontramos esta canción en el Estudio de este celular.' }); emit({ type: 'state' }); return; }
    Object.assign(state, { status: 'loading', item, mode: item.mode || 'none', error: '', pos: 0, rate: 1, semis: 0, loop: { a: null, b: null, on: false }, chords: item.chords || [], key: item.key || '', marks: item.marks || [], shift: item.shift || 0 });
    state.tracks = {};
    MODES[state.mode].tracks.forEach((t) => { state.tracks[t.id] = { vol: 1, mute: false, solo: false }; });
    emit({ type: 'state' });
    try {
      setPhase('Abriendo la canción…', 0.05);
      const file = await get('files', id);
      if (!file) throw new Error('El audio ya no está en este celular.');
      const buf = await decode(file);
      buffers = { orig: buf };
      state.duration = buf.duration;
      const song = item.songId ? App.model.song(item.songId) : null;
      state.plan = song ? App.yt.planFor(song) : [];
      // Pulsos, tono y acordes (una vez; luego se guardan)
      if (!item.an) {
        setPhase('Escuchando el ritmo…', 0.1);
        item.an = await App.beat.analyzeBuffer(buf, { hint: song ? song.bpm : 0, beatsPerBar: song ? P.meterOf(song.time).beats : 4 });
      }
      state.an = item.an;
      if (!item.chords) {
        setPhase('Reconociendo los acordes…', 0.25);
        const chroma = await App.align.chromaPerBeat(mono(buf), buf.sampleRate, item.an.beats);
        item.key = detectKey(chroma);
        item.chords = detectChords(chroma, item.an.beats);
        if (song && state.plan.length >= 2) {
          setPhase('Acomodando la letra…', 0.3);
          try {
            const r = await App.align.align({ samples: mono(buf), sr: buf.sampleRate, beats: item.an.beats, plan: state.plan, sub: P.meterOf(song.time).sub });
            item.marks = r.marks; item.shift = r.shift;
          } catch (e) { item.marks = []; }
        }
        await put('items', id, item);
      }
      Object.assign(state, { chords: item.chords, key: item.key, marks: item.marks || [], shift: item.shift || 0 });
      buildSections();
      // Pistas
      if (state.mode !== 'none') {
        const key = id + ':' + state.mode;
        let st = await get('stems', key);
        if (!st) {
          setPhase('Separando las pistas…', 0.35);
          const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
          const out = await separate(L, R, buf.sampleRate, state.mode === '4' ? ['voz', 'bateria', 'bajo'] : ['voz']);
          st = {};
          Object.keys(out).forEach((k) => { st[k] = toI16(out[k]); });
          setPhase('Guardando…', 0.95);
          await put('stems', key, st);
        }
        const ctx = P.audio();
        Object.keys(st).forEach((k) => {
          const b = ctx.createBuffer(1, st[k].length, buf.sampleRate);
          b.copyToChannel(toF32(st[k]), 0);
          buffers[k] = b;
        });
      }
      try { await ensureGraph(); } catch (e) { /* se arma al reproducir */ }
      state.status = 'ready';
      state.mono = buf.numberOfChannels === 1;
    } catch (e) {
      state.status = 'error';
      state.error = /decod|encod|format/i.test(`${e.name} ${e.message}`) ? 'El navegador no pudo leer este archivo. Usa un MP3 o M4A.' : (e.message || 'No se pudo abrir.');
    }
    emit({ type: 'state' });
  }

  function unload() {
    stop();
    buffers = {};
    Object.assign(state, { status: 'idle', item: null, chords: [], marks: [], sections: [], plan: [], an: null, pos: 0 });
  }

  // ---------------------------------------------------------------------
  // Mezcla
  // ---------------------------------------------------------------------
  function eff(id) {
    const t = state.tracks[id];
    if (!t) return 0;
    const anySolo = Object.values(state.tracks).some((x) => x.solo);
    if (t.mute && !t.solo) return 0;
    if (anySolo && !t.solo) return 0;
    return t.vol;
  }

  /** Ganancia de cada fuente: "otros" = original − pistas separadas. */
  function sourceGains() {
    if (state.mode === '2') { const gi = eff('instrumental'); return { orig: gi, voz: eff('voz') - gi }; }
    if (state.mode === '4') { const go = eff('otros'); return { orig: go, voz: eff('voz') - go, bateria: eff('bateria') - go, bajo: eff('bajo') - go }; }
    return { orig: eff('mix') };
  }

  function applyMix() {
    if (!graph) return;
    const g = sourceGains(), now = graph.ctx.currentTime;
    Object.entries(graph.gains).forEach(([k, node]) => node.gain.setTargetAtTime(g[k] || 0, now, 0.02));
  }

  function applyPitch() {
    if (!graph || !graph.shifter) return;
    const ratio = Math.pow(2, state.semis / 12) / state.rate;
    graph.shifter.parameters.get('ratio').setValueAtTime(ratio, graph.ctx.currentTime);
  }

  // ---------------------------------------------------------------------
  // Reproducir
  // ---------------------------------------------------------------------
  const position = () => {
    if (!state.playing || !anchor) return state.pos;
    if (graph.ctx.currentTime < anchor.t) return anchor.pos; // durante el conteo
    return Math.max(0, anchor.pos + (graph.ctx.currentTime - anchor.t) * state.rate);
  };

  function clickAt(t, accent) {
    const ctx = graph.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = accent ? 1760 : 1180;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.5, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g); g.connect(graph.click);
    o.start(t); o.stop(t + 0.08);
  }

  /** Pulsos del metrónomo según ½×, 1× o 2×. */
  function metroBeats() {
    const b = state.an ? state.an.beats : [];
    if (state.metro.mult === 1) return b.map((t, i) => ({ t, i }));
    if (state.metro.mult === 0.5) return b.map((t, i) => ({ t, i })).filter((x) => ((x.i - state.an.downbeat) % 2 + 2) % 2 === 0);
    const out = [];
    b.forEach((t, i) => { out.push({ t, i }); if (b[i + 1] != null) out.push({ t: (t + b[i + 1]) / 2, i: -1 }); });
    return out;
  }

  function tick() {
    if (!state.playing || !graph) return;
    const ctx = graph.ctx, pos = position();
    if (state.loop.on && state.loop.b != null && pos >= state.loop.b) { seek(state.loop.a || 0); return; }
    if (pos >= state.duration - 0.02) { pause(); state.pos = 0; emit({ type: 'state' }); return; }
    const beats = metroBeats();
    const ahead = pos + 0.15 * state.rate;
    while (nextBeat < beats.length && beats[nextBeat].t <= ahead) {
      const bt = beats[nextBeat];
      if (bt.t >= pos - 0.02) {
        const tc = anchor.t + (bt.t - anchor.pos) / state.rate;
        const B = 4;
        const isOne = bt.i >= 0 && ((bt.i - state.an.downbeat) % B + B) % B === 0;
        if (state.metro.on) clickAt(Math.max(ctx.currentTime + 0.003, tc), isOne);
        if (bt.i >= 0) uiQ.push({ t: tc, beat: ((bt.i - state.an.downbeat) % B + B) % B });
      }
      nextBeat++;
    }
  }

  function uiLoop() {
    if (!state.playing) { raf = null; return; }
    const ctx = graph.ctx, now = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
    while (uiQ.length && uiQ[0].t <= now) { const e = uiQ.shift(); emit({ type: 'beat', beat: e.beat }); }
    const pos = position();
    state.pos = pos;
    const ci = state.chords.findIndex((c) => pos >= c.t0 && pos < c.t1);
    if (ci !== lastChord) { lastChord = ci; emit({ type: 'chord', index: ci }); }
    const si = state.sections.findIndex((s) => pos >= s.t0 && pos < s.t1);
    if (si !== lastSection) { lastSection = si; emit({ type: 'section', index: si }); }
    const t = performance.now();
    if (t - lastTime > 120) { lastTime = t; emit({ type: 'time' }); }
    raf = requestAnimationFrame(uiLoop);
  }

  function resyncBeats(pos) {
    const beats = metroBeats();
    nextBeat = 0;
    while (nextBeat < beats.length && beats[nextBeat].t < pos - 0.01) nextBeat++;
    uiQ = [];
  }

  function startSources(when, offset) {
    const ctx = graph.ctx;
    sources.forEach((s) => { try { s.stop(); } catch (e) { /* nada */ } });
    sources = [];
    graph.gains = {};
    const g = sourceGains();
    Object.entries(buffers).forEach(([k, buf]) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = state.rate;
      const gain = ctx.createGain();
      gain.gain.value = g[k] || 0;
      src.connect(gain); gain.connect(graph.bus);
      src.start(when, Math.max(0, Math.min(offset, buf.duration - 0.01)));
      sources.push(src);
      graph.gains[k] = gain;
    });
    anchor = { t: when, pos: offset };
  }

  async function play() {
    if (state.status !== 'ready' || state.playing) return;
    await ensureGraph();
    const ctx = graph.ctx;
    applyPitch();
    let when = ctx.currentTime + 0.08;
    // Conteo antes de empezar
    if (state.countIn > 0 && state.an) {
      const period = 60 / state.an.bpm / state.rate;
      const n = state.countIn * 4;
      for (let k = 0; k < n; k++) clickAt(when + k * period, k % 4 === 0);
      for (let k = 0; k < n; k++) uiQ.push({ t: when + k * period, beat: k % 4, count: n - k });
      when += n * period;
    }
    startSources(when, state.pos);
    state.playing = true;
    resyncBeats(state.pos);
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, 25);
    raf = requestAnimationFrame(uiLoop);
    emit({ type: 'state' });
  }

  function pause() {
    if (!state.playing) return;
    state.pos = position();
    state.playing = false;
    sources.forEach((s) => { try { s.stop(); } catch (e) { /* nada */ } });
    sources = [];
    if (ticker) clearInterval(ticker);
    ticker = null;
    emit({ type: 'state' });
  }

  function stop() { pause(); state.pos = 0; }

  function seek(t) {
    state.pos = Math.max(0, Math.min(state.duration - 0.05, t));
    lastChord = -2; lastSection = -2;
    if (state.playing && graph) { startSources(graph.ctx.currentTime + 0.03, state.pos); resyncBeats(state.pos); }
    emit({ type: 'time' });
  }

  function setRate(r) {
    const pos = position();
    state.rate = Math.max(0.5, Math.min(1.5, Math.round(r * 100) / 100));
    if (state.playing && graph) {
      sources.forEach((s) => s.playbackRate.setValueAtTime(state.rate, graph.ctx.currentTime));
      anchor = { t: graph.ctx.currentTime, pos };
      resyncBeats(pos);
    }
    applyPitch();
    emit({ type: 'settings' });
  }

  function setSemis(s) { state.semis = Math.max(-6, Math.min(6, s)); applyPitch(); emit({ type: 'settings' }); }
  function setTrack(id, patch) { Object.assign(state.tracks[id], patch); applyMix(); emit({ type: 'mix' }); }
  function setMetro(patch) {
    Object.assign(state.metro, patch);
    if (graph) graph.click.gain.setTargetAtTime(state.metro.vol, graph.ctx.currentTime, 0.02);
    if (patch.mult) resyncBeats(position());
    emit({ type: 'settings' });
  }
  function setCountIn(n) { state.countIn = n; emit({ type: 'settings' }); }
  function setLoop(patch) { Object.assign(state.loop, patch); emit({ type: 'settings' }); }
  function loopSection(i) {
    const s = state.sections[i];
    if (!s) return;
    Object.assign(state.loop, { a: s.t0, b: s.t1, on: true });
    seek(s.t0);
    emit({ type: 'settings' });
  }

  async function update(patch) {
    if (!state.item) return;
    Object.assign(state.item, patch);
    await put('items', state.item.id, state.item);
  }

  /** Vincular con una alabanza del repertorio (para secciones y letra). */
  async function linkSong(songId) {
    if (!state.item) return;
    const song = App.model.song(songId);
    state.item.songId = songId || null;
    state.plan = song ? App.yt.planFor(song) : [];
    state.marks = []; state.sections = []; state.shift = 0;
    if (song && state.plan.length >= 2 && buffers.orig) {
      setPhase('Acomodando la letra…', 0.5);
      try {
        const r = await App.align.align({ samples: mono(buffers.orig), sr: buffers.orig.sampleRate, beats: state.an.beats, plan: state.plan, sub: P.meterOf(song.time).sub });
        state.marks = r.marks; state.shift = r.shift;
      } catch (e) { /* sin letra */ }
    }
    buildSections();
    await update({ songId: state.item.songId, marks: state.marks, shift: state.shift });
    emit({ type: 'state' });
  }

  App.studio = {
    MODES, state, list, create, open, remove, unload, linkSong,
    play, pause, toggle() { if (state.playing) pause(); else play(); }, seek, position,
    setRate, setSemis, setTrack, setMetro, setCountIn, setLoop, loopSection,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
})();
