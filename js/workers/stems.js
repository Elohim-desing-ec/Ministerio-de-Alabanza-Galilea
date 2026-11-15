/* =========================================================================
   SELAH · Separador de pistas (trabaja en segundo plano)
   Sin IA: procesamiento de sonido clásico sobre el espectrograma.
   - Batería: separación armónico/percusivo (filtros de mediana, Fitzgerald 2010).
   - Bajo: parte armónica de las frecuencias graves.
   - Voz: parte armónica de las frecuencias medias que suena en el centro
     del estéreo (donde se mezcla la voz principal).
   - Otros = original − voz − batería − bajo (lo calcula el reproductor).
   Las máscaras suman 1, así que todas las pistas juntas = la canción original.
   Entrada: { L, R, sr, stems: ['voz'] | ['voz','bateria','bajo'] }
   Salida: { stems: { voz: Float32Array, … } } (mono)
   ========================================================================= */
(function (root) {
  const N = 1024, HOP = 512, B = N / 2 + 1;

  function makeFFT(n) {
    const levels = Math.log2(n) | 0;
    const rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < levels; b++) r |= ((i >> b) & 1) << (levels - 1 - b); rev[i] = r; }
    const cos = new Float32Array(n / 2), sin = new Float32Array(n / 2);
    for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = Math.sin(2 * Math.PI * i / n); }
    /** FFT en el lugar (inverse = true para la inversa, sin escalar). */
    return function fft(re, im, inverse) {
      for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
      const sg = inverse ? 1 : -1;
      for (let size = 2; size <= n; size <<= 1) {
        const half = size >> 1, step = n / size;
        for (let i = 0; i < n; i += size) {
          for (let j = 0, k = 0; j < half; j++, k += step) {
            const a = i + j, b = a + half;
            const wr = cos[k], wi = sg * sin[k];
            const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
            re[b] = re[a] - tr; im[b] = im[a] - ti;
            re[a] += tr; im[a] += ti;
          }
        }
      }
    };
  }

  function median(arr, len, tmp) {
    for (let i = 0; i < len; i++) {
      const v = arr[i];
      let j = i - 1;
      while (j >= 0 && tmp[j] > v) { tmp[j + 1] = tmp[j]; j--; }
      tmp[j + 1] = v;
    }
    return tmp[len >> 1];
  }

  function separate({ L, R, sr, stems }, progress) {
    const n = L.length;
    const F = Math.ceil(n / HOP) + 1;
    const fft = makeFFT(N);
    const win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = Math.sqrt(0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); // raíz de Hann: análisis y síntesis
    const re = new Float32Array(N), im = new Float32Array(N);
    const reR = new Float32Array(N), imR = new Float32Array(N);

    const frameOf = (src, f, outRe, outIm) => {
      const start = f * HOP - N / 2;
      for (let i = 0; i < N; i++) { const s = src[start + i]; outRe[i] = (s === undefined ? 0 : s) * win[i]; outIm[i] = 0; }
      fft(outRe, outIm, false);
    };

    // 1) Magnitud (mono) de todo el audio
    const mag = new Float32Array(F * B);
    const mid = new Float32Array(n);
    for (let i = 0; i < n; i++) mid[i] = 0.5 * (L[i] + R[i]);
    for (let f = 0; f < F; f++) {
      frameOf(mid, f, re, im);
      const o = f * B;
      for (let k = 0; k < B; k++) mag[o + k] = Math.hypot(re[k], im[k]);
      if (f % 512 === 0) progress(0.05 + 0.2 * f / F);
    }

    // 2) Parte armónica: mediana en el tiempo (9 cuadros)
    const KT = 13, KF = 17, BETA = 2.2;
    const harm = new Float32Array(F * B);
    const col = new Float32Array(KT), tmp = new Float32Array(Math.max(KT, KF));
    for (let k = 0; k < B; k++) {
      for (let f = 0; f < F; f++) {
        for (let d = 0; d < KT; d++) { const ff = Math.min(F - 1, Math.max(0, f + d - (KT >> 1))); col[d] = mag[ff * B + k]; }
        harm[f * B + k] = median(col, KT, tmp);
      }
      if (k % 64 === 0) progress(0.25 + 0.2 * k / B);
    }

    // 3) Máscaras por cuadro y reconstrucción
    const want = new Set(stems);
    const out = {};
    stems.forEach((s) => { out[s] = new Float32Array(n); });
    const bufs = {};
    stems.forEach((s) => { bufs[s] = { re: new Float32Array(N), im: new Float32Array(N) }; });
    const rowv = new Float32Array(KF);
    const binHz = sr / N;
    const lowW = new Float32Array(B), bandW = new Float32Array(B);
    for (let k = 0; k < B; k++) {
      const f = k * binHz;
      lowW[k] = f <= 150 ? 1 : f >= 260 ? 0 : 1 - (f - 150) / 110;
      bandW[k] = f < 140 || f > 8000 ? 0 : f < 220 ? (f - 140) / 80 : f > 6000 ? 1 - (f - 6000) / 2000 : 1;
    }
    const mVoz = new Float32Array(B), mBat = new Float32Array(B), mBajo = new Float32Array(B);

    for (let f = 0; f < F; f++) {
      const o = f * B;
      frameOf(L, f, re, im);
      frameOf(R, f, reR, imR);
      for (let k = 0; k < B; k++) {
        for (let d = 0; d < KF; d++) { const kk = Math.min(B - 1, Math.max(0, k + d - (KF >> 1))); rowv[d] = mag[o + kk]; }
        const P = median(rowv, KF, tmp);
        const H = harm[o + k];
        const p2 = P * P, h2 = H * H;
        const hb = h2 * BETA * BETA;
        const drum = p2 + hb > 1e-20 ? p2 / (p2 + hb) : 0;
        const harmonic = 1 - drum;
        // ¿Suena en el centro del estéreo?
        const dr = re[k] - reR[k], di = im[k] - imR[k];
        const side = Math.hypot(dr, di);
        const sum = Math.hypot(re[k], im[k]) + Math.hypot(reR[k], imR[k]) + 1e-12;
        const c = side / sum;
        const center = Math.pow(Math.max(0, Math.min(1, 1 - c / 0.35)), 1.5);
        mBat[k] = drum;
        mBajo[k] = harmonic * lowW[k];
        mVoz[k] = harmonic * (1 - lowW[k]) * bandW[k] * center;
      }
      // Pistas (mono = mezcla al centro)
      for (const s of stems) {
        const m = s === 'voz' ? mVoz : s === 'bateria' ? mBat : mBajo;
        const br = bufs[s].re, bi = bufs[s].im;
        for (let k = 0; k < B; k++) {
          const g = m[k] * 0.5;
          br[k] = (re[k] + reR[k]) * g; bi[k] = (im[k] + imR[k]) * g;
        }
        for (let k = B; k < N; k++) { br[k] = br[N - k]; bi[k] = -bi[N - k]; }
        fft(br, bi, true);
        const start = f * HOP - N / 2, dst = out[s];
        for (let i = 0; i < N; i++) {
          const j = start + i;
          if (j >= 0 && j < n) dst[j] += br[i] * win[i] / N;
        }
      }
      if (f % 256 === 0) progress(0.45 + 0.55 * f / F);
    }
    progress(1);
    return out;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { separate };
  if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof window === 'undefined') {
    self.onmessage = (e) => {
      try {
        const out = separate(e.data, (p) => self.postMessage({ type: 'progress', p }));
        self.postMessage({ type: 'done', stems: out }, Object.values(out).map((a) => a.buffer));
      } catch (err) {
        self.postMessage({ type: 'error', message: String(err && err.message || err) });
      }
    };
  }
})(this);
