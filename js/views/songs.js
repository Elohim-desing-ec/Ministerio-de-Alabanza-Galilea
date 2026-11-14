/* =========================================================================
   SELAH · Vista: Canciones (repertorio)
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc;

  const vs = App.viewState.songs = { q: '', tempo: 'all', tag: 'all', sort: 'az' };

  function filteredSongs() {
    const q = U.normalize(vs.q);
    let list = M.songs().filter((s) =>
      (vs.tempo === 'all' || s.tempo === vs.tempo) &&
      (vs.tag === 'all' || (s.tags || []).includes(vs.tag)) &&
      (!q || U.normalize(`${s.title} ${s.artist} ${(s.tags || []).join(' ')} ${s.key}`).includes(q)));
    if (vs.sort === 'az') list = list.sort((a, b) => a.title.localeCompare(b.title));
    if (vs.sort === 'uso') list = list.sort((a, b) => M.songUseCount(b.id) - M.songUseCount(a.id));
    if (vs.sort === 'reciente') list = list.sort((a, b) => (M.songLastUsed(b.id) || '').localeCompare(M.songLastUsed(a.id) || ''));
    if (vs.sort === 'bpm') list = list.sort((a, b) => b.bpm - a.bpm);
    return list;
  }

  function rows() {
    if (!M.songs().length) {
      return ui.empty({
        icon: 'music', title: 'Tu repertorio está vacío',
        text: 'Sube los PDF de LaCuerda.net y la app lee la letra, los acordes y el tono por ti.',
        action: M.isLeader() ? `<div class="row" style="justify-content:center"><button class="btn btn--primary" data-act="import">${I('arrow-up', 16)} Importar PDF</button><button class="btn btn--ghost" data-act="new">${I('plus', 16)} Escribir una</button></div>` : ''
      });
    }
    const list = filteredSongs();
    if (!list.length) return ui.empty({ icon: 'search', title: 'No encontramos canciones', text: 'Prueba con otra palabra o quita los filtros.' });
    const notation = App.store.state.prefs.notation;
    return `
      <div class="card song-table" role="table" aria-label="Repertorio">
        <div class="song-tr song-th" role="row">
          <span role="columnheader">Canción</span><span role="columnheader">Tono</span><span role="columnheader">BPM</span><span role="columnheader">Temas</span><span role="columnheader">Última vez</span>
        </div>
        ${list.map((s) => {
          const last = M.songLastUsed(s.id);
          return `
          <a class="song-tr" role="row" href="#cancion-${esc(s.id)}">
            <span class="song-name" role="cell"><span class="strong truncate">${esc(s.title)}</span><span class="xsmall faint truncate">${esc(s.artist || '')}</span></span>
            <span role="cell">${ui.keyBadge(s.key)}</span>
            <span role="cell" class="mono small">${s.bpm || '—'} <span class="faint">· ${esc(M.tempoLabel(s.tempo))}</span></span>
            <span role="cell" class="song-tags">${(s.tags || []).slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span>
            <span role="cell" class="small muted">${last ? U.relDay(last) : 'Nunca'}</span>
          </a>`;
        }).join('')}
      </div>
      <p class="xsmall faint">${U.plural(list.length, 'canción', 'canciones')} · Tonalidades en notación ${notation === 'latino' ? 'latina (Do Re Mi)' : 'americana (C D E)'}.</p>`;
  }

  App.views.canciones = {
    title: 'Canciones',
    render(root) {
      const leader = M.isLeader();
      const tags = M.allTags();
      root.innerHTML = `
        <div class="view view--songs">
          <header class="view-head">
            <div class="titles">
              <span class="eyebrow">Repertorio</span>
              <h1 class="view-title">Canciones</h1>
              <p class="muted">${U.plural(M.songs().length, 'canción', 'canciones')} con acordes, tonalidad y arreglo.</p>
            </div>
            <div class="view-actions">
              ${leader ? `<button class="btn btn--ghost" data-act="new">${I('plus', 16)} Nueva canción</button><button class="btn btn--primary" data-act="import">${I('arrow-up', 16)} Importar PDF</button>` : ''}
            </div>
          </header>

          <div class="songs-filters">
            <div class="search grow"><label class="sr-only" for="song-q">Buscar canciones</label>${I('search', 16)}<input class="input" id="song-q" placeholder="Buscar por título, autor, tema o tono" value="${esc(vs.q)}"></div>
            <div class="seg" role="group" aria-label="Ritmo">
              <button class="${vs.tempo === 'all' ? 'is-on' : ''}" data-tempo="all">Todas</button>
              ${App.config.tempos.map((t) => `<button class="${vs.tempo === t.id ? 'is-on' : ''}" data-tempo="${t.id}">${esc(t.label)}s</button>`).join('')}
            </div>
            <label class="sr-only" for="song-sort">Ordenar</label>
            <select class="select songs-sort" id="song-sort">
              <option value="az" ${vs.sort === 'az' ? 'selected' : ''}>A–Z</option>
              <option value="uso" ${vs.sort === 'uso' ? 'selected' : ''}>Más cantadas</option>
              <option value="reciente" ${vs.sort === 'reciente' ? 'selected' : ''}>Usadas recientemente</option>
              <option value="bpm" ${vs.sort === 'bpm' ? 'selected' : ''}>Más rápidas</option>
            </select>
          </div>
          <div class="chip-row chip-row--scroll">
            <button class="chip ${vs.tag === 'all' ? 'is-on' : ''}" data-tag="all">Todos los temas</button>
            ${tags.map((t) => `<button class="chip ${vs.tag === t ? 'is-on' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
          </div>

          <div id="song-rows">${rows()}</div>
        </div>`;

      const rowsEl = root.querySelector('#song-rows');
      root.querySelector('#song-q').addEventListener('input', U.debounce((e) => { vs.q = e.target.value; rowsEl.innerHTML = rows(); }, 120));
      root.querySelector('#song-sort').addEventListener('change', (e) => { vs.sort = e.target.value; rowsEl.innerHTML = rows(); });
      root.addEventListener('click', (e) => {
        const tempo = e.target.closest('[data-tempo]');
        if (tempo) { vs.tempo = tempo.dataset.tempo; App.app.refresh(); return; }
        const tag = e.target.closest('[data-tag]');
        if (tag) { vs.tag = tag.dataset.tag; App.app.refresh(); return; }
        if (e.target.closest('[data-act="new"]')) App.forms.song();
        if (e.target.closest('[data-act="import"]')) App.importer.open();
      });
    }
  };
})();
