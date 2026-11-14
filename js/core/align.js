/* =========================================================================
   SELAH · Acomodar la letra sola (alineación automática)
   Escucha la grabación y la compara con los acordes de la hoja:
   1. Pulsos (App.beat) y "qué notas suenan" en cada pulso (croma, con FFT).
   2. Tono de la grabación: el que mejor coincide con los acordes de la hoja.
   3. Alineación: programación dinámica que reparte los pulsos entre los
      acordes en orden, permite intro/final libres, que una parte se repita
      (coro dos veces) o que se salte una sección.
   4. Resultado: una marca por cada línea { ci, t } para que la letra siga
      a la música (lo usan App.follow y App.yt).
   También captura el audio (micrófono o sonido de la pestaña) para
   sincronizar videos de YouTube, que no dejan leer su audio directamente.
   ========================================================================= */
(function () {
  const C = App.chords;
  const yieldUI = () => new Promise((r) => setTimeout(r, 0));

  // ---------------------------------------------------------------------
  // FFT (radix 2) y croma
  // ---------------------------------------------------------------------
  function makeFFT(n) {
    const levels = Math.log2(n) | 0;
    const rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < levels; b++) r |= ((i >> b) & 1) << (levels - 1 - b); rev[i] = r; }
    const cos = new Float32Array(n / 2), sin = new Float32Array(n / 2);
    for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = Math.sin(2 * Math.PI * i / n); }
    const re = new Float32Array(n), im = new Float32Array(n);
    return function mag(input, out) {
      for (let i = 0; i < n; i++) { re[rev[i]] = input[i]; im[rev[i]] = 0; }
      for (let size = 2; size <= n; size <<= 1) {
        const half = size >> 1, step = n / size;
        for (let i = 0; i < n; i += size) {
          for (let j = 0, k = 0; j < half; j++, k += step) {
            const a = i + j, b = a + half;
            const tr = re[b] * cos[k] + im[b] * sin[k];
            const ti = -re[b] * sin[k] + im[b] * cos[k];
            re[b] = re[a] - tr; im[b] = im[a] - ti;
            re[a] += tr; im[a] += ti;
          }
        }
      }
      for (let i = 0; i < n / 2; i++) out[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    };
  }

  /** Croma (12 notas) en cada pulso. */
  async function chromaPerBeat(samples, sr, beats, onProgress) {
    let N = 1;
    while (N < sr * 0.18) N <<= 1;
    const fft = makeFFT(N);
    const win = new Float32Array(N), frame = new Float32Array(N), mag = new Float32Array(N / 2);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    // A qué nota va cada frecuencia
    const map = [];
    for (let k = 1; k < N / 2; k++) {
      const f = k * sr / N;
      if (f < 70 || f > 2100) continue;
      const p = 69 + 12 * Math.log2(f / 440);
      const r = Math.round(p);
      const w = Math.max(0, 1 - Math.abs(p - r) * 2);
      if (w > 0) map.push([k, ((r % 12) + 12) % 12, w]);
    }
    const out = [];
    for (let b = 0; b < beats.length; b++) {
      const t0 = beats[b], t1 = b + 1 < beats.length ? beats[b + 1] : t0 + (beats[b] - (beats[b - 1] || t0 - 0.5));
      const v = new Float32Array(12);
      let energy = 0;
      for (const q of [0.3, 0.7]) {
        const center = Math.floor((t0 + (t1 - t0) * q) * sr);
        const start = center - (N >> 1);
        for (let i = 0; i < N; i++) { const s = samples[start + i] || 0; frame[i] = s * win[i]; energy += s * s; }
        fft(frame, mag);
        for (const [k, pc, w] of map) v[pc] += mag[k] * w;
      }
      let norm = 0;
      for (let i = 0; i < 12; i++) { v[i] = Math.log(1 + 50 * v[i]); norm += v[i] * v[i]; }
      norm = Math.sqrt(norm);
      if (norm > 0) for (let i = 0; i < 12; i++) v[i] /= norm;
      out.push({ v, quiet: energy / (2 * N) < 1e-6 });
      if (b % 64 === 63) { if (onProgress) onProgress(b / beats.length); await yieldUI(); }
    }
    return out;
  }

  // ---------------------------------------------------------------------
  // Plantillas de acordes y tono
  // ---------------------------------------------------------------------
  function template(chord, shift) {
    const t = C.chordTones(chord, shift);
    if (!t) return null;
    const v = new Float32Array(12);
    t.intervals.forEach((iv) => {
      const w = iv === 0 ? 1 : (iv === 3 || iv === 4) ? 0.85 : iv === 7 ? 0.8 : iv === 10 || iv === 11 ? 0.5 : 0.35;
      v[(t.root + iv) % 12] += w;
    });
    if (t.bass !== t.root) v[t.bass] += 0.5;
    let n = 0;
    for (let i = 0; i < 12; i++) n += v[i] * v[i];
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < 12; i++) v[i] /= n;
    return v;
  }

  const dot = (a, b) => { let s = 0; for (let i = 0; i < 12; i++) s += a[i] * b[i]; return s; };

  /** Semitonos entre la hoja y la grabación (0–11). */
  function detectShift(chroma, plan) {
    const audio = new Float32Array(12);
    chroma.forEach((c) => { if (!c.quiet) for (let i = 0; i < 12; i++) audio[i] += c.v[i]; });
    const scores = [];
    for (let s = 0; s < 12; s++) {
      const h = new Float32Array(12);
      plan.forEach((e) => { const t = template(e.chord, s); if (t) for (let i = 0; i < 12; i++) h[i] += t[i] * e.steps; });
      let a = 0, b = 0, ab = 0;
      for (let i = 0; i < 12; i++) { a += audio[i] * audio[i]; b += h[i] * h[i]; ab += audio[i] * h[i]; }
      scores.push({ s, score: ab / (Math.sqrt(a * b) || 1) });
    }
    return scores.sort((x, y) => y.score - x.score);
  }

  // ---------------------------------------------------------------------
  // Alineación (programación dinámica con duraciones)
  // ---------------------------------------------------------------------
  function buildNodes(plan) {
    const sections = [];
    plan.forEach((e, i) => { if (!sections.length || e.sectionStart) sections.push([]); sections[sections.length - 1].push(i); });
    const nodes = [];
    const copies = []; // por sección: { R: [ids], O: [ids] }
    sections.forEach((evs) => {
      const R = evs.map((ev) => nodes.push({ ev }) - 1);
      const O = evs.map((ev) => nodes.push({ ev, repeat: true }) - 1);
      copies.push({ R, O });
    });
    // Antecesores: [nodo, penalización]
    nodes.forEach((n) => { n.preds = []; n.start = false; n.end = false; });
    copies.forEach((c, j) => {
      for (let k = 1; k < c.R.length; k++) nodes[c.R[k]].preds.push([c.R[k - 1], 0]);
      for (let k = 1; k < c.O.length; k++) nodes[c.O[k]].preds.push([c.O[k - 1], 0]);
      nodes[c.O[0]].preds.push([c.R[c.R.length - 1], 1.0]); // repetir la sección
      const first = nodes[c.R[0]];
      if (j === 0) first.start = true;
      else {
        const p = copies[j - 1];
        first.preds.push([p.R[p.R.length - 1], 0], [p.O[p.O.length - 1], 0]);
        if (j >= 2) { const pp = copies[j - 2]; first.preds.push([pp.R[pp.R.length - 1], 3.0], [pp.O[pp.O.length - 1], 3.0]); }
        else first.start = true; // se puede saltar la primera sección
      }
    });
    const last = copies[copies.length - 1];
    nodes[last.R[last.R.length - 1]].end = true;
    nodes[last.O[last.O.length - 1]].end = true;
    if (copies.length >= 2) { const pl = copies[copies.length - 2]; nodes[pl.R[pl.R.length - 1]].end = 3.0; nodes[pl.O[pl.O.length - 1]].end = 3.0; }
    return nodes;
  }

  function runDP(chroma, plan, shift, scale, beatsPerStep) {
    const N = chroma.length, E = plan.length;
    const FREE = 0.55, LAMBDA = 0.6;
    // Costo por pulso y acorde (sumas acumuladas)
    const tpl = plan.map((e) => template(e.chord, shift));
    const pre = tpl.map((t) => {
      const p = new Float32Array(N + 1);
      for (let i = 0; i < N; i++) p[i + 1] = p[i] + (!t || chroma[i].quiet ? 0.5 : 1 - Math.max(0, dot(chroma[i].v, t)));
      return p;
    });
    const nodes = buildNodes(plan);
    const M = nodes.length;
    const D = new Float32Array(M * N).fill(Infinity);
    const BK = new Int32Array(M * N).fill(-1);   // pulso de inicio
    const BP = new Int32Array(M * N).fill(-2);   // nodo anterior (-1 = inicio libre)
    for (let n = 0; n < M; n++) {
      const node = nodes[n];
      const d = Math.max(0.5, plan[node.ev].steps * beatsPerStep * scale);
      const kmin = Math.max(1, Math.floor(d * 0.4)), kmax = Math.max(kmin, Math.ceil(d * 2.5) + 1);
      const p = pre[node.ev];
      for (let i = 0; i < N; i++) {
        let best = Infinity, bk = -1, bp = -2;
        for (let k = kmin; k <= kmax && i - k + 1 >= 0; k++) {
          const s = i - k + 1;
          const seg = p[i + 1] - p[s] + LAMBDA * Math.pow(Math.log2(k / d), 2);
          if (node.start) { const v = s * FREE + seg; if (v < best) { best = v; bk = s; bp = -1; } }
          if (s > 0) {
            for (const [q, pen] of node.preds) {
              const v = D[q * N + s - 1] + pen + seg;
              if (v < best) { best = v; bk = s; bp = q; }
            }
          }
        }
        D[n * N + i] = best; BK[n * N + i] = bk; BP[n * N + i] = bp;
      }
    }
    let bestEnd = Infinity, en = -1, ei = -1;
    nodes.forEach((node, n) => {
      if (!node.end) return;
      const extra = node.end === true ? 0 : node.end;
      for (let i = 0; i < N; i++) { const v = D[n * N + i] + extra + (N - 1 - i) * FREE; if (v < bestEnd) { bestEnd = v; en = n; ei = i; } }
    });
    if (en < 0) return null;
    // Camino: nodo y pulso de inicio
    const path = [];
    let n = en, i = ei;
    while (n >= 0 && i >= 0) {
      const s = BK[n * N + i];
      path.push({ ev: nodes[n].ev, start: s, end: i });
      const q = BP[n * N + i];
      if (q < 0) break;
      n = q; i = s - 1;
    }
    path.reverse();
    let matched = 0, cost = 0;
    path.forEach((p) => { cost += pre[p.ev][p.end + 1] - pre[p.ev][p.start]; matched += p.end - p.start + 1; });
    return { path, cost: bestEnd / N, fit: matched ? 1 - cost / matched : 0 };
  }

  /**
   * Acomoda la hoja a la grabación.
   * plan: App.practice.plan · beats: segundos de cada pulso · sub: subdivisiones por pulso
   */
  async function align({ samples, sr, beats, plan, sub, onProgress }) {
    if (!plan || plan.length < 2) throw new Error('La canción necesita acordes en la hoja para acomodarse sola.');
    if (!beats || beats.length < 16) throw new Error('La grabación es muy corta para acomodar la letra.');
    const chroma = await chromaPerBeat(samples, sr, beats, (p) => onProgress && onProgress(0.1 + 0.6 * p));
    const shifts = detectShift(chroma, plan).slice(0, 2);
    let best = null;
    for (const sh of shifts) {
      for (const scale of [1, 0.5, 2]) {
        await yieldUI();
        const r = runDP(chroma, plan, sh.s, scale, 1 / sub);
        if (r && (!best || r.cost < best.cost)) best = Object.assign(r, { shift: sh.s });
      }
      if (onProgress) onProgress(0.75 + 0.1 * shifts.indexOf(sh));
    }
    if (!best) throw new Error('No se pudo acomodar la letra con esta grabación.');
    // Una marca por cada línea
    const marks = [];
    best.path.forEach((p, k) => {
      const e = plan[p.ev];
      if (k === 0 || e.lineStart) marks.push({ ci: e.ci, t: Math.round(beats[p.start] * 100) / 100 });
    });
    if (onProgress) onProgress(1);
    return {
      marks,
      shift: best.shift,
      fit: best.fit,
      confidence: best.fit > 0.6 ? 'alta' : best.fit > 0.48 ? 'media' : 'baja'
    };
  }

  // ---------------------------------------------------------------------
  // Captura de audio (micrófono o sonido de la pestaña) a 11 025 Hz
  // ---------------------------------------------------------------------
  async function capture({ mode = 'mic', onLevel } = {}) {
    const ctx = App.practice.audio();
    let stream;
    if (mode === 'tab') {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, preferCurrentTab: true, selfBrowserSurface: 'include', systemAudio: 'include' });
      stream.getVideoTracks().forEach((t) => t.stop());
      if (!stream.getAudioTracks().length) { stream.getTracks().forEach((t) => t.stop()); throw new Error('Activa "Compartir audio de la pestaña" para que la app pueda escuchar el video.'); }
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    }
    const SR = 11025;
    const ratio = ctx.sampleRate / SR;
    const src = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    const chunks = [];
    let total = 0, pos = 0, firstAt = null, stopped = false;
    proc.onaudioprocess = (e) => {
      if (stopped) return;
      const d = e.inputBuffer.getChannelData(0);
      if (firstAt == null) firstAt = { ctx: ctx.currentTime, len: d.length / ctx.sampleRate };
      const out = new Float32Array(Math.ceil(d.length / ratio) + 1);
      let o = 0, lvl = 0;
      for (; pos < d.length; pos += ratio) {
        const i = Math.floor(pos), f = pos - i;
        const v = (d[i] || 0) * (1 - f) + (d[i + 1] || 0) * f;
        out[o++] = v; lvl += v * v;
      }
      pos -= d.length;
      chunks.push(out.subarray(0, o));
      total += o;
      if (onLevel) onLevel(Math.min(1, Math.sqrt(lvl / (o || 1)) * 5), total / SR);
    };
    src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
    return {
      startedAt: () => firstAt,
      seconds: () => total / SR,
      stop() {
        stopped = true;
        try { proc.disconnect(); src.disconnect(); mute.disconnect(); } catch (e) { /* nada */ }
        stream.getTracks().forEach((t) => t.stop());
        const all = new Float32Array(total);
        let o = 0;
        chunks.forEach((c) => { all.set(c, o); o += c.length; });
        return { samples: all, sr: SR };
      }
    };
  }

  const canCaptureTab = () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && !App.pwa.isIOS() && !/Android/i.test(navigator.userAgent);

  App.align = { align, chromaPerBeat, detectShift, capture, canCaptureTab };
})();
