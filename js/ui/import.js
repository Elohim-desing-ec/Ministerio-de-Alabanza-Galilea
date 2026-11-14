/* =========================================================================
   SELAH · Importar canciones desde PDF (LaCuerda.net u otros) o texto
   Usa PDF.js (se descarga solo la primera vez que se importa).
   Reconstruye cada línea con la posición real de cada letra, así los
   acordes caen sobre la sílaba correcta aunque la letra no sea monoespaciada.
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc, C = App.chords;
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  let pdfjsPromise = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfjsPromise) {
      pdfjsPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = PDFJS;
        s.onload = () => {
          try {
            const blob = new Blob([`importScripts('${WORKER}');`], { type: 'application/javascript' });
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
          } catch (e) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER;
          }
          resolve(window.pdfjsLib);
        };
        s.onerror = () => { pdfjsPromise = null; reject(new Error('No se pudo cargar el lector de PDF. Revisa tu conexión a internet.')); };
        document.head.appendChild(s);
      });
    }
    return pdfjsPromise;
  }

  // ---------------------------------------------------------------------
  // PDF → líneas con la posición de cada carácter
  // ---------------------------------------------------------------------
  async function pdfToLines(file) {
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const out = [];
    let textChars = 0;

    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const items = tc.items.filter((it) => typeof it.str === 'string' && it.str.length).map((it) => ({
        s: it.str,
        x: it.transform[4],
        y: it.transform[5],
        h: Math.hypot(it.transform[2], it.transform[3]) || it.height || 10,
        w: it.width || 0
      }));
      textChars += items.reduce((n, it) => n + it.s.trim().length, 0);
      if (!items.length) continue;

      // Ancho de un carácter (mediana)
      const widths = items.filter((it) => it.s.trim().length >= 2 && it.w > 0).map((it) => it.w / it.s.length).sort((a, b) => a - b);
      const cw = widths.length ? widths[Math.floor(widths.length / 2)] : 6;

      // Agrupar por renglón
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const rows = [];
      items.forEach((it) => {
        const last = rows[rows.length - 1];
        if (last && Math.abs(last.y - it.y) <= Math.max(2, Math.min(last.h, it.h) * 0.45)) last.items.push(it);
        else rows.push({ y: it.y, h: it.h, items: [it] });
      });
      const minX = Math.min(...items.filter((it) => it.s.trim()).map((it) => it.x));
      const gaps = rows.slice(1).map((r, i) => rows[i].y - r.y).filter((g) => g > 0).sort((a, b) => a - b);
      const med = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 12;

      rows.forEach((row, i) => {
        if (i > 0 && rows[i - 1].y - row.y > med * 1.65) out.push({ text: '', chars: [], size: 0, gapBefore: 0 });
        row.items.sort((a, b) => a.x - b.x);
        const chars = [];
        let endX = minX;
        row.items.forEach((it) => {
          const gap = it.x - endX;
          const col = Math.round((it.x - minX) / cw);
          const lastIsSpace = chars.length && chars[chars.length - 1].c === ' ';
          if (col > chars.length) {
            // Rellena hasta la columna real (exacto en letra monoespaciada, como LaCuerda)
            for (let k = chars.length; k < col; k++) chars.push({ c: ' ', x: minX + k * cw });
          } else if (chars.length && gap > cw * 0.3 && !lastIsSpace && !/^\s/.test(it.s)) {
            chars.push({ c: ' ', x: endX });
          }
          const step = it.s.length ? it.w / it.s.length : cw;
          for (let k = 0; k < it.s.length; k++) chars.push({ c: it.s[k], x: it.x + k * step });
          endX = it.x + (it.w || it.s.length * cw);
        });
        const text = chars.map((c) => c.c).join('').replace(/\s+$/, '');
        out.push({ text, chars, size: Math.max(...row.items.map((it) => it.h)), gapBefore: i > 0 ? rows[i - 1].y - row.y : 0, med });
      });
      out.push({ text: '', chars: [], size: 0 });
    }
    return { lines: mergeByPosition(out), textChars };
  }

  /** Une línea de acordes + línea de letra usando la posición real (x) de cada letra. */
  function mergeByPosition(lines) {
    const res = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const next = lines[i + 1];
      if (C.isChordLine(l.text) && next && next.text.trim() && !C.isChordLine(next.text) && !C.sectionName(next.text) &&
          next.chars.length && (!next.gapBefore || !next.med || next.gapBefore < next.med * 1.6)) {
        const toks = C.chordTokens(l.text).filter((t) => t.chord).map((t) => ({ chord: t.chord, x: (l.chars[t.pos] || {}).x }));
        let text = next.text;
        const xs = next.chars.slice(0, text.length).map((c) => c.x);
        const inserts = toks.map((t) => {
          let idx = xs.findIndex((x) => x >= t.x - 1.5);
          if (idx < 0) idx = text.length + Math.max(0, Math.round((t.x - (xs[xs.length - 1] || 0)) / 6));
          return { idx, chord: t.chord };
        });
        for (let k = inserts.length - 1; k >= 0; k--) {
          const { idx, chord } = inserts[k];
          if (text.length < idx) text = text.padEnd(idx, ' ');
          text = text.slice(0, idx) + `[${chord}]` + text.slice(idx);
        }
        res.push({ text, size: next.size });
        i++;
        continue;
      }
      res.push({ text: l.text, size: l.size });
    }
    return res;
  }

  // ---------------------------------------------------------------------
  // Interfaz
  // ---------------------------------------------------------------------
  function draftCard(d, i) {
    const notation = App.store.state.prefs.notation;
    const v = d.versions[d.version || 0];
    const keys = C.KEYS.concat(C.MINOR_KEYS);
    const preview = C.render(v.chart, { key: d.key, mode: notation });
    return `
      <article class="imp-card ${d.include ? '' : 'is-off'}" data-i="${i}">
        <header class="imp-head">
          <label class="check"><input type="checkbox" data-f="include" ${d.include ? 'checked' : ''}> <span class="strong">Agregar</span></label>
          <span class="xsmall faint truncate">${esc(d.fileName || 'Texto pegado')}</span>
        </header>
        <div class="imp-fields">
          <div class="field"><label class="field-label" for="imp-t-${i}">Título</label><input class="input" id="imp-t-${i}" data-f="title" value="${esc(d.title)}"></div>
          <div class="field"><label class="field-label" for="imp-a-${i}">Artista</label><input class="input" id="imp-a-${i}" data-f="artist" value="${esc(d.artist)}"></div>
          <div class="field"><label class="field-label" for="imp-k-${i}">Tono</label><select class="select mono" id="imp-k-${i}" data-f="key">${keys.map((k) => `<option ${k === d.key ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
          <div class="field"><label class="field-label" for="imp-r-${i}">Ritmo</label><select class="select" id="imp-r-${i}" data-f="tempo">${App.config.tempos.map((t) => `<option value="${t.id}" ${t.id === d.tempo ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
          <div class="field"><label class="field-label" for="imp-b-${i}">BPM</label><input class="input mono" id="imp-b-${i}" type="number" min="0" max="240" placeholder="—" data-f="bpm" value="${d.bpm || ''}"></div>
          ${d.versions.length > 1 ? `<div class="field"><label class="field-label" for="imp-v-${i}">Versión</label><select class="select" id="imp-v-${i}" data-f="version">${d.versions.map((x, k) => `<option value="${k}" ${k === (d.version || 0) ? 'selected' : ''}>Versión ${k + 1} · ${x.chordLines} acordes</option>`).join('')}</select></div>` : ''}
        </div>
        ${d.warnings.length ? `<div class="notice notice--warn">${I('alert', 16)}<span>${d.warnings.map(esc).join(' ')}</span></div>` : ''}
        ${d.capo ? `<p class="xsmall muted">El PDF indica capo en el traste ${d.capo}; lo guardé en las notas.</p>` : ''}
        <details class="imp-preview">
          <summary>Ver cómo quedó la hoja (${U.plural(C.sectionNames(v.chart).length || 1, 'sección', 'secciones')} · ${v.chordLines} acordes)</summary>
          <div class="chart imp-chart">${preview || '<p class="small muted">Sin contenido.</p>'}</div>
        </details>
      </article>`;
  }

  function openImporter() {
    if (!M.isLeader()) { ui.toast('Solo el líder puede agregar canciones.', { kind: 'warn' }); return; }
    const drafts = [];

    const m = ui.modal({
      title: 'Importar canciones',
      size: 'lg',
      body: `
        <p class="small muted">Sube los PDF de <strong>LaCuerda.net</strong> (o de otra página de acordes). Leemos el título, el artista, el tono, la letra y los acordes; tú revisas y guardas.</p>
        <label class="dropzone" id="imp-drop" for="imp-files">
          ${I('arrow-up', 22)}
          <span class="strong">Arrastra aquí tus PDF o toca para elegirlos</span>
          <span class="xsmall faint">Puedes subir varios a la vez · PDF o .txt</span>
          <input type="file" id="imp-files" accept=".pdf,.txt,application/pdf,text/plain" multiple hidden>
        </label>
        <details class="imp-paste">
          <summary>O pega el texto de la canción</summary>
          <div class="stack-sm">
            <label class="sr-only" for="imp-text">Texto de la canción</label>
            <textarea class="textarea textarea--code" id="imp-text" rows="8" placeholder="Copia la canción desde LaCuerda.net (con los acordes encima de la letra) y pégala aquí"></textarea>
            <div><button class="btn btn--ghost btn--sm" type="button" data-act="read-text">${I('refresh', 14)} Leer texto</button></div>
          </div>
        </details>
        <div class="stack" id="imp-results"></div>`,
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        { label: 'Guardar canciones', kind: 'primary', icon: 'check', onClick: save }
      ]
    });

    const results = m.body.querySelector('#imp-results');
    const saveBtn = m.foot.querySelector('.btn--primary');
    const refreshSave = () => {
      const n = drafts.filter((d) => d.include).length;
      saveBtn.disabled = !n;
      saveBtn.lastChild.textContent = n ? `Guardar ${U.plural(n, 'canción', 'canciones')}` : 'Guardar canciones';
    };
    refreshSave();

    const draw = () => { results.innerHTML = drafts.map(draftCard).join(''); refreshSave(); };

    function addDraft(parsed, fileName) {
      drafts.push(Object.assign({ fileName, include: true, tempo: 'media', bpm: 0, version: 0 }, parsed));
    }

    async function handleFiles(files) {
      for (const file of Array.from(files)) {
        const row = document.createElement('div');
        row.className = 'imp-loading';
        row.innerHTML = `<span class="typing"><span></span><span></span><span></span></span><span class="small">Leyendo ${esc(file.name)}…</span>`;
        results.appendChild(row);
        try {
          if (/\.txt$/i.test(file.name) || file.type === 'text/plain') {
            addDraft(App.importer.parse(await file.text(), { fileName: file.name }), file.name);
          } else {
            const { lines, textChars } = await pdfToLines(file);
            if (textChars < 20) throw new Error('Este PDF parece una foto o un escaneo: no tiene texto que se pueda leer. Descárgalo de nuevo desde LaCuerda.net o pega el texto.');
            addDraft(App.importer.parse(lines, { fileName: file.name }), file.name);
          }
        } catch (err) {
          console.error(err);
          ui.toast(`${file.name}: ${err.message}`, { kind: 'warn', timeout: 6000 });
        }
        row.remove();
      }
      draw();
    }

    const drop = m.body.querySelector('#imp-drop');
    m.body.querySelector('#imp-files').addEventListener('change', (e) => { handleFiles(e.target.files); e.target.value = ''; });
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });

    m.body.addEventListener('click', (e) => {
      if (!e.target.closest('[data-act="read-text"]')) return;
      const ta = m.body.querySelector('#imp-text');
      if (!ta.value.trim()) { ta.focus(); return; }
      addDraft(App.importer.parse(ta.value), '');
      ta.value = '';
      draw();
    });

    const update = (e) => {
      const card = e.target.closest('[data-i]');
      const f = e.target.dataset.f;
      if (!card || !f) return;
      const d = drafts[Number(card.dataset.i)];
      if (f === 'include') { d.include = e.target.checked; card.classList.toggle('is-off', !d.include); refreshSave(); return; }
      if (f === 'version') { d.version = Number(e.target.value); d.key = d.versions[d.version].key || d.key; draw(); return; }
      if (f === 'bpm') d.bpm = Number(e.target.value) || 0;
      else d[f] = e.target.value;
      if (f === 'key') draw();
    };
    results.addEventListener('input', update);
    results.addEventListener('change', update);

    function save() {
      const chosen = drafts.filter((d) => d.include);
      if (!chosen.length) return false;
      let last = null;
      chosen.forEach((d) => {
        const v = d.versions[d.version || 0];
        last = App.actions.saveSong({
          title: d.title.trim() || 'Canción sin título',
          artist: d.artist.trim(),
          key: d.key,
          bpm: d.bpm || 0,
          time: '4/4',
          tempo: d.tempo,
          duration: 300,
          tags: [],
          arrangement: [],
          notes: d.capo ? `Capo en el traste ${d.capo} (según el PDF).` : '',
          chart: v.chart,
          source: d.fileName ? 'pdf' : 'texto'
        });
      });
      ui.toast(`${U.plural(chosen.length, 'canción agregada', 'canciones agregadas')} al repertorio.`);
      if (chosen.length === 1 && last) App.router.go('cancion', last.id);
    }
  }

  App.importer.open = openImporter;
  App.importer.pdfToLines = pdfToLines;
})();
