/* =========================================================================
   SELAH · Motor de acordes
   Formato de canciones (compatible con ChordPro básico):
     {Verso 1}                  → inicio de sección
     [G]Cantaré a[D]l Señor     → acorde antes de la sílaba
     [G] [D] [Em] [C]           → línea solo de acordes (intro, interludio)
   También convierte el formato clásico de "acordes arriba de la letra".
   ========================================================================= */
(function () {
  const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const MAJOR_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const MINOR_NAMES = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
  const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);
  const LATIN = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
  const LATIN_REV = { do: 'C', re: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B' };
  const DEGREES = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'];
  const CHORD_RE = /^([A-G])([#b]?)([^/\s]*?)(?:\/([A-G])([#b]?))?$/;
  const SECTION_WORDS = /^\s*[[(]?\s*((?:intro|verso|verse|estrofa|coro|chorus|estribillo|pre-?coro|pre-?chorus|puente|bridge|interludio|instrumental|final|outro|tag|vamp)(?:\s*\d+)?)\s*[\])]?\s*:?\s*$/i;

  const mod = (n) => ((n % 12) + 12) % 12;

  function noteIndex(letter, acc) {
    let i = SHARP.indexOf(letter);
    if (acc === '#') i++;
    if (acc === 'b') i--;
    return mod(i);
  }

  function parseKey(key) {
    const m = /^([A-G])([#b]?)(m?)$/.exec(String(key || '').trim());
    if (!m) return null;
    return { index: noteIndex(m[1], m[2]), minor: m[3] === 'm' };
  }

  const keyName = (index, minor) => (minor ? MINOR_NAMES : MAJOR_NAMES)[mod(index)];

  function transposeKey(key, n) {
    const k = parseKey(key);
    return k ? keyName(k.index + n, k.minor) : key;
  }

  /** Semitonos (entre -5 y +6) para ir de una tonalidad a otra. */
  function semitones(from, to) {
    const a = parseKey(from), b = parseKey(to);
    if (!a || !b) return 0;
    let d = mod(b.index - a.index);
    if (d > 6) d -= 12;
    return d;
  }

  function keysFor(key) {
    const k = parseKey(key);
    return (k && k.minor ? MINOR_NAMES : MAJOR_NAMES).slice();
  }

  function parseChord(ch) {
    const m = CHORD_RE.exec(String(ch).trim());
    if (!m) return null;
    return { root: noteIndex(m[1], m[2]), suffix: m[3] || '', bass: m[4] != null ? noteIndex(m[4], m[5] || '') : null };
  }

  const toLatin = (name) => (LATIN[name[0]] ? LATIN[name[0]] + name.slice(1) : name);

  /**
   * Formatea un acorde.
   * n = semitonos a mover · key = tonalidad original · mode = letras | latino | numeros
   */
  function formatChord(ch, { n = 0, key = null, mode = 'letras' } = {}) {
    const p = parseChord(ch);
    if (!p) return ch;
    const target = key ? transposeKey(key, n) : null;
    const flats = target ? FLAT_KEYS.has(target) : false;
    const r = p.root + n;
    const b = p.bass == null ? null : p.bass + n;
    if (mode === 'numeros' && target) {
      const k = parseKey(target);
      const deg = (i) => DEGREES[mod(i - k.index)];
      return deg(r) + p.suffix + (b != null ? '/' + deg(b) : '');
    }
    let root = (flats ? FLAT : SHARP)[mod(r)];
    let bass = b != null ? (flats ? FLAT : SHARP)[mod(b)] : null;
    if (mode === 'latino') { root = toLatin(root); if (bass) bass = toLatin(bass); }
    return root + p.suffix + (bass ? '/' + bass : '');
  }

  function formatKey(key, mode = 'letras') {
    if (!key) return '';
    return mode === 'latino' ? toLatin(key) : key;
  }

  /** Interpreta "D", "re", "Re#", "sol m", "F#m" → nombre de tonalidad en letras. */
  function readKey(text) {
    if (!text) return null;
    const t = String(text).trim();
    const lat = /^(do|re|mi|fa|sol|la|si)\s*(#|b|sostenido|bemol)?\s*(m|menor)?$/i.exec(t);
    if (lat) {
      const acc = /^(#|sostenido)$/i.test(lat[2] || '') ? '#' : /^(b|bemol)$/i.test(lat[2] || '') ? 'b' : '';
      const k = LATIN_REV[lat[1].toLowerCase()] + acc + (lat[3] ? 'm' : '');
      const p = parseKey(k);
      return p ? keyName(p.index, p.minor) : null;
    }
    const p = parseKey(t.replace(/\s+/g, ''));
    return p ? keyName(p.index, p.minor) : null;
  }

  // ---- Parseo de la hoja ----
  function parseChart(text) {
    const sections = [];
    let cur = null;
    const ensure = () => { if (!cur) { cur = { name: '', lines: [] }; sections.push(cur); } return cur; };

    String(text || '').replace(/\r/g, '').split('\n').forEach((raw) => {
      const line = raw.replace(/\s+$/, '');
      const dir = /^\s*\{\s*([^}]*)\}\s*$/.exec(line);
      if (dir) {
        let body = dir[1].trim();
        const kv = /^([a-z_]+)\s*:\s*(.*)$/i.exec(body);
        if (kv) {
          const k = kv[1].toLowerCase();
          if (['c', 'comment', 'section', 'soc', 'sov', 'sob', 'start_of_chorus', 'start_of_verse', 'start_of_bridge'].includes(k)) body = kv[2].trim();
          else return; // metadatos (title, key, tempo…) o cierres
        } else if (/^(eoc|eov|eob|end_of_\w+|soc|sov|sob)$/i.test(body)) {
          return;
        }
        if (!body) return;
        cur = { name: body, lines: [] };
        sections.push(cur);
        return;
      }
      const s = ensure();
      if (!line.trim()) { s.lines.push({ type: 'blank' }); return; }
      if (line.includes('[')) {
        const segs = [];
        const re = /\[([^\]]*)\]/g;
        let last = 0, m, chord = null;
        while ((m = re.exec(line))) {
          const t = line.slice(last, m.index);
          if (t || chord !== null) segs.push({ chord, text: t });
          chord = m[1].trim();
          last = re.lastIndex;
        }
        segs.push({ chord, text: line.slice(last) });
        const onlyChords = segs.every((sg) => !sg.text.trim());
        s.lines.push({ type: onlyChords ? 'chords' : 'lyric', segs });
        return;
      }
      s.lines.push({ type: 'text', text: line });
    });

    sections.forEach((sec) => {
      while (sec.lines.length && sec.lines[sec.lines.length - 1].type === 'blank') sec.lines.pop();
      while (sec.lines.length && sec.lines[0].type === 'blank') sec.lines.shift();
    });
    return sections.filter((sec) => sec.name || sec.lines.length);
  }

  const norm = (s) => App.utils.normalize(s);

  function sectionNames(text) {
    const seen = new Set();
    return parseChart(text).map((s) => s.name).filter((n) => n && !seen.has(norm(n)) && seen.add(norm(n)));
  }

  /** Secuencia de acordes de la primera sección con acordes (para vistas previas). */
  function progression(text, opts = {}) {
    const sec = parseChart(text).find((s) => s.lines.some((l) => l.segs && l.segs.some((sg) => sg.chord)));
    if (!sec) return [];
    const out = [];
    sec.lines.forEach((l) => (l.segs || []).forEach((sg) => { if (sg.chord) out.push(formatChord(sg.chord, opts)); }));
    return out;
  }

  /**
   * Devuelve el HTML de la hoja de acordes.
   * opts: n (semitonos), capo, key (original), mode, showChords, arrangement
   */
  function render(text, { n = 0, capo = 0, key = null, mode = 'letras', arrangement = null } = {}) {
    const esc = App.utils.esc;
    const sections = parseChart(text);
    const byName = new Map();
    sections.forEach((s) => { if (s.name && !byName.has(norm(s.name))) byName.set(norm(s.name), s); });

    let order = sections;
    if (arrangement && arrangement.length) {
      const mapped = arrangement.map((name) => byName.get(norm(name))).filter(Boolean);
      if (mapped.length) {
        // Las secciones sin nombre (antes del primer título) se mantienen al inicio
        order = sections.filter((s) => !s.name).concat(mapped);
      }
    }

    const shift = n - capo;
    const fmt = (c) => esc(formatChord(c, { n: shift, key: key ? transposeKey(key, 0) : null, mode }));
    const seenCount = {};

    return order.map((sec) => {
      const nk = norm(sec.name);
      seenCount[nk] = (seenCount[nk] || 0) + 1;
      const rep = seenCount[nk] > 1 ? ` <span class="rep">×${seenCount[nk]}</span>` : '';
      const head = sec.name ? `<h4 class="chart-sec-name">${esc(sec.name)}${rep}</h4>` : '';
      const lines = sec.lines.map((l) => {
        if (l.type === 'blank') return '<div class="cl cl--blank"></div>';
        if (l.type === 'text') return `<div class="cl cl--text">${esc(l.text)}</div>`;
        if (l.type === 'chords') return `<div class="cl cl--chords">${l.segs.filter((s) => s.chord).map((s) => `<span class="cc">${fmt(s.chord)}</span>`).join('')}</div>`;
        return `<div class="cl">${l.segs.map((s) => `<span class="cs"><span class="cc">${s.chord ? fmt(s.chord) : ''}</span><span class="cy">${esc(s.text)}</span></span>`).join('')}</div>`;
      }).join('');
      return `<section class="chart-sec" data-sec="${esc(sec.name)}">${head}${lines}</section>`;
    }).join('');
  }

  // ---- Convertir "acordes arriba de la letra" → formato en línea ----
  function isChordToken(t) {
    const clean = t.replace(/^[(|]+|[)|]+$/g, '');
    return !clean || CHORD_RE.test(clean) || /^(N\.?C\.?|x\d+|%|-+)$/i.test(clean);
  }
  function isChordLine(line) {
    const toks = line.trim().split(/\s+/);
    return !!line.trim() && toks.every(isChordToken) && toks.some((t) => CHORD_RE.test(t.replace(/[()|]/g, '')));
  }

  function fromChordsOverLyrics(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const sec = SECTION_WORDS.exec(line);
      if (sec) { out.push(`{${sec[1].charAt(0).toUpperCase()}${sec[1].slice(1)}}`); continue; }
      if (isChordLine(line)) {
        const next = lines[i + 1];
        const chords = [];
        const re = /\S+/g; let m;
        while ((m = re.exec(line))) {
          const c = m[0].replace(/[()|]/g, '');
          if (CHORD_RE.test(c)) chords.push({ pos: m.index, chord: c });
        }
        if (next != null && next.trim() && !isChordLine(next) && !SECTION_WORDS.test(next)) {
          let lyric = next;
          for (let k = chords.length - 1; k >= 0; k--) {
            const { pos, chord } = chords[k];
            if (lyric.length < pos) lyric = lyric.padEnd(pos, ' ');
            lyric = lyric.slice(0, pos) + `[${chord}]` + lyric.slice(pos);
          }
          out.push(lyric.replace(/\s+$/, ''));
          i++;
        } else {
          out.push(chords.map((c) => `[${c.chord}]`).join(' '));
        }
        continue;
      }
      out.push(line);
    }
    return out.join('\n');
  }

  App.chords = {
    KEYS: MAJOR_NAMES, MINOR_KEYS: MINOR_NAMES,
    parseKey, transposeKey, semitones, keysFor, readKey,
    parseChord, formatChord, formatKey,
    parseChart, sectionNames, progression, render,
    isChordLine, fromChordsOverLyrics
  };
})();
