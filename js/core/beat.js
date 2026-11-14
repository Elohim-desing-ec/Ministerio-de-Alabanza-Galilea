/* =========================================================================
   SELAH · Detector de ritmo
   Encuentra el tempo (BPM) y cada pulso de una grabación, para que el
   metrónomo y la letra vayan con la música. Todo se calcula en el
   navegador; no se envía audio a ningún servidor.

   Cómo funciona:
   1. Energía por bandas (graves = bombo, agudos = platillos/caja).
   2. "Ataques": dónde sube la energía de golpe.
   3. Tempo: autocorrelación de los ataques (qué separación se repite más).
   4. Pulsos: programación dinámica (Ellis, 2007), que sigue a la banda
      aunque acelere o frene un poco.
   5. El "1" del compás: el pulso con más bombo.
   ========================================================================= */
(function () {
  const yieldUI = () => new Promise((r) => setTimeout(r, 0));

  /** Energía por cuadro (~11,6 ms) en tres bandas. */
  async function envelopes(chans, sr, onProgress) {
    const hop = Math.max(64, Math.round(sr / 86));
    const fps = sr / hop;
    const frames = Math.floor(chans[0].length / hop);
    const eFull = new Float32Array(frames), eLow = new Float32Array(frames), eHigh = new Float32Array(frames);
    const aL = Math.exp(-2 * Math.PI * 160 / sr), aH = Math.exp(-2 * Math.PI * 1800 / sr);
    const nc = chans.length;
    let l1 = 0, l2 = 0, h = 0;
    for (let f = 0; f < frames; f++) {
      let sf = 0, sl = 0, sh = 0;
      const base = f * hop;
      for (let k = 0; k < hop; k++) {
        const i = base + k;
        let x = 0;
        for (let c = 0; c < nc; c++) x += chans[c][i];
        x /= nc;
        l1 += (1 - aL) * (x - l1);
        l2 += (1 - aL) * (l1 - l2);
        h += (1 - aH) * (x - h);
        const hx = x - h;
        sf += x * x; sl += l2 * l2; sh += hx * hx;
      }
      eFull[f] = sf / hop; eLow[f] = sl / hop; eHigh[f] = sh / hop;
      if (f && (f & 2047) === 0) { if (onProgress) onProgress(0.1 + 0.6 * (f / frames)); await yieldUI(); }
    }
    return { eFull, eLow, eHigh, fps, hop };
  }

  function mean(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }

  function normalize(a) {
    const m = mean(a);
    let s = 0;
    for (let i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    const sd = Math.sqrt(s / (a.length || 1)) || 1;
    for (let i = 0; i < a.length; i++) a[i] /= sd;
    return a;
  }

  /** Subidas de energía (en escala logarítmica). */
  function flux(e) {
    const n = e.length, out = new Float32Array(n);
    const floor = mean(e) * 1e-3 + 1e-12;
    let prev = Math.log(floor + e[0]);
    for (let i = 1; i < n; i++) {
      const v = Math.log(floor + e[i]);
      const d = v - prev;
      out[i] = d > 0 ? d : 0;
      prev = v;
    }
    return normalize(out);
  }

  /** Quita la tendencia lenta y deja solo los ataques. */
  function detrend(a, w) {
    const n = a.length, out = new Float32Array(n);
    let s = 0;
    const half = Math.max(1, w >> 1);
    for (let i = 0; i < Math.min(n, half); i++) s += a[i];
    let cnt = Math.min(n, half);
    for (let i = 0; i < n; i++) {
      const add = i + half, rem = i - half - 1;
      if (add < n) { s += a[add]; cnt++; }
      if (rem >= 0) { s -= a[rem]; cnt--; }
      const v = a[i] - s / cnt;
      out[i] = v > 0 ? v : 0;
    }
    return out;
  }

  function smooth(a) {
    const n = a.length, out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = 0.25 * (a[i - 1] || 0) + 0.5 * a[i] + 0.25 * (a[i + 1] || 0);
    return out;
  }

  /** Tempo por autocorrelación, con preferencia suave por 70–140 BPM. */
  function tempo(on, fps, hint) {
    const n = on.length;
    const minL = Math.max(2, Math.floor(fps * 60 / 200));
    const maxL = Math.ceil(fps * 60 / 48);
    const top = Math.min(n - 1, maxL * 3 + 2);
    const ac = new Float32Array(top + 2);
    for (let L = minL - 1; L <= top; L++) {
      let s = 0;
      for (let i = 0; i + L < n; i++) s += on[i] * on[i + L];
      ac[L] = s / (n - L);
    }
    let best = -Infinity, bestL = minL;
    for (let L = minL; L <= maxL; L++) {
      const bpm = 60 * fps / L;
      const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 100) / 0.9, 2));
      const sc = (ac[L] + 0.5 * (ac[2 * L] || 0) + 0.25 * (ac[3 * L] || 0)) * w;
      if (sc > best) { best = sc; bestL = L; }
    }
    const y0 = ac[bestL - 1] || 0, y1 = ac[bestL], y2 = ac[bestL + 1] || 0;
    const den = y0 - 2 * y1 + y2;
    const d = den ? 0.5 * (y0 - y2) / den : 0;
    let bpm = 60 * fps / (bestL + (Math.abs(d) < 1 ? d : 0));
    // Si la canción ya tiene un BPM escrito, se corrige el doble o la mitad
    if (hint > 0) {
      const cands = [bpm, bpm / 2, bpm * 2, bpm * 1.5, bpm / 1.5];
      const pick = cands.reduce((a, c) => (Math.abs(Math.log2(c / hint)) < Math.abs(Math.log2(a / hint)) ? c : a), bpm);
      if (Math.abs(Math.log2(pick / hint)) < 0.1) bpm = pick;
    }
    let m = 0, cnt = 0;
    for (let L = minL; L <= maxL; L++) { m += ac[L]; cnt++; }
    return { bpm, period: 60 * fps / bpm, ratio: ac[Math.round(60 * fps / bpm)] / ((m / cnt) || 1) };
  }

  /** Pulsos con programación dinámica: fuertes y separados casi igual. */
  function track(on, period, tight = 100) {
    const n = on.length;
    const score = new Float32Array(n), back = new Int32Array(n);
    const lo = Math.max(1, Math.round(period * 0.5)), hi = Math.round(period * 2);
    const pen = new Float32Array(hi + 1);
    for (let d = lo; d <= hi; d++) pen[d] = -tight * Math.pow(Math.log(d / period), 2);
    for (let i = 0; i < n; i++) {
      let best = -Infinity, bj = -1;
      for (let j = Math.max(0, i - hi); j <= i - lo; j++) {
        const v = score[j] + pen[i - j];
        if (v > best) { best = v; bj = j; }
      }
      if (bj >= 0 && best > 0) { score[i] = on[i] + best; back[i] = bj; } else { score[i] = on[i]; back[i] = -1; }
    }
    let end = Math.max(0, n - hi), bestS = -Infinity;
    for (let i = Math.max(0, n - hi); i < n; i++) if (score[i] > bestS) { bestS = score[i]; end = i; }
    const out = [];
    for (let i = end; i >= 0; i = back[i]) out.push(i);
    return out.reverse();
  }

  async function analyzeChannels(chans, sr, { hint = 0, beatsPerBar = 4, onProgress } = {}) {
    if (onProgress) onProgress(0.05);
    const env = await envelopes(chans, sr, onProgress);
    if (env.eFull.length < env.fps * 4) throw new Error('El audio es muy corto. Usa al menos 5 segundos de música.');
    const low = flux(env.eLow), high = flux(env.eHigh), full = flux(env.eFull);
    const n = low.length;
    let on = new Float32Array(n);
    for (let i = 0; i < n; i++) on[i] = low[i] + 0.7 * high[i] + 0.5 * full[i];
    on = normalize(smooth(detrend(on, Math.round(env.fps * 0.5))));
    if (onProgress) onProgress(0.8);
    await yieldUI();

    const tp = tempo(on, env.fps, hint);
    let frames = track(on, tp.period);
    if (onProgress) onProgress(0.95);

    // Quitar pulsos en el silencio del principio y del final
    const sorted = Array.from(env.eFull).sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)] || 0;
    const loud = (f) => { let m = 0; for (let k = -3; k <= 3; k++) m = Math.max(m, env.eFull[f + k] || 0); return m > med * 0.03; };
    while (frames.length && !loud(frames[0])) frames.shift();
    while (frames.length && !loud(frames[frames.length - 1])) frames.pop();
    if (frames.length < 8) throw new Error('No encontramos un ritmo claro en este audio.');

    const beats = frames.map((f) => f / env.fps);
    const iv = beats.slice(1).map((t, i) => t - beats[i]).sort((a, b) => a - b);
    const medIv = iv[Math.floor(iv.length / 2)];
    const mid = iv.slice(Math.floor(iv.length * 0.1), Math.ceil(iv.length * 0.9));
    const ivMean = mean(mid);
    const cv = Math.sqrt(mean(mid.map((x) => (x - ivMean) * (x - ivMean)))) / (ivMean || 1);

    // El "1": el pulso del compás con más bombo
    const B = Math.max(1, beatsPerBar);
    let downbeat = 0, bestSum = -Infinity;
    for (let k = 0; k < Math.min(B, frames.length); k++) {
      let s = 0;
      for (let i = k; i < frames.length; i += B) { let m = 0; for (let d = -2; d <= 2; d++) m = Math.max(m, low[frames[i] + d] || 0); s += m; }
      if (s > bestSum) { bestSum = s; downbeat = k; }
    }

    // BPM: recta que mejor une los pulsos (más fino que la separación típica)
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    beats.forEach((t, i) => { sx += i; sy += t; sxx += i * i; sxy += i * t; });
    const nb = beats.length;
    const slope = (nb * sxy - sx * sy) / ((nb * sxx - sx * sx) || 1);
    const period = slope > 0 && Math.abs(slope - medIv) / medIv < 0.15 ? slope : medIv;

    if (onProgress) onProgress(1);
    return {
      bpm: 60 / period,
      beats,
      downbeat,
      confidence: cv < 0.035 && tp.ratio > 1.4 ? 'alta' : cv < 0.07 ? 'media' : 'baja',
      duration: chans[0].length / sr
    };
  }

  async function analyzeBuffer(buffer, opts) {
    const chans = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
    return analyzeChannels(chans, buffer.sampleRate, opts);
  }

  /** La mitad de los pulsos (si detectó el doble del tempo). */
  function halve(an) {
    const beats = [];
    let downbeat = 0;
    an.beats.forEach((t, i) => {
      if (((i - an.downbeat) % 2 + 2) % 2 !== 0) return;
      if (i === an.downbeat) downbeat = beats.length;
      beats.push(t);
    });
    return Object.assign({}, an, { beats, downbeat, bpm: an.bpm / 2 });
  }

  /** El doble de pulsos (si detectó la mitad del tempo). */
  function double(an) {
    const beats = [];
    an.beats.forEach((t, i) => {
      beats.push(t);
      if (i < an.beats.length - 1) beats.push((t + an.beats[i + 1]) / 2);
    });
    return Object.assign({}, an, { beats, downbeat: an.downbeat * 2, bpm: an.bpm * 2 });
  }

  App.beat = { analyzeBuffer, analyzeChannels, halve, double };
})();
