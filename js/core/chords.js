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
  const SECTION_WORDS = /^\s*[[(]?\s*((?:intro|introducci[oó]n|verso|verse|estrofa|coro|chorus|estribillo|pre-?\s?coro|pre-?chorus|puente|bridge|interludio|instrumental|solo|final|outro|tag|vamp)(?:\s*\d+)?)\s*[\])]?\s*[:.]?\s*(?:\(?\s*x\s?\d+\s*\)?)?\s*$/i;
  // Acorde "estricto" para reconocer líneas de acordes sin confundir palabras (DE, ADORAR…)
  const SUFFIX = '(?:maj|min|m|M|dim|aug|sus|add|º|°|ø|\\+|[0-9]|[#b](?=[0-9])|\\((?:[#b]?[0-9]+|add[0-9]+|sus[0-9]?)\\))*';
  const STRICT_CHORD = new RegExp(`^([A-G])([#b]?)(${SUFFIX})(?:\\/([A-G])([#b]?))?$`);
  const LATIN_CHORD = new RegExp(`^(Do|Re|Mi|Fa|Sol|La|Si)([#b]?)(${SUFFIX})(?:\\/(Do|Re|Mi|Fa|Sol|La|Si)([#b]?))?$`);

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
  /** Secciones en el orden en que se tocan (según el arreglo, si hay). */
  function orderedSections(text, arrangement) {
    const sections = parseChart(text);
    const byName = new Map();
    sections.forEach((s) => { if (s.name && !byName.has(norm(s.name))) byName.set(norm(s.name), s); });
    if (arrangement && arrangement.length) {
      const mapped = arrangement.map((name) => byName.get(norm(name))).filter(Boolean);
      // Las secciones sin nombre (antes del primer título) se mantienen al inicio
      if (mapped.length) return sections.filter((s) => !s.name).concat(mapped);
    }
    return sections;
  }

  /**
   * Devuelve el HTML de la hoja de acordes.
   * opts: n (semitonos), capo, key (original), mode, showChords, arrangement
   * Cada acorde lleva data-ci (su número en el orden en que se toca) para
   * que el modo ensayo pueda resaltarlo mientras suena.
   */
  function render(text, { n = 0, capo = 0, key = null, mode = 'letras', arrangement = null } = {}) {
    const esc = App.utils.esc;
    const order = orderedSections(text, arrangement);
    const shift = n - capo;
    const fmt = (c) => esc(formatChord(c, { n: shift, key: key ? transposeKey(key, 0) : null, mode }));
    const seenCount = {};
    let ci = 0;
    const cc = (chord) => `<span class="cc" data-ci="${ci++}">${fmt(chord)}</span>`;

    return order.map((sec) => {
      const nk = norm(sec.name);
      seenCount[nk] = (seenCount[nk] || 0) + 1;
      const rep = seenCount[nk] > 1 ? ` <span class="rep">×${seenCount[nk]}</span>` : '';
      const head = sec.name ? `<h4 class="chart-sec-name">${esc(sec.name)}${rep}</h4>` : '';
      const lines = sec.lines.map((l) => {
        if (l.type === 'blank') return '<div class="cl cl--blank"></div>';
        if (l.type === 'text') return `<div class="cl cl--text">${esc(l.text)}</div>`;
        if (l.type === 'chords') return `<div class="cl cl--chords">${l.segs.filter((s) => s.chord).map((s) => cc(s.chord)).join('')}</div>`;
        return `<div class="cl">${l.segs.map((s) => `<span class="cs">${s.chord ? cc(s.chord) : '<span class="cc"></span>'}<span class="cy">${esc(s.text)}</span></span>`).join('')}</div>`;
      }).join('');
      return `<section class="chart-sec" data-sec="${esc(sec.name)}">${head}${lines}</section>`;
    }).join('');
  }

  /**
   * Acordes en el orden en que se tocan, con el mismo número (ci) que render().
   * Cada elemento: { ci, chord, section, sectionStart, lineStart, perLine }
   */
  function timeline(text, { arrangement = null } = {}) {
    const out = [];
    let ci = 0;
    orderedSections(text, arrangement).forEach((sec) => {
      let first = true;
      sec.lines.forEach((l) => {
        if (!l.segs) return;
        const chords = l.segs.filter((sg) => sg.chord).map((sg) => sg.chord);
        chords.forEach((chord, k) => {
          out.push({ ci: ci++, chord, section: sec.name || '', sectionStart: first, lineStart: k === 0, perLine: chords.length });
          first = false;
        });
      });
    });
    return out;
  }

  /**
   * Notas de un acorde: { root, bass, intervals } (clases de altura 0-11).
   * n = semitonos a transponer.
   */
  function chordTones(ch, n = 0) {
    const p = parseChord(ch);
    if (!p) return null;
    const sfx = p.suffix.replace(/[()]/g, '');
    const low = sfx.toLowerCase();
    const minor = /^m(?!aj)/.test(sfx) || /^min/.test(low) || /^-/.test(sfx);
    let iv;
    if (/dim|°|º/.test(low) && !/ø|m7b5/.test(low)) iv = [0, 3, 6];
    else if (/ø|m7b5/.test(low)) iv = [0, 3, 6, 10];
    else if (/aug|\+/.test(low)) iv = [0, 4, 8];
    else if (/sus2/.test(low)) iv = [0, 2, 7];
    else if (/sus/.test(low)) iv = [0, 5, 7];
    else if (/^5$/.test(sfx)) iv = [0, 7];
    else iv = [0, minor ? 3 : 4, 7];
    const rest = sfx.replace(/^(m(?!aj)|min|-)/, '');
    if (/maj7|ma7|M7|7M|Δ/.test(rest)) iv.push(11);
    else if (/(^|[^d])(7|9|11|13)/.test(rest) && !/add/.test(rest) && !/dim7|°7/.test(low)) iv.push(10);
    if (/dim7|°7/.test(low)) iv.push(9);
    if (/(^|[^1])6/.test(rest) && !/b6/.test(rest)) iv.push(9);
    if (/9|add2|(^|[^1])2/.test(rest) && !/sus2/.test(low)) iv.push(14);
    const uniq = Array.from(new Set(iv));
    return { root: mod(p.root + n), bass: p.bass != null ? mod(p.bass + n) : mod(p.root + n), intervals: uniq, minor };
  }

  // ---- Convertir "acordes arriba de la letra" → formato en línea ----
  const LATIN_TO_LETTER = { Do: 'C', Re: 'D', Mi: 'E', Fa: 'F', Sol: 'G', La: 'A', Si: 'B' };

  /** Devuelve el acorde en letras (C, Dm7…) o null si el texto no es un acorde. */
  function toChord(token) {
    let t = String(token).replace(/\/+$/, '');
    if (/^[([{].*[)\]}]$/.test(t)) t = t.slice(1, -1);
    t = t.replace(/^[([{]+/, '');
    if ((t.match(/\(/g) || []).length < (t.match(/\)/g) || []).length) t = t.replace(/[)\]}]+$/, '');
    if (!t) return null;
    if (STRICT_CHORD.test(t)) return t;
    const m = LATIN_CHORD.exec(t);
    if (m) return LATIN_TO_LETTER[m[1]] + m[2] + m[3] + (m[4] ? '/' + LATIN_TO_LETTER[m[4]] + (m[5] || '') : '');
    return null;
  }

  /** Marcas que pueden aparecer en una línea de acordes sin ser acordes. */
  const isFiller = (t) => /^(\/+|\|+|-+|%|x\d+|\(x\d+\)|\(?\d+x\)?|N\.?C\.?|\.+|:|,)$/i.test(t);

  /** Separa los tokens de una línea de acordes con su columna. "Am7-Gdim7/" → Am7 y Gdim7. */
  function chordTokens(line) {
    const out = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(line))) {
      let offset = 0;
      m[0].split(/-(?=[A-G]|Do|Re|Mi|Fa|Sol|La|Si)/).forEach((part) => {
        const chord = toChord(part);
        out.push({ pos: m.index + offset, text: part, chord });
        offset += part.length + 1;
      });
    }
    return out;
  }

  function isChordLine(line) {
    if (!line || !line.trim()) return false;
    const toks = chordTokens(line);
    const chords = toks.filter((t) => t.chord);
    return chords.length > 0 && toks.every((t) => t.chord || isFiller(t.text));
  }

  function sectionName(line) {
    const m = SECTION_WORDS.exec(line);
    if (!m) return null;
    const n = m[1].replace(/\s+/g, ' ').trim();
    return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
  }

  /** "Intro: G D Em C" → { name: 'Intro', chords: 'G D Em C' } */
  function sectionWithChords(line) {
    const m = /^\s*[[(]?\s*(intro|introducci[oó]n|interludio|instrumental|final|outro|puente|solo|coro|estribillo)\s*[\])]?\s*[:.\-]\s*(.+)$/i.exec(line);
    if (!m || !isChordLine(m[2])) return null;
    return { name: m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(), chords: m[2] };
  }

  function fromChordsOverLyrics(text) {
    const lines = String(text || '').replace(/\r/g, '').replace(/\t/g, '    ').replace(/ /g, ' ').split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\s+$/, '');
      // Ya está en formato en línea o es una sección {Coro}
      if (/^\s*\{[^}]*\}\s*$/.test(line) || /\[[A-G][^\]]*\]/.test(line)) { out.push(line); continue; }
      const sec = sectionName(line);
      if (sec) { out.push(`{${sec}}`); continue; }
      const swc = sectionWithChords(line);
      if (swc) {
        out.push(`{${swc.name}}`);
        out.push(chordTokens(swc.chords).filter((t) => t.chord).map((t) => `[${t.chord}]`).join(' '));
        continue;
      }
      if (isChordLine(line)) {
        const chords = chordTokens(line).filter((t) => t.chord);
        const next = lines[i + 1] != null ? lines[i + 1].replace(/\s+$/, '') : null;
        if (next != null && next.trim() && !isChordLine(next) && !sectionName(next) && !sectionWithChords(next)) {
          let lyric = next.replace(/\t/g, '    ');
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
    // Máximo una línea en blanco seguida
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  App.chords = {
    KEYS: MAJOR_NAMES, MINOR_KEYS: MINOR_NAMES,
    parseKey, transposeKey, semitones, keysFor, readKey,
    parseChord, formatChord, formatKey,
    parseChart, sectionNames, progression, render, orderedSections, timeline, chordTones,
    isChordLine, fromChordsOverLyrics, toChord, sectionName, chordTokens
  };
})();
