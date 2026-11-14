/* =========================================================================
   SELAH · Motor de ensayo: metrónomo y pistas
   Genera en el navegador (Web Audio) una banda de ensayo a partir de la
   hoja de acordes: click, batería, bajo, piano, guitarra y pad. Cada pista
   se sube, se baja, se silencia o se deja sola, como un mezclador.
   No descarga ni guarda audio: todo se sintetiza en el momento, así que
   no ocupa espacio en la base de datos.

   Uso:
     App.practice.load({ chart, arrangement, n, bpm, time, tempo })
     App.practice.play() / stop() / toggle()
     App.practice.on((evento) => …)   // beat, chord, step, count, state
   ========================================================================= */
(function () {
  const C = App.chords;
  const PREF_KEY = 'selah-practice-v1';

  // ---- Compás: pulsos por compás y subdivisiones por pulso ----
  const METERS = {
    '4/4': { beats: 4, sub: 2 }, '3/4': { beats: 3, sub: 2 }, '2/4': { beats: 2, sub: 2 },
    '6/4': { beats: 6, sub: 2 }, '6/8': { beats: 2, sub: 3 }, '12/8': { beats: 4, sub: 3 }
  };
  const meterOf = (t) => METERS[t] || METERS['4/4'];

  const TRACKS = [
    { id: 'click',  label: 'Click',    icon: 'metronome', level: 0.55 },
    { id: 'drums',  label: 'Batería',  icon: 'drum',      level: 0.95 },
    { id: 'bass',   label: 'Bajo',     icon: 'bass',      level: 0.8 },
    { id: 'piano',  label: 'Piano',    icon: 'keys',      level: 0.62 },
    { id: 'guitar', label: 'Guitarra', icon: 'guitar',    level: 0.6 },
    { id: 'pad',    label: 'Pad',      icon: 'pad',       level: 0.42 }
  ];
  const ALL = TRACKS.map((t) => t.id);

  const PRESETS = [
    { id: 'metronomo',  label: 'Metrónomo',     on: ['click'] },
    { id: 'banda',      label: 'Banda completa', on: ALL },
    { id: 'sinbateria', label: 'Sin batería',   on: ['click', 'bass', 'piano', 'guitar', 'pad'] },
    { id: 'bateria',    label: 'Solo batería',  on: ['drums'] },
    { id: 'piano',      label: 'Solo piano',    on: ['click', 'piano'] },
    { id: 'guitarra',   label: 'Solo guitarra', on: ['click', 'guitar'] },
    { id: 'ritmo',      label: 'Batería y bajo', on: ['drums', 'bass'] }
  ];

  // ---- Preferencias guardadas en este celular ----
  const saved = App.storage.load(PREF_KEY) || {};
  const prefs = Object.assign({ chordBars: 1, countIn: true, loop: false, follow: true, master: 0.9 }, saved.prefs || {});
  const mix = {};
  TRACKS.forEach((t) => { mix[t.id] = Object.assign({ vol: 0.8, mute: t.id !== 'click', solo: false }, (saved.mix || {})[t.id] || {}); });
  const persist = App.utils.debounce(() => App.storage.save(PREF_KEY, { prefs, mix }), 300);

  // ---- Estado ----
  const song = { chart: '', arrangement: null, n: 0, bpm: 80, time: '4/4', tempo: 'media', key: 'C' };
  let meter = meterOf('4/4');
  let plan = [];             // acordes con su paso de inicio y duración
  let sectionStarts = [];
  let totalSteps = 0;

  let ctx = null, master = null, comp = null, reverb = null, revIn = null, noise = null;
  const bus = {};            // ganancia final de cada pista (mezclador)
  const target = {};         // entrada fija de cada pista (con filtro, si tiene)
  let sess = null;           // entradas de esta reproducción (se cortan al parar)
  const ksCache = new Map();

  let playing = false;
  let ending = false;
  let startAt = 0;
  let step = 0, nextTime = 0, pi = 0, si = 0;
  let ticker = null, raf = null;
  let uiQueue = [];
  let guitarVoices = [];
  let taps = [];
  const listeners = new Set();
  const current = { ci: -1, ev: null, next: null, beat: -1, bar: 0, sib: -1 };

  const emit = (e) => listeners.forEach((fn) => { try { fn(e); } catch (err) { console.error(err); } });
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const mod = (n) => ((n % 12) + 12) % 12;
  const stepDur = () => 60 / song.bpm / meter.sub;

  // ---------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------
  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Este navegador no puede generar audio.');
      ctx = new AC({ latencyHint: 'interactive' });
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
      master = ctx.createGain();
      master.gain.value = prefs.master;
      master.connect(comp);
      comp.connect(ctx.destination);

      reverb = ctx.createConvolver();
      reverb.buffer = impulse(2.4, 2.6);
      revIn = ctx.createGain();
      revIn.gain.value = 0.55;
      revIn.connect(reverb);
      reverb.connect(master);

      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = noise.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

      TRACKS.forEach((t) => {
        const g = ctx.createGain();
        g.connect(master);
        bus[t.id] = g;
        target[t.id] = g;
      });
      // Un poco de sala para los instrumentos armónicos
      [['piano', 0.28], ['guitar', 0.22], ['pad', 0.6], ['drums', 0.06]].forEach(([id, amt]) => {
        const send = ctx.createGain();
        send.gain.value = amt;
        bus[id].connect(send);
        send.connect(revIn);
      });
      // La guitarra con un filtro suave
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 5200;
      lp.connect(bus.guitar);
      target.guitar = lp;
      applyMix();
    }
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* iOS antiguo */ }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function gainOf(id) {
    const anySolo = TRACKS.some((t) => mix[t.id].solo);
    const m = mix[id];
    const t = TRACKS.find((x) => x.id === id);
    if (m.mute && !m.solo) return 0;
    if (anySolo && !m.solo) return 0;
    return m.vol * t.level;
  }

  function applyMix() {
    if (!ctx) return;
    TRACKS.forEach((t) => bus[t.id].gain.setTargetAtTime(gainOf(t.id), ctx.currentTime, 0.03));
    master.gain.setTargetAtTime(prefs.master, ctx.currentTime, 0.03);
  }

  const audible = (id) => gainOf(id) > 0;

  // ---- Sonidos ----
  function envGain(t, peak, attack, decay, dest) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest);
    return g;
  }

  function noiseSrc(t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur);
    return s;
  }

  function click(t, accent, dest = sess.click) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = accent ? 1760 : 1180;
    o.connect(envGain(t, accent ? 0.9 : 0.5, 0.001, 0.05, dest));
    o.start(t); o.stop(t + 0.07);
  }

  function kick(t, v = 1) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(155, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    o.connect(envGain(t, 1.1 * v, 0.002, 0.38, sess.drums));
    o.start(t); o.stop(t + 0.42);
    const n = noiseSrc(t, 0.02);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
    n.connect(hp); hp.connect(envGain(t, 0.25 * v, 0.001, 0.015, sess.drums));
  }

  function snare(t, v = 1) {
    const n = noiseSrc(t, 0.25);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100;
    n.connect(hp); hp.connect(envGain(t, 0.75 * v, 0.001, 0.18, sess.drums));
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    o.connect(envGain(t, 0.45 * v, 0.001, 0.09, sess.drums));
    o.start(t); o.stop(t + 0.12);
  }

  function hat(t, v = 1, open = false) {
    const n = noiseSrc(t, open ? 0.4 : 0.08);
    const bp = ctx.createBiquadFilter(); bp.type = 'highpass'; bp.frequency.value = 7200;
    n.connect(bp); bp.connect(envGain(t, (open ? 0.22 : 0.3) * v, 0.001, open ? 0.3 : 0.045, sess.drums));
  }

  function crash(t, v = 1) {
    const n = noiseSrc(t, 1.6);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4200;
    n.connect(hp); hp.connect(envGain(t, 0.3 * v, 0.002, 1.5, sess.drums));
  }

  function bassNote(t, midi, dur, v = 1) {
    const f = mtof(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(320, t + Math.min(0.4, dur));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55 * v, t + 0.008);
    g.gain.setTargetAtTime(0.38 * v, t + 0.02, 0.15);
    g.gain.setTargetAtTime(0.0001, t + Math.max(0.03, dur - 0.04), 0.03);
    lp.connect(g); g.connect(sess.bass);
    const saw = ctx.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = f;
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = f;
    const sg = ctx.createGain(); sg.gain.value = 0.9;
    saw.connect(lp); sub.connect(sg); sg.connect(g);
    const end = t + dur + 0.2;
    saw.start(t); sub.start(t); saw.stop(end); sub.stop(end);
  }

  function pianoNote(t, midi, dur, v = 1) {
    const f = mtof(midi);
    const life = Math.max(0.8, 2.8 - (midi - 48) * 0.035);
    const out = ctx.createGain();
    out.gain.value = 1;
    out.gain.setTargetAtTime(0.0001, t + dur, 0.12);
    out.connect(sess.piano);
    [[1, 0.5], [2, 0.2], [3, 0.08], [4, 0.035]].forEach(([k, amp], i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * k * (1 + (i ? 0.0008 * i : 0));
      o.connect(envGain(t, amp * v, 0.004, life / k, out));
      o.start(t);
      o.stop(t + Math.min(dur + 0.6, life + 0.1));
    });
  }

  function ksBuffer(midi) {
    if (ksCache.has(midi)) return ksCache.get(midi);
    const sr = ctx.sampleRate;
    const N = Math.max(2, Math.round(sr / mtof(midi)));
    const len = Math.floor(sr * 2.4);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
    for (let i = 1; i < N; i++) d[i] = 0.5 * (d[i] + d[i - 1]);
    const damp = 0.9965;
    for (let i = N; i < len; i++) d[i] = damp * 0.5 * (d[i - N] + d[i - N + 1]);
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
    if (peak > 0) for (let i = 0; i < len; i++) d[i] /= peak;
    ksCache.set(midi, buf);
    return buf;
  }

  const OPEN_STRINGS = [40, 45, 50, 55, 59, 64];

  function strum(t, frets, dur, up = false, v = 1) {
    guitarVoices.forEach((g) => { try { g.gain.setTargetAtTime(0.0001, t, 0.025); } catch (e) { /* nada */ } });
    guitarVoices = [];
    const strings = frets.map((f, s) => ({ f, s })).filter((x) => x.f >= 0);
    const order = up ? strings.slice().reverse().slice(0, 4) : strings;
    const spread = up ? 0.012 : 0.016;
    order.forEach((x, k) => {
      const src = ctx.createBufferSource();
      src.buffer = ksBuffer(OPEN_STRINGS[x.s] + x.f);
      const g = ctx.createGain();
      const at = t + k * spread;
      g.gain.setValueAtTime((up ? 0.26 : 0.34) * v * (0.9 + Math.random() * 0.2), at);
      g.gain.setTargetAtTime(0.0001, at + dur, 0.06);
      src.connect(g); g.connect(sess.guitar);
      src.start(at);
      src.stop(at + Math.min(2.3, dur + 0.5));
      guitarVoices.push(g);
    });
  }

  function padChord(t, notes, dur) {
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(1, t + Math.min(0.9, dur * 0.5));
    out.gain.setTargetAtTime(0.0001, t + dur, 0.35);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.4;
    lp.connect(out); out.connect(sess.pad);
    notes.forEach((m) => [-7, 7].forEach((cents) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = cents;
      const g = ctx.createGain(); g.gain.value = 0.045;
      o.connect(g); g.connect(lp);
      o.start(t); o.stop(t + dur + 1.6);
    }));
  }

  // ---------------------------------------------------------------------
  // Voces de cada instrumento para un acorde
  // ---------------------------------------------------------------------
  const tonesCache = new Map();
  function tones(chord) {
    const k = chord + '|' + song.n;
    if (!tonesCache.has(k)) tonesCache.set(k, C.chordTones(chord, song.n));
    return tonesCache.get(k);
  }

  /** Piano: mano izquierda (bajo) y mano derecha (acorde) en notas MIDI. */
  function pianoVoicing(chord) {
    const t = typeof chord === 'string' ? tones(chord) : chord;
    if (!t) return { lh: [], rh: [] };
    let iv = t.intervals.slice();
    if (iv.length > 4) iv = iv.filter((x) => x !== 7);
    const rh = Array.from(new Set(iv.map((x) => 60 + mod(t.root + x)))).sort((a, b) => a - b);
    return { lh: [48 + t.bass], rh };
  }

  // Posiciones de guitarra (cuerda 6 → 1, -1 = no se toca)
  const OPEN_SHAPES = {
    '0:': [-1, 3, 2, 0, 1, 0], '0:maj7': [-1, 3, 2, 0, 0, 0], '0:7': [-1, 3, 2, 3, 1, 0], '0:sus2': [-1, 3, 0, 0, 1, 3], '0:sus4': [-1, 3, 3, 0, 1, 1],
    '2:': [-1, -1, 0, 2, 3, 2], '2:m': [-1, -1, 0, 2, 3, 1], '2:7': [-1, -1, 0, 2, 1, 2], '2:m7': [-1, -1, 0, 2, 1, 1], '2:maj7': [-1, -1, 0, 2, 2, 2], '2:sus4': [-1, -1, 0, 2, 3, 3], '2:sus2': [-1, -1, 0, 2, 3, 0],
    '4:': [0, 2, 2, 1, 0, 0], '4:m': [0, 2, 2, 0, 0, 0], '4:7': [0, 2, 0, 1, 0, 0], '4:m7': [0, 2, 0, 0, 0, 0], '4:maj7': [0, 2, 1, 1, 0, 0], '4:sus4': [0, 2, 2, 2, 0, 0],
    '5:maj7': [-1, -1, 3, 2, 1, 0],
    '7:': [3, 2, 0, 0, 0, 3], '7:7': [3, 2, 0, 0, 0, 1], '7:maj7': [3, 2, 0, 0, 0, 2], '7:sus4': [3, 3, 0, 0, 1, 3],
    '9:': [-1, 0, 2, 2, 2, 0], '9:m': [-1, 0, 2, 2, 1, 0], '9:7': [-1, 0, 2, 0, 2, 0], '9:m7': [-1, 0, 2, 0, 1, 0], '9:maj7': [-1, 0, 2, 1, 2, 0], '9:sus4': [-1, 0, 2, 2, 3, 0], '9:sus2': [-1, 0, 2, 2, 0, 0],
    '11:7': [-1, 2, 1, 2, 0, 2]
  };
  const SLASH_SHAPES = {
    '2/6': [2, 0, 0, 2, 3, 2], '7/11': [-1, 2, 0, 0, 0, 3], '0/4': [0, 3, 2, 0, 1, 0], '0/7': [3, 3, 2, 0, 1, 0],
    '9/1': [-1, 4, 2, 2, 2, 0], '7/2': [-1, -1, 0, 0, 0, 3], '5/0': [-1, 3, 3, 2, 1, 1], '2/9': [-1, 0, 0, 2, 3, 2], '0/11': [-1, 2, 2, 0, 1, 0]
  };
  const E_FORM = { '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], 7: [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0], maj7: [0, 2, 1, 1, 0, 0], sus4: [0, 2, 2, 2, 0, 0] };
  const A_FORM = { '': [-1, 0, 2, 2, 2, 0], m: [-1, 0, 2, 2, 1, 0], 7: [-1, 0, 2, 0, 2, 0], m7: [-1, 0, 2, 0, 1, 0], maj7: [-1, 0, 2, 1, 2, 0], sus4: [-1, 0, 2, 2, 3, 0], sus2: [-1, 0, 2, 2, 0, 0] };

  function quality(t) {
    const iv = t.intervals;
    const has = (x) => iv.includes(x);
    if (has(3) && has(10)) return 'm7';
    if (has(3)) return 'm';
    if (has(4) && has(11)) return 'maj7';
    if (has(4) && has(10)) return '7';
    if (has(5) && !has(4)) return 'sus4';
    if (has(2) && !has(3) && !has(4)) return 'sus2';
    return '';
  }

  /** Posición de guitarra: { frets, base, barre } */
  function guitarShape(chord) {
    const t = typeof chord === 'string' ? tones(chord) : chord;
    if (!t) return null;
    const q = quality(t);
    if (t.bass !== t.root && SLASH_SHAPES[`${t.root}/${t.bass}`] && q === '') return { frets: SLASH_SHAPES[`${t.root}/${t.bass}`], barre: 0 };
    if (OPEN_SHAPES[`${t.root}:${q}`]) return { frets: OPEN_SHAPES[`${t.root}:${q}`], barre: 0 };
    const eF = mod(t.root - 4), aF = mod(t.root - 9);
    const useA = !E_FORM[q] || (A_FORM[q] && (aF < eF || eF > 7) && aF > 0);
    const form = useA ? A_FORM[q] || A_FORM[''] : E_FORM[q];
    const fret = useA ? aF : eF;
    return { frets: form.map((x) => (x < 0 ? -1 : x + fret)), barre: fret };
  }

  // ---------------------------------------------------------------------
  // Patrones (los usa el sonido y el dibujo de la batería)
  // ---------------------------------------------------------------------
  function drumHits(sib, feel = song.tempo) {
    const { beats, sub } = meter;
    const beat = Math.floor(sib / sub), subi = sib % sub;
    const h = { k: 0, s: 0, h: 0, o: 0 };
    if (subi === 0) {
      if (beat === 0) h.k = 1;
      if (feel === 'rapida' && beats !== 3) h.k = 1;
      if (feel === 'media' && beats === 4 && beat === 2) h.k = 1;
      if (feel === 'media' && beats === 6 && beat === 3) h.k = 1;
      if (beats === 4) h.s = feel === 'lenta' ? (beat === 2 ? 1 : 0) : (beat === 1 || beat === 3 ? 1 : 0);
      else if (beats === 3) h.s = beat === 2 ? 1 : 0;
      else if (beats === 2) h.s = beat === 1 ? 1 : 0;
      else if (beats === 6) h.s = beat === 3 ? 1 : 0;
    }
    if (feel === 'media' && beats === 4 && sub === 2 && sib === 5) h.k = 1;
    if (feel === 'lenta') h.h = subi === 0 ? 1 : 0;
    else h.h = 1;
    if (feel === 'rapida' && sub === 2 && subi === 1) { h.o = 1; h.h = 0; }
    return h;
  }

  function guitarStroke(sib, isStart) {
    const { beats, sub } = meter;
    const subi = sib % sub;
    if (isStart) return 'D';
    if (song.tempo === 'lenta') return sib === 0 ? 'D' : null;
    if (song.tempo === 'media' && beats === 4 && sub === 2) return { 0: 'D', 2: 'D', 3: 'U', 5: 'U', 6: 'D', 7: 'U' }[sib] || null;
    if (sub === 3) return subi === 0 ? 'D' : subi === 2 ? 'U' : null;
    return subi === 0 ? 'D' : 'U';
  }

  // ---------------------------------------------------------------------
  // Plan: acordes en el tiempo
  // ---------------------------------------------------------------------
  function buildPlan() {
    meter = meterOf(song.time);
    const spb = meter.beats * meter.sub;
    const tl = C.timeline(song.chart, { arrangement: song.arrangement });
    let pos = 0;
    plan = tl.map((it) => {
      const steps = Math.max(meter.sub, Math.round(spb * prefs.chordBars));
      const ev = Object.assign({}, it, { startStep: pos, steps });
      pos += steps;
      return ev;
    });
    totalSteps = pos;
    sectionStarts = plan.filter((e) => e.sectionStart && e.startStep > 0).map((e) => e.startStep);
    tonesCache.clear();
  }

  // ---------------------------------------------------------------------
  // Programador (mira 120 ms hacia adelante)
  // ---------------------------------------------------------------------
  function onlyClick() { return !['drums', 'bass', 'piano', 'guitar', 'pad'].some(audible); }

  function scheduleStep(s, t) {
    const spb = meter.beats * meter.sub;
    const sd = stepDur();
    // Terminó la cuenta: salta al acorde desde donde se pidió empezar
    if (s === 0 && startAt > 0) { s = startAt; step = startAt; startAt = 0; }

    // Cuenta inicial
    if (s < 0) {
      const k = s + spb;
      if (k % meter.sub === 0) {
        const beat = k / meter.sub;
        click(t, beat === 0, sess.count);
        uiQueue.push({ t, type: 'count', n: beat + 1, of: meter.beats });
      }
      return;
    }

    if (s >= totalSteps) {
      if (prefs.loop && totalSteps > 0) { step = 0; pi = 0; si = 0; scheduleStep(0, t); return; }
      if (!onlyClick() && totalSteps > 0) { if (!ending) { ending = true; uiQueue.push({ t, type: 'end' }); } return; }
    }

    const sib = s % spb, beat = Math.floor(sib / meter.sub), subi = sib % meter.sub, bar = Math.floor(s / spb);
    while (pi < plan.length - 1 && plan[pi + 1].startStep <= s) pi++;
    const ev = s < totalSteps ? plan[pi] : null;
    const isStart = !!(ev && ev.startStep === s);
    const remaining = ev ? ev.startStep + ev.steps - s : 0;
    while (si < sectionStarts.length && sectionStarts[si] <= s) si++;
    const nextSection = sectionStarts[si];
    const fill = song.tempo !== 'lenta' && nextSection != null && nextSection - s <= meter.sub && nextSection - s > 0;

    // Click
    if (subi === 0) click(t, beat === 0);

    // Batería
    if (audible('drums')) {
      if (isStart && ev.sectionStart && s > 0) crash(t, 0.9);
      if (fill) {
        const pos = 1 - (nextSection - s) / meter.sub;
        snare(t, 0.55 + 0.45 * pos);
        if (subi === 0) kick(t, 0.8);
      } else {
        const h = drumHits(sib);
        const accent = subi === 0 ? 1 : 0.62;
        if (h.k) kick(t, 1);
        if (h.s) snare(t, song.tempo === 'lenta' ? 0.75 : 1);
        if (h.h) hat(t, accent * (song.tempo === 'lenta' ? 0.8 : 1));
        if (h.o) hat(t, 0.85, true);
      }
    }

    if (ev) {
      const tn = tones(ev.chord);
      if (tn) {
        const bassMidi = 28 + mod(tn.bass - 4);
        // Bajo
        if (audible('bass')) {
          if (song.tempo === 'rapida') {
            if (meter.sub === 2 || subi === 0) bassNote(t, bassMidi, sd * (meter.sub === 2 ? 0.85 : meter.sub * 0.9), subi === 0 ? 1 : 0.78);
          } else if (song.tempo === 'lenta') {
            if (isStart || sib === 0) bassNote(t, bassMidi, sd * Math.min(remaining, spb - sib) * 0.97, 0.95);
          } else if (isStart || (subi === 0 && (beat === 0 || (meter.beats % 2 === 0 && beat === meter.beats / 2)))) {
            bassNote(t, bassMidi, sd * Math.min(remaining, spb / 2) * 0.94, 1);
          }
        }
        // Piano
        if (audible('piano')) {
          const v = pianoVoicing(tn);
          if (song.tempo === 'lenta') {
            const arp = [v.lh[0], v.rh[0], v.rh[1], v.rh[2] || v.rh[0] + 12, v.rh[1], v.rh[0] + 12].filter((x) => x != null);
            const k = (s - ev.startStep) % arp.length;
            pianoNote(t, arp[k], sd * 4, k === 0 ? 0.85 : 0.6);
          } else if (song.tempo === 'rapida') {
            if (subi === 0) v.rh.forEach((m) => pianoNote(t, m, sd * meter.sub * 0.8, 0.62));
            if (isStart || sib === 0) pianoNote(t, v.lh[0], sd * Math.min(remaining, spb), 0.75);
          } else if (isStart || (subi === 0 && (beat === 0 || (meter.beats % 2 === 0 && beat === meter.beats / 2)))) {
            const len = sd * Math.min(remaining, meter.beats % 2 === 0 ? spb / 2 : spb);
            v.rh.forEach((m) => pianoNote(t, m, len, 0.6));
            pianoNote(t, v.lh[0], len, 0.78);
          }
        }
        // Guitarra
        if (audible('guitar')) {
          const stroke = guitarStroke(sib, isStart);
          if (stroke) {
            const shape = guitarShape(tn);
            if (shape) strum(t, shape.frets, song.tempo === 'lenta' ? sd * Math.min(remaining, spb) : sd * 2.2, stroke === 'U', stroke === 'U' ? 0.8 : 1);
          }
        }
        // Pad
        if (audible('pad') && isStart) {
          const v = pianoVoicing(tn);
          padChord(t, Array.from(new Set([v.lh[0]].concat(v.rh.map((m) => m - 12), [v.rh[0]]))), sd * ev.steps);
        }
      }
    }

    if (subi === 0) uiQueue.push({ t, type: 'beat', beat, bar, of: meter.beats });
    if (isStart) uiQueue.push({ t, type: 'chord', ev, next: plan[pi + 1] || (prefs.loop ? plan[0] : null) });
    uiQueue.push({ t, type: 'step', sib, spb });
  }

  function tick() {
    if (!playing || !sess) return;
    const ahead = ctx.currentTime + 0.12;
    while (nextTime < ahead) {
      scheduleStep(step, nextTime);
      nextTime += stepDur();
      step++;
    }
  }

  // El reloj corre en un worker para que no se detenga con la pantalla ocupada
  function startTicker() {
    try {
      const blob = new Blob(['let i=null;onmessage=(e)=>{clearInterval(i);if(e.data==="go")i=setInterval(()=>postMessage(0),25)}'], { type: 'text/javascript' });
      ticker = new Worker(URL.createObjectURL(blob));
      ticker.onmessage = tick;
      ticker.postMessage('go');
    } catch (e) {
      ticker = { id: setInterval(tick, 25), terminate() { clearInterval(this.id); } };
    }
  }

  function stopTicker() {
    if (!ticker) return;
    try { ticker.postMessage && ticker.postMessage('stop'); } catch (e) { /* nada */ }
    ticker.terminate();
    ticker = null;
  }

  function uiLoop() {
    if (!ctx) return;
    const now = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
    while (uiQueue.length && uiQueue[0].t <= now) {
      const e = uiQueue.shift();
      if (e.type === 'chord') { current.ci = e.ev.ci; current.ev = e.ev; current.next = e.next; }
      if (e.type === 'beat') { current.beat = e.beat; current.bar = e.bar; }
      if (e.type === 'step') current.sib = e.sib;
      if (e.type === 'end') { stop(); emit({ type: 'end' }); return; }
      emit(e);
    }
    raf = playing ? requestAnimationFrame(uiLoop) : null;
  }

  // ---------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------
  /** Empieza a sonar. fromCi = número del acorde desde donde empezar. */
  function play(fromCi = null, opts = {}) {
    audio();
    if (playing) return;
    if (!plan.length && totalSteps === 0) buildPlan();
    playing = true;
    ending = false;
    // Entradas nuevas para esta reproducción: al parar se cortan sin afectar la mezcla
    sess = {};
    TRACKS.forEach((t) => { const g = ctx.createGain(); g.connect(target[t.id]); sess[t.id] = g; });
    sess.count = ctx.createGain();
    sess.count.connect(master);
    const spb = meter.beats * meter.sub;
    let start = 0;
    if (fromCi != null) { const ev = plan.find((e) => e.ci === fromCi); if (ev) start = ev.startStep; }
    pi = 0; si = 0;
    const countIn = opts.countIn != null ? opts.countIn : prefs.countIn;
    if (countIn) { step = -spb; startAt = start; } else { step = start; startAt = 0; }
    nextTime = opts.startAt && opts.startAt > ctx.currentTime ? opts.startAt : ctx.currentTime + 0.08;
    uiQueue = [];
    startTicker();
    raf = requestAnimationFrame(uiLoop);
    emit({ type: 'state', playing: true });
  }

  function stop() {
    if (!playing) return;
    playing = false;
    stopTicker();
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    uiQueue = [];
    guitarVoices = [];
    const old = sess;
    sess = null;
    if (old) {
      const now = ctx.currentTime;
      Object.values(old).forEach((g) => { g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0, now, 0.03); });
      setTimeout(() => Object.values(old).forEach((g) => { try { g.disconnect(); } catch (e) { /* nada */ } }), 600);
    }
    current.beat = -1;
    emit({ type: 'state', playing: false });
  }

  function load(opts) {
    const was = playing;
    if (was) stop();
    Object.assign(song, {
      chart: opts.chart || '', arrangement: opts.arrangement || null, n: opts.n || 0,
      bpm: Math.min(240, Math.max(30, Number(opts.bpm) || 80)), time: opts.time || '4/4',
      tempo: opts.tempo || 'media', key: opts.key || 'C', id: opts.id || null
    });
    current.ci = -1; current.ev = null;
    buildPlan();
    current.next = plan[0] || null;
    emit({ type: 'load' });
  }

  function setBpm(v) {
    song.bpm = Math.min(240, Math.max(30, Math.round(v)));
    emit({ type: 'bpm', bpm: song.bpm });
    return song.bpm;
  }

  function tap() {
    const now = performance.now();
    taps = taps.filter((x) => now - x < 2500);
    taps.push(now);
    if (taps.length >= 2) {
      const gaps = taps.slice(1).map((x, i) => x - taps[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      setBpm(60000 / avg);
    }
    return song.bpm;
  }

  function setPref(k, v) {
    prefs[k] = v;
    persist();
    if (k === 'chordBars') { const was = playing; if (was) stop(); buildPlan(); }
    if (k === 'master') applyMix();
    emit({ type: 'prefs' });
  }

  function setFeel(f) { song.tempo = f; emit({ type: 'prefs' }); }

  function setVol(id, v) { mix[id].vol = v; applyMix(); persist(); }
  function toggleMute(id) { mix[id].mute = !mix[id].mute; applyMix(); persist(); emit({ type: 'mix' }); }
  function toggleSolo(id) { mix[id].solo = !mix[id].solo; applyMix(); persist(); emit({ type: 'mix' }); }
  function preset(pid) {
    const p = PRESETS.find((x) => x.id === pid);
    if (!p) return;
    TRACKS.forEach((t) => { mix[t.id].mute = !p.on.includes(t.id); mix[t.id].solo = false; });
    applyMix(); persist(); emit({ type: 'mix' });
  }
  function activePreset() {
    if (TRACKS.some((t) => mix[t.id].solo)) return null;
    const on = TRACKS.filter((t) => !mix[t.id].mute).map((t) => t.id).sort().join();
    const p = PRESETS.find((x) => x.on.slice().sort().join() === on);
    return p ? p.id : null;
  }

  /** Click para otras fuentes de tiempo (la grabación): pasa por la pista Click. */
  let ext = null;
  function clickAt(t, accent) {
    audio();
    if (!ext) { ext = ctx.createGain(); ext.connect(target.click); }
    click(t, accent, ext);
  }

  /** Corre el metrónomo unos milisegundos (para cuadrarlo con la música). */
  function nudge(sec) { if (playing) nextTime += sec; }

  App.practice = {
    TRACKS, PRESETS, meterOf,
    get playing() { return playing; },
    get song() { return song; },
    get meter() { return meter; },
    get plan() { return plan; },
    get prefs() { return prefs; },
    get mix() { return mix; },
    current,
    load, play, stop, clickAt, nudge, audio,
    toggle(fromCi) { if (playing) stop(); else play(fromCi); return playing; },
    setBpm, tap, setPref, setFeel, setVol, toggleMute, toggleSolo, preset, activePreset,
    gainOf, drumHits, guitarShape, pianoVoicing, tones,
    /** Rasgueo de un compás: 'D' (abajo), 'U' (arriba) o null. */
    strumPattern() { const spb = meter.beats * meter.sub; return Array.from({ length: spb }, (_, i) => guitarStroke(i, false)); },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
})();
