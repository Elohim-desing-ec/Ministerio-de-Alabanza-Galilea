/* =========================================================================
   SELAH · Importador de canciones (lógica, sin interfaz)
   Recibe las líneas de texto de un PDF (o texto pegado) de LaCuerda.net
   u otra página de acordes y devuelve una canción lista para guardar:
   título, artista, tono, capo y la hoja en formato Selah.
   - Quita menús, enlaces, listas de "otras canciones" y pies de página.
   - Si la página trae varias versiones, las separa para elegir una.
   ========================================================================= */
(function () {
  const C = App.chords;

  // Donde termina la canción en una página de LaCuerda (y similares)
  const STOP = /^(letra de |video de |videos? de |\[?ver m[aá]s|¡?colabora|env[ií]anos tu versi|otras canciones|canciones relacionadas|artistas sugeridos|©|extras$|añade lacuerda|a tus favoritos|populares|conexi[oó]n$|inscripci[oó]n$|acordes de guitarra$|afinador de guitarra|aprender a tocar|comentarios)/i;
  // Líneas de ruido que se descartan en cualquier parte
  const JUNK = /(lacuerda\.net|cuerda\.net|https?:\/\/|www\.|^\d{1,2}\/\d{1,2}\/\d{2,4}(,?\s+\d{1,2}:\d{2})?|^p[aá]gina\s+\d+|^\d+\s*(de|\/)\s*\d+$|^_?✓_?\s*mejor|^mejor$|^versi[oó]n$|^letras, acordes y tabs|^(canciones|acordes|afinador|favoritos|guitarra|piano|videos|bajo|ukulele)$|^[-•·]\s*$)/i;
  // Separador entre versiones de una misma canción
  const VERSION = /^[-•·\s]*(letra y acordes|letra y tablatura|tablatura|acordes)\s*$/i;

  const clean = (t) => String(t || '').replace(/ /g, ' ').replace(/\t/g, '    ').replace(/\s+$/, '');

  function sentenceCase(s) {
    s = String(s || '').trim();
    if (s && s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(s)) {
      s = s.toLowerCase();
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    return s;
  }

  const isChordish = (t) => C.isChordLine(t) || /\[[A-G][^\]]*\]/.test(t);
  /** Texto con espacios simples, para reconocer marcas aunque el PDF duplique espacios. */
  const flat = (t) => String(t || '').replace(/\s+/g, ' ').trim();

  /** Busca título, artista, tono y capo en el encabezado. */
  function readMeta(lines, fileName) {
    let title = null, artist = null, key = null, capo = null, m;
    // 1) Ruta de LaCuerda: "Acordes de Guitarra » M » Artista » Canción (Tab)" (la más fiable)
    for (const l of lines) {
      const t = flat(l.text);
      if (!t.includes('»')) continue;
      const parts = t.split('»').map((x) => x.trim()).filter(Boolean);
      if (parts.length >= 3) {
        title = parts[parts.length - 1].replace(/\s*\([a-z]*\)?\s*$/i, '').trim();
        artist = parts[parts.length - 2];
        break;
      }
    }
    for (const l of lines) {
      const t = flat(l.text);
      if (!t) continue;
      if (!title && (m = /^(.+?):\s*acordes\b/i.exec(t))) title = m[1];
      if (!title && (m = /^acordes de (.+?),\s*(.+?)(:|$)/i.exec(t))) { title = m[1]; artist = artist || m[2]; }
      if (!key && (m = /\b(tono|tonalidad|key)\s*[:=\-]?\s*(do|re|mi|fa|sol|la|si|[A-G])\s*(#|b)?\s*(m(?:enor)?)?\b/i.exec(t))) {
        key = C.readKey(`${m[2]}${m[3] || ''}${m[4] ? 'm' : ''}`);
      }
      if (capo == null && (m = /\bcapo(?:traste)?\s*[:=\-]?\s*(?:en\s+(?:el\s+)?)?(?:traste\s+)?(\d{1,2})/i.exec(t))) capo = Number(m[1]);
    }

    // Línea más grande del inicio (título del PDF)
    if (!title) {
      const head = lines.slice(0, 25).filter((l) => l.text.trim() && !JUNK.test(flat(l.text)) && !isChordish(l.text));
      const sized = head.filter((l) => l.size);
      if (sized.length) {
        const max = Math.max(...sized.map((l) => l.size));
        const big = sized.find((l) => l.size === max && l.size > Math.min(...sized.map((x) => x.size)) * 1.15);
        if (big) title = big.text.trim();
      }
    }
    // Texto pegado: primera línea corta que no sea acorde, menú ni dato técnico
    if (!title) {
      title = lines.slice(0, 6).map((l) => flat(l.text)).find((t) => t && t.length <= 70 && !JUNK.test(t) && !isChordish(t) &&
        !C.sectionName(t) && !/\b(tono|tonalidad|capo|key)\b/i.test(t)) || null;
    }
    if (!title && fileName) {
      title = fileName.replace(/\.(pdf|txt)$/i, '').replace(/[_]+/g, ' ').replace(/:.*$/, '').replace(/\s+-\s+lacuerda.*$/i, '').trim();
    }
    title = flat(title);
    if (title && !artist && (m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(title))) { title = m[1]; artist = m[2]; }

    // Encabezado tipo "Título      Artista" en la misma línea (solo si lo que sigue es corto)
    if (title && !artist) {
      const tl = title.toLowerCase();
      const h1 = lines.find((l) => {
        const t = flat(l.text);
        if (!t.toLowerCase().startsWith(tl)) return false;
        const rest = t.slice(tl.length).trim();
        return rest && rest.length <= 40 && !/[:]|acordes|letra|guitarra/i.test(rest) && /\S\s{2,}\S/.test(l.text.trim());
      });
      if (h1) artist = flat(h1.text).slice(tl.length).trim();
    }
    return { title: sentenceCase(title || 'Canción sin título'), artist: flat(artist), key, capo };
  }

  /** Corta una sección de líneas a la parte que de verdad es la canción. */
  function songBlock(lines) {
    const first = lines.findIndex((l) => isChordish(l.text) && !JUNK.test(flat(l.text)));
    if (first < 0) return null;
    let start = first;
    // Incluye un título de sección o una línea de letra justo arriba (p. ej. "Intro:")
    for (let k = 1; k <= 2 && first - k >= 0; k++) {
      const t = lines[first - k].text.trim();
      if (C.sectionName(t)) { start = first - k; break; }
      if (!t) break;
    }
    let end = lines.length;
    for (let i = first; i < lines.length; i++) {
      if (STOP.test(flat(lines[i].text))) { end = i; break; }
    }
    const block = lines.slice(start, end).filter((l) => !JUNK.test(flat(l.text)));
    while (block.length && !block[block.length - 1].text.trim()) block.pop();
    return block;
  }

  function guessKey(chart) {
    const m = /\[([A-G][#b]?)([^\]/]*)/.exec(chart);
    if (!m) return null;
    const minor = /^m(?!aj)/.test(m[2]);
    return C.readKey(m[1] + (minor ? 'm' : '')) || null;
  }

  /**
   * lines: [{ text, size? }] o texto plano.
   * Devuelve { title, artist, key, capo, versions: [{ chart, key, chordLines }], warnings }
   */
  function parse(input, { fileName = '' } = {}) {
    const lines = (Array.isArray(input) ? input : String(input || '').split('\n').map((t) => ({ text: t })))
      .map((l) => ({ text: clean(typeof l === 'string' ? l : l.text), size: l.size || 0 }));

    const meta = readMeta(lines, fileName);
    const warnings = [];

    // Separar versiones
    const groups = [[]];
    lines.forEach((l) => { if (VERSION.test(flat(l.text))) groups.push([]); else groups[groups.length - 1].push(l); });

    const versions = groups.map(songBlock).filter((b) => b && b.length).map((block) => {
      const chart = C.fromChordsOverLyrics(block.map((l) => l.text).join('\n'));
      const chordLines = (chart.match(/\[[A-G]/g) || []).length;
      return { chart, chordLines, key: meta.key || guessKey(chart) };
    });

    if (!versions.length) {
      const body = lines.filter((l) => !JUNK.test(flat(l.text))).map((l) => l.text).join('\n').trim();
      versions.push({ chart: C.fromChordsOverLyrics(body), chordLines: 0, key: meta.key });
      warnings.push('No encontramos acordes. Revisa el texto o pega la canción con los acordes encima de la letra.');
    }
    if (versions.length > 1) warnings.push(`La página trae ${versions.length} versiones de la canción. Elige cuál guardar.`);

    return Object.assign(meta, { key: versions[0].key || meta.key || 'C', versions, warnings });
  }

  App.importer = { parse, sentenceCase };
})();
