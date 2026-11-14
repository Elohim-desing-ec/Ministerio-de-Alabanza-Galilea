/* =========================================================================
   SELAH · Vista: Canción (hoja de acordes) + editor
   Transponer, capo, notación (C · Do · números), solo letra para
   cantantes, tamaño, dos columnas, arreglo editable y auto-scroll.
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc, C = App.chords;

  const vs = App.viewState.song = { keys: {}, capo: 0, chords: true, size: 17, cols: false, scrolling: false, speed: 1 };
  let raf = null;

  // ---------------------------------------------------------------------
  // Editor de canción
  // ---------------------------------------------------------------------
  App.forms.song = function songForm(existing) {
    const s = existing ? U.clone(existing) : { title: '', artist: '', key: 'G', bpm: 72, time: '4/4', tempo: 'media', duration: 300, tags: [], arrangement: [], notes: '', chart: '{Verso 1}\n[G]Escribe aquí la [D]letra con sus a[Em]cordes\n\n{Coro}\n[C]Los acordes van entre [G]corchetes [D]' };
    const allKeys = C.KEYS.concat(C.MINOR_KEYS);
    const m = ui.modal({
      title: existing ? 'Editar canción' : 'Nueva canción',
      size: 'xl',
      body: `
        <form class="song-editor" id="song-form" autocomplete="off">
          <div class="se-meta">
            <div class="field"><label class="field-label" for="sf-title">Título</label><input class="input" id="sf-title" name="title" required value="${esc(s.title)}"></div>
            <div class="field"><label class="field-label" for="sf-artist">Autor / versión</label><input class="input" id="sf-artist" name="artist" value="${esc(s.artist)}"></div>
            <div class="field-row">
              <div class="field"><label class="field-label" for="sf-key">Tono original</label><select class="select mono" id="sf-key" name="key">${allKeys.map((k) => `<option ${k === s.key ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
              <div class="field"><label class="field-label" for="sf-bpm">BPM</label><input class="input mono" type="number" min="0" max="240" id="sf-bpm" placeholder="—" name="bpm" value="${esc(s.bpm)}"></div>
              <div class="field"><label class="field-label" for="sf-time">Compás</label><select class="select" id="sf-time" name="time">${['4/4', '3/4', '6/8', '2/4', '12/8'].map((t) => `<option ${t === s.time ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
            </div>
            <div class="field-row">
              <div class="field"><label class="field-label" for="sf-tempo">Ritmo</label><select class="select" id="sf-tempo" name="tempo">${App.config.tempos.map((t) => `<option value="${t.id}" ${t.id === s.tempo ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
              <div class="field"><label class="field-label" for="sf-dur">Duración (min:seg)</label><input class="input mono" id="sf-dur" name="duration" pattern="\\d{1,2}:\\d{2}" value="${U.fmtDuration(s.duration)}"></div>
            </div>
            <div class="field"><label class="field-label" for="sf-tags">Temas (separados por coma)</label><input class="input" id="sf-tags" name="tags" list="sf-taglist" value="${esc((s.tags || []).join(', '))}"><datalist id="sf-taglist">${M.allTags().map((t) => `<option value="${esc(t)}">`).join('')}</datalist></div>
            <div class="field"><label class="field-label" for="sf-arr">Arreglo (orden de secciones, separado por coma)</label><input class="input" id="sf-arr" name="arrangement" value="${esc((s.arrangement || []).join(', '))}" placeholder="Verso 1, Coro, Verso 2, Coro, Puente, Coro"><span class="field-hint">Déjalo vacío para usar el orden en que están escritas.</span></div>
            <div class="field"><label class="field-label" for="sf-notes">Notas para la banda</label><textarea class="textarea" id="sf-notes" name="notes" rows="2">${esc(s.notes)}</textarea></div>
          </div>
          <div class="se-chart">
            <div class="row-between">
              <label class="field-label" for="sf-chart">Letra y acordes</label>
              <button type="button" class="btn btn--ghost btn--sm" data-act="convert" title="Convierte el formato con acordes en la línea de arriba">${I('refresh', 14)} Convertir acordes de arriba</button>
            </div>
            <textarea class="textarea textarea--code" id="sf-chart" name="chart" spellcheck="false">${esc(s.chart)}</textarea>
            <p class="field-hint"><span class="mono">{Coro}</span> inicia una sección · <span class="mono">[G]can</span><span class="mono">tar</span> pone el acorde sobre la sílaba · Pega una canción con acordes encima de la letra y pulsa “Convertir”.</p>
          </div>
          <div class="se-preview">
            <span class="field-label">Vista previa</span>
            <div class="chart se-preview-chart" id="sf-preview"></div>
          </div>
        </form>`,
      actions: [
        ...(existing ? [{ label: 'Eliminar', kind: 'danger', spacer: true, icon: 'trash', onClick: async () => {
          const ok = await ui.confirm({ title: 'Eliminar canción', message: `"${existing.title}" se quitará del repertorio y de todos los setlists.`, confirmLabel: 'Eliminar', danger: true });
          if (ok) { App.actions.deleteSong(existing.id); App.router.go('canciones'); ui.toast('Canción eliminada.'); return true; }
          return false;
        } }] : []),
        { label: 'Cancelar', kind: 'ghost' },
        {
          label: existing ? 'Guardar cambios' : 'Crear canción', kind: 'primary',
          onClick: (api) => {
            const f = api.body.querySelector('form');
            if (!f.reportValidity()) return false;
            const d = Object.fromEntries(new FormData(f).entries());
            const [mm, ss] = String(d.duration || '0:00').split(':').map(Number);
            const song = Object.assign(existing ? U.clone(existing) : {}, {
              title: d.title.trim(), artist: d.artist.trim(), key: d.key, bpm: Number(d.bpm) || 0, time: d.time, tempo: d.tempo,
              duration: (mm || 0) * 60 + (ss || 0),
              tags: d.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
              arrangement: d.arrangement.split(',').map((t) => t.trim()).filter(Boolean),
              notes: d.notes, chart: d.chart
            });
            const saved = App.actions.saveSong(song);
            ui.toast(existing ? 'Canción guardada.' : 'Canción agregada al repertorio.');
            if (!existing) App.router.go('cancion', saved.id);
          }
        }
      ]
    });

    const ta = m.body.querySelector('#sf-chart');
    const prev = m.body.querySelector('#sf-preview');
    const keySel = m.body.querySelector('#sf-key');
    const draw = () => { prev.innerHTML = C.render(ta.value, { key: keySel.value, mode: App.store.state.prefs.notation }) || '<p class="small muted">Escribe la letra para ver la vista previa.</p>'; };
    draw();
    ta.addEventListener('input', U.debounce(draw, 150));
    keySel.addEventListener('change', draw);
    m.body.querySelector('[data-act="convert"]').addEventListener('click', () => {
      const before = ta.value;
      ta.value = C.fromChordsOverLyrics(before);
      draw();
      ui.toast(before === ta.value ? 'No encontramos líneas de acordes para convertir.' : 'Formato convertido. Revisa que los acordes caigan en la sílaba correcta.', { kind: before === ta.value ? 'info' : 'ok' });
    });
  };

  // ---------------------------------------------------------------------
  // Auto-scroll en la página
  // ---------------------------------------------------------------------
  function stopScroll() { vs.scrolling = false; if (raf) cancelAnimationFrame(raf); raf = null; }
  function startScroll() {
    vs.scrolling = true;
    let acc = 0;
    const step = () => {
      if (!vs.scrolling || !document.querySelector('.view--song')) { stopScroll(); return; }
      acc += 0.22 * vs.speed;
      if (acc >= 1) { window.scrollBy(0, Math.floor(acc)); acc -= Math.floor(acc); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------------
  // Vista
  // ---------------------------------------------------------------------
  App.views.cancion = {
    title: 'Canción',
    onLeave: stopScroll,
    render(root, id) {
      const s = M.song(id);
      if (!s) {
        root.innerHTML = `<div class="view">${ui.empty({ icon: 'music', title: 'Esta canción ya no existe', action: '<a class="btn btn--primary" href="#canciones">Ir al repertorio</a>' })}</div>`;
        return;
      }
      const leader = M.isLeader();
      const notation = App.store.state.prefs.notation;
      const target = vs.keys[s.id] || s.key;
      const n = C.semitones(s.key, target);
      const keys = C.keysFor(s.key);
      const sections = C.sectionNames(s.chart);
      const arrangement = (s.arrangement && s.arrangement.length) ? s.arrangement : sections;
      const used = M.songEvents(s.id).slice(0, 5);
      const upcoming = M.upcoming({ days: 60 });

      root.innerHTML = `
        <div class="view view--song">
          <header class="view-head">
            <div class="titles">
              <a class="back-link" href="#canciones">${I('chevron-left', 16)} Canciones</a>
              <h1 class="view-title">${esc(s.title)}</h1>
              <p class="muted">${esc(s.artist || '')}</p>
              <div class="song-meta">
                <span class="meta-item"><span class="eyebrow">Original</span>${ui.keyBadge(s.key)}</span>
                <span class="meta-item"><span class="eyebrow">BPM</span><span class="mono strong">${s.bpm || '—'}</span></span>
                <span class="meta-item"><span class="eyebrow">Compás</span><span class="mono strong">${esc(s.time || '4/4')}</span></span>
                <span class="meta-item"><span class="eyebrow">Duración</span><span class="mono strong">${U.fmtDuration(s.duration)}</span></span>
                <span class="meta-item"><span class="eyebrow">Ritmo</span><span class="strong">${esc(M.tempoLabel(s.tempo))}</span></span>
              </div>
            </div>
            <div class="view-actions">
              <button class="btn btn--ghost" data-act="stage">${I('stage', 16)} Escenario</button>
              ${upcoming.length && leader ? `<button class="btn btn--ghost" data-act="add-to-event">${I('plus', 16)} A un evento</button>` : ''}
              ${leader ? `<button class="btn btn--primary" data-act="edit">${I('edit', 16)} Editar</button>` : ''}
            </div>
          </header>

          <div class="chart-toolbar" role="toolbar" aria-label="Opciones de la hoja">
            <div class="tb-group">
              <span class="tb-label">Tono</span>
              <button class="btn btn--ghost btn--icon btn--sm" data-act="down" aria-label="Bajar medio tono">${I('minus', 14)}</button>
              <label class="sr-only" for="song-key">Tonalidad</label>
              <select class="select select--sm mono tb-key" id="song-key">${keys.map((k) => `<option value="${k}" ${k === target ? 'selected' : ''}>${esc(C.formatKey(k, notation))}</option>`).join('')}</select>
              <button class="btn btn--ghost btn--icon btn--sm" data-act="up" aria-label="Subir medio tono">${I('plus', 14)}</button>
              ${n ? `<button class="btn btn--plain btn--sm" data-act="reset">Original</button>` : ''}
            </div>
            <div class="tb-group">
              <label class="tb-label" for="song-capo">Capo</label>
              <select class="select select--sm mono" id="song-capo">${[0, 1, 2, 3, 4, 5, 6, 7].map((c) => `<option value="${c}" ${c === vs.capo ? 'selected' : ''}>${c === 0 ? 'Sin capo' : c}</option>`).join('')}</select>
            </div>
            <div class="seg" role="group" aria-label="Notación">
              <button class="${notation === 'letras' ? 'is-on' : ''}" data-notation="letras" title="Americana">C D E</button>
              <button class="${notation === 'latino' ? 'is-on' : ''}" data-notation="latino" title="Latina">Do Re Mi</button>
              <button class="${notation === 'numeros' ? 'is-on' : ''}" data-notation="numeros" title="Números (Nashville)">1 2 3</button>
            </div>
            <div class="tb-group">
              <button class="btn btn--sm ${vs.chords ? 'btn--ghost' : 'btn--primary'}" data-act="chords">${vs.chords ? 'Solo letra' : 'Ver acordes'}</button>
              <button class="btn btn--ghost btn--icon btn--sm" data-act="smaller" aria-label="Letra más pequeña">A−</button>
              <button class="btn btn--ghost btn--icon btn--sm" data-act="bigger" aria-label="Letra más grande">A+</button>
              <button class="btn btn--icon btn--sm ${vs.cols ? 'btn--primary' : 'btn--ghost'}" data-act="cols" aria-label="Dos columnas">${I('columns', 15)}</button>
              <button class="btn btn--sm ${vs.scrolling ? 'btn--primary' : 'btn--ghost'}" data-act="scroll">${I(vs.scrolling ? 'pause' : 'play', 13)} Auto-scroll${vs.scrolling ? ` <span class="mono">${vs.speed}×</span>` : ''}</button>
            </div>
          </div>

          ${vs.capo ? `<div class="notice">${I('guitar', 16)}<span>Capo en el traste ${vs.capo}: toca las formas de <strong class="mono">${esc(C.formatKey(C.transposeKey(target, -vs.capo), notation))}</strong> y suena en <strong class="mono">${esc(C.formatKey(target, notation))}</strong>.</span></div>` : ''}

          <div class="song-layout">
            <article class="sheet">
              <div class="arr-strip">
                <span class="eyebrow">Arreglo</span>
                <div class="arr-chips" id="arr-chips">
                  ${arrangement.map((name, i) => `<span class="arr-chip" data-sec="${esc(name)}">${esc(name)}${leader ? `<button class="arr-x" data-arr-remove="${i}" aria-label="Quitar ${esc(name)}">${I('x', 11)}</button>` : ''}</span>`).join('<span class="arr-sep">›</span>')}
                </div>
                ${leader && sections.length ? `<label class="sr-only" for="arr-add">Agregar sección</label><select class="select select--sm arr-add" id="arr-add"><option value="">+ Sección</option>${sections.map((x) => `<option>${esc(x)}</option>`).join('')}</select>` : ''}
              </div>
              <div class="chart ${vs.chords ? '' : 'chart--lyrics'} ${vs.cols ? 'chart--cols' : ''}" style="--chart-size:${vs.size}px" id="song-chart">
                ${C.render(s.chart, { n, capo: vs.capo, key: s.key, mode: notation, arrangement })}
              </div>
            </article>

            <aside class="stack song-side">
              ${s.notes ? `<section class="panel"><h2 class="panel-title">${I('bell', 16)} Notas</h2><p class="small" style="white-space:pre-wrap">${esc(s.notes)}</p></section>` : ''}
              <section class="panel">
                <h2 class="panel-title">${I('calendar', 16)} Usada en</h2>
                ${used.length ? `<div class="stack-sm">${used.map((e) => {
                  const it = e.setlist.find((x) => x.songId === s.id);
                  return `<a class="used-row" href="#evento-${esc(e.id)}"><span class="grow"><span class="strong small">${esc(e.title)}</span><span class="xsmall faint" style="display:block">${U.fmtDate(e.date, 'short')} · ${U.relDay(e.date)}</span></span>${ui.keyBadge(it.key)}</a>`;
                }).join('')}</div>` : '<p class="small muted">Todavía no está en ningún evento.</p>'}
              </section>
              <section class="panel">
                <h2 class="panel-title">${I('tag', 16)} Temas</h2>
                <div class="chip-row">${(s.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('') || '<span class="small muted">Sin temas</span>'}</div>
              </section>
            </aside>
          </div>
        </div>`;

      const setKey = (k) => { vs.keys[s.id] = k; App.app.refresh(); };

      root.addEventListener('click', (e) => {
        const nb = e.target.closest('[data-notation]');
        if (nb) { App.store.setPref('notation', nb.dataset.notation); return; }
        const rm = e.target.closest('[data-arr-remove]');
        if (rm) {
          const arr = arrangement.slice();
          arr.splice(Number(rm.dataset.arrRemove), 1);
          App.actions.saveSong(Object.assign(U.clone(s), { arrangement: arr }));
          return;
        }
        const b = e.target.closest('[data-act]');
        if (!b) return;
        switch (b.dataset.act) {
          case 'up': setKey(C.transposeKey(target, 1)); break;
          case 'down': setKey(C.transposeKey(target, -1)); break;
          case 'reset': setKey(s.key); break;
          case 'chords': vs.chords = !vs.chords; App.app.refresh(); break;
          case 'smaller': vs.size = Math.max(13, vs.size - 1); App.app.refresh(); break;
          case 'bigger': vs.size = Math.min(30, vs.size + 1); App.app.refresh(); break;
          case 'cols': vs.cols = !vs.cols; App.app.refresh(); break;
          case 'scroll':
            if (!vs.scrolling) startScroll();
            else if (vs.speed < 3) vs.speed++;
            else { vs.speed = 1; stopScroll(); }
            App.app.refresh();
            break;
          case 'stage': stopScroll(); App.stage.openSong(s.id, target); break;
          case 'edit': App.forms.song(s); break;
          case 'add-to-event': addToEvent(s, target, upcoming); break;
        }
      });

      root.addEventListener('change', (e) => {
        if (e.target.id === 'song-key') setKey(e.target.value);
        if (e.target.id === 'song-capo') { vs.capo = Number(e.target.value); App.app.refresh(); }
        if (e.target.id === 'arr-add' && e.target.value) {
          App.actions.saveSong(Object.assign(U.clone(s), { arrangement: arrangement.concat(e.target.value) }));
        }
      });

      // Resaltar la sección al pasar por el chip del arreglo
      const chart = root.querySelector('#song-chart');
      root.querySelector('#arr-chips').addEventListener('mouseover', (e) => {
        const chip = e.target.closest('.arr-chip');
        chart.querySelectorAll('.is-hl').forEach((x) => x.classList.remove('is-hl'));
        if (chip) chart.querySelectorAll(`[data-sec="${CSS.escape(chip.dataset.sec)}"]`).forEach((x) => x.classList.add('is-hl'));
      });
    }
  };

  function addToEvent(s, key, upcoming) {
    ui.modal({
      title: 'Agregar a un evento',
      body: `<div class="menu-list">${upcoming.map((e) => {
        const has = e.setlist.some((it) => it.songId === s.id);
        return `<button class="menu-item" data-ev="${esc(e.id)}" ${has ? 'disabled' : ''}>${ui.typeTag(e.type)}<span class="grow"><span class="strong">${esc(e.title)}</span><span class="xsmall faint">${U.fmtDate(e.date, 'short')} · ${U.fmtTime(e.time)}${has ? ' · ya está en el setlist' : ''}</span></span>${has ? I('check', 16) : I('plus', 16)}</button>`;
      }).join('')}</div>`,
      actions: [{ label: 'Cerrar', kind: 'ghost' }]
    }).body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ev]');
      if (!b || b.disabled) return;
      App.actions.addSong(b.dataset.ev, s.id, key);
      b.disabled = true;
      b.querySelector('.xsmall').textContent += ' · agregada';
      ui.toast(`"${s.title}" agregada en ${C.formatKey(key, App.store.state.prefs.notation)}.`);
    });
  }
})();
