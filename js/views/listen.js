/* =========================================================================
   SELAH · Vista: Escuchar
   Las grabaciones del repertorio y los links que comparte el equipo en
   cada evento, para escucharlos dentro de la app (App.player).
   También define ui.linkRow, que usan Evento y Canción.
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc, A = App.actions;

  const vs = App.viewState.listen = { q: '', filter: 'audio', open: {} };

  /** Fila de un link: miniatura, título, quién lo compartió y botones. */
  ui.linkRow = (link, { i = 0, canRemove = false, removeKey = '', showSong = false } = {}) => {
    const info = App.media.parse(link.url);
    const who = link.memberId ? M.member(link.memberId) : null;
    const song = showSong && link.songId ? M.song(link.songId) : null;
    const t = link.title || App.media.cachedTitle(link.url) || App.media.fallbackTitle(info);
    const meta = [song ? esc(song.title) : '', who ? `de ${esc(U.firstName(who.name))}` : '', link.ts ? U.timeAgo(link.ts) : ''].filter(Boolean).join(' · ');
    return `
      <div class="lk-row">
        <button class="lk-art" data-play="${i}" aria-label="Escuchar">${App.media.thumb(info)}<span class="lk-art-play">${I(App.media.playable(info) ? 'play' : 'external', 14)}</span></button>
        <div class="grow stack-sm lk-text">
          <span class="strong small lk-title" ${link.title ? '' : `data-lt="${esc(link.url)}"`}>${esc(t)}</span>
          <span class="xsmall faint lk-meta">${App.media.badge(info)}${meta ? ` <span>${meta}</span>` : ''}</span>
        </div>
        <button class="btn btn--soft btn--sm lk-go" data-play="${i}">${I(App.media.playable(info) ? 'play' : 'external', 12)} ${App.media.playable(info) ? 'Escuchar' : 'Abrir'}</button>
        ${canRemove ? `<button class="btn btn--plain btn--icon btn--sm" data-remove-link="${esc(removeKey || link.id)}" aria-label="Quitar link">${I('x', 14)}</button>` : ''}
      </div>`;
  };

  /** Completa los títulos que faltan (YouTube, Spotify, SoundCloud) sin redibujar. */
  ui.hydrateLinkTitles = (root) => {
    U.$$('[data-lt]', root).forEach((el) => {
      const info = App.media.parse(el.dataset.lt);
      App.media.title(info).then((t) => { if (t) el.textContent = t; });
    });
  };

  /** Reproduce un link: dentro de la app si se puede, si no lo abre aparte. */
  ui.playLinks = (links, start = 0, extra) => {
    const items = links.map((l) => App.player.itemOf(l, extra));
    const info = App.media.parse(items[start] && items[start].url);
    if (info && !App.media.playable(info) && items.length === 1) { window.open(info.url, '_blank', 'noopener'); return; }
    App.player.play(items, start);
  };

  function quickPlay(text) {
    const info = App.media.parse(text);
    if (!info) { ui.toast('Pega un link completo (por ejemplo, de YouTube o Spotify).', { kind: 'warn' }); return; }
    if (!App.media.playable(info)) { window.open(info.url, '_blank', 'noopener'); return; }
    App.player.play([{ url: info.url }]);
  }

  App.views.escuchar = {
    title: 'Escuchar',
    render(root) {
      const leader = M.isLeader();
      const next = M.nextEvent((e) => e.setlist.length > 0);
      const nq = U.normalize(vs.q);
      const songs = M.songs().slice().sort((a, b) => a.title.localeCompare(b.title))
        .map((s) => ({ s, links: M.songLinks(s.id) }))
        .filter((x) => (vs.filter === 'all' || x.links.length) && (!nq || U.normalize(`${x.s.title} ${x.s.artist}`).includes(nq)));
      const withAudio = M.songs().filter((s) => M.songLinks(s.id).length).length;
      const recent = M.recentLinks(8);

      // Lista plana para los botones de reproducir
      const playable = [];
      const add = (links, extra) => { const i = playable.length; playable.push({ links, extra }); return i; };

      let nextBlock = '';
      if (next) {
        const rows = next.setlist.map((it, n) => {
          const s = M.song(it.songId);
          if (!s) return '';
          const links = M.songLinks(s.id).concat(M.eventLinks(next).filter((l) => l.songId === s.id && !M.songLinks(s.id).some((x) => x.url === l.url)));
          const idx = links.length ? add(links) : -1;
          return `
            <li class="ls-row">
              <span class="ls-num mono">${n + 1}</span>
              <div class="grow stack-sm"><span class="strong small truncate">${esc(s.title)}</span><span class="xsmall faint">${links.length ? U.plural(links.length, 'grabación', 'grabaciones') : 'Sin link todavía'}</span></div>
              ${ui.keyBadge(it.key)}
              ${idx >= 0 ? `<button class="btn btn--soft btn--icon btn--sm" data-q="${idx}" aria-label="Escuchar ${esc(s.title)}">${I('play', 13)}</button>`
                : `<button class="btn btn--ghost btn--sm" data-send="${esc(next.id)}" data-song="${esc(s.id)}">${I('link', 13)} Enviar link</button>`}
            </li>`;
        }).join('');
        const firsts = next.setlist.map((it) => {
          const l = M.songLinks(it.songId)[0] || (next.links || []).find((x) => x.songId === it.songId);
          return l ? Object.assign({}, l, { songId: it.songId }) : null;
        }).filter(Boolean);
        const allIdx = firsts.length ? add(firsts) : -1;
        nextBlock = `
          <section class="ls-next">
            <div class="ls-next-head">
              <div class="stack-sm">
                <span class="eyebrow">Para el próximo servicio</span>
                <h2 class="ls-next-title">${esc(next.title)}</h2>
                <span class="small muted">${U.fmtDate(next.date, 'long')} · ${U.fmtTime(next.time)} · ${U.relDay(next.date)}</span>
              </div>
              <div class="row">
                ${allIdx >= 0 ? `<button class="btn btn--primary" data-q="${allIdx}">${I('play', 14)} Escuchar el setlist</button>` : ''}
                <a class="btn btn--ghost" href="#evento-${esc(next.id)}">Ver evento</a>
              </div>
            </div>
            <ol class="ls-list">${rows}</ol>
          </section>`;
      }

      const songRows = songs.map(({ s, links }) => {
        const open = !!vs.open[s.id];
        const first = links[0] ? App.media.parse(links[0].url) : null;
        const idx = links.length ? add(links, {}) : -1;
        return `
          <article class="ls-song ${open ? 'is-open' : ''}">
            <div class="ls-song-row">
              <button class="ls-cover" ${idx >= 0 ? `data-q="${idx}"` : 'disabled'} aria-label="Escuchar ${esc(s.title)}">
                ${first ? App.media.thumb(first) : `<span class="m-thumb m-thumb--md m-thumb--plain">${I('music', 18)}</span>`}
                ${idx >= 0 ? `<span class="lk-art-play">${I('play', 14)}</span>` : ''}
              </button>
              <button class="ls-song-main" data-toggle="${esc(s.id)}">
                <span class="strong truncate">${esc(s.title)}</span>
                <span class="xsmall faint truncate">${esc(s.artist || '')}${s.artist ? ' · ' : ''}${links.length ? U.plural(links.length, 'grabación', 'grabaciones') : 'Sin grabación'}</span>
              </button>
              ${ui.keyBadge(s.key)}
              <button class="btn btn--plain btn--icon btn--sm" data-toggle="${esc(s.id)}" aria-label="Ver grabaciones">${I(open ? 'chevron-up' : 'chevron-down', 16)}</button>
            </div>
            ${open ? `<div class="ls-song-links">
              ${links.map((l, k) => ui.linkRow(l, { i: `${idx}:${k}`, canRemove: leader && l.source === 'song', removeKey: `${s.id}|${l.id}` })).join('') || '<p class="small muted">Todavía no hay grabaciones de esta canción.</p>'}
              <div class="row">
                ${leader ? `<button class="btn btn--ghost btn--sm" data-add-song-link="${esc(s.id)}">${I('plus', 13)} Agregar grabación</button>` : ''}
                <a class="btn btn--plain btn--sm" href="#cancion-${esc(s.id)}">${I('music', 13)} Ver acordes</a>
              </div>
            </div>` : ''}
          </article>`;
      }).join('');

      const recentIdx = recent.length ? add(recent) : -1;

      root.innerHTML = `
        <div class="view view--listen">
          <header class="view-head">
            <div class="titles">
              <span class="eyebrow">Alabanza</span>
              <h1 class="view-title">Escuchar</h1>
              <p class="muted">Las grabaciones del repertorio y los links que comparte el equipo. Suenan aquí mismo, aunque cambies de pantalla.</p>
            </div>
          </header>

          <form class="ls-paste" id="ls-paste" autocomplete="off">
            <span class="ls-paste-icon">${I('link', 18)}</span>
            <label class="sr-only" for="ls-url">Link</label>
            <input class="ls-paste-input" id="ls-url" inputmode="url" placeholder="Pega un link de YouTube, Spotify, SoundCloud o Drive para escucharlo">
            <button class="btn btn--primary btn--sm" type="submit">${I('play', 13)} Escuchar</button>
          </form>

          ${nextBlock}

          <section class="section">
            <div class="section-head">
              <h2 class="section-title">Repertorio <span class="faint small">${withAudio}/${M.songs().length} con grabación</span></h2>
              <div class="seg" role="group" aria-label="Filtro">
                <button class="${vs.filter === 'audio' ? 'is-on' : ''}" data-filter="audio">Con grabación</button>
                <button class="${vs.filter === 'all' ? 'is-on' : ''}" data-filter="all">Todas</button>
              </div>
            </div>
            <div class="search">${I('search', 16)}<input class="input" id="ls-q" placeholder="Buscar canción o artista" value="${esc(vs.q)}"></div>
            <div class="ls-songs">${songRows || ui.empty({ icon: 'headphones', title: vs.filter === 'audio' && !nq ? 'Aún no hay grabaciones' : 'Sin resultados', text: vs.filter === 'audio' && !nq ? (leader ? 'Abre una canción y agrega el link de YouTube o Spotify de la versión que van a tocar.' : 'Cuando el líder o el equipo compartan links, aparecerán aquí.') : '' })}</div>
          </section>

          ${recent.length ? `<section class="section">
            <div class="section-head"><h2 class="section-title">Compartido por el equipo</h2>
              <button class="btn btn--ghost btn--sm" data-q="${recentIdx}">${I('play', 13)} Escuchar todo</button></div>
            <div class="card ls-recent">${recent.map((l, k) => ui.linkRow(l, { i: `${recentIdx}:${k}`, showSong: true })).join('')}</div>
          </section>` : ''}
        </div>`;

      ui.hydrateLinkTitles(root);

      const playAt = (key) => {
        const [qi, k] = String(key).split(':').map(Number);
        const q = playable[qi];
        if (q) ui.playLinks(q.links, k || 0, q.extra);
      };

      root.addEventListener('click', (e) => {
        const q = e.target.closest('[data-q]');
        if (q) { playAt(q.dataset.q); return; }
        const p = e.target.closest('[data-play]');
        if (p) { playAt(p.dataset.play); return; }
        const t = e.target.closest('[data-toggle]');
        if (t) { vs.open[t.dataset.toggle] = !vs.open[t.dataset.toggle]; App.app.refresh(); return; }
        const f = e.target.closest('[data-filter]');
        if (f) { vs.filter = f.dataset.filter; App.app.refresh(); return; }
        const send = e.target.closest('[data-send]');
        if (send) { App.forms.shareLink(send.dataset.send, send.dataset.song); return; }
        const addL = e.target.closest('[data-add-song-link]');
        if (addL) { App.forms.songLink(addL.dataset.addSongLink); return; }
        const rm = e.target.closest('[data-remove-link]');
        if (rm) { const [sid, lid] = rm.dataset.removeLink.split('|'); A.removeSongLink(sid, lid); ui.toast('Grabación quitada.'); }
      });
      root.querySelector('#ls-paste').addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = root.querySelector('#ls-url');
        quickPlay(inp.value);
        inp.value = '';
      });
      const search = root.querySelector('#ls-q');
      search.addEventListener('input', U.debounce(() => { vs.q = search.value; App.app.refresh(); setTimeout(() => { const s = document.getElementById('ls-q'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 0); }, 250));
    }
  };

  // ---------------------------------------------------------------------
  // Formularios: compartir un link en un evento / grabación de una canción
  // ---------------------------------------------------------------------
  App.forms.shareLink = function shareLink(eventId, songId = null) {
    const ev = M.event(eventId);
    if (!ev) return;
    const songs = ev.setlist.map((it) => M.song(it.songId)).filter(Boolean);
    App.player.askLink({
      title: 'Enviar link de la alabanza',
      songs,
      songId,
      notifyLabel: 'Avisar en el chat del evento',
      onSave: (data) => {
        A.addEventLink(ev.id, data);
        const song = data.songId ? M.song(data.songId) : null;
        if (data.notify) A.sendMessage(ev.id, `🎵 ${song ? song.title : (data.title || 'Link para ensayar')}\n${data.url}`);
        ui.toast('Link compartido con el equipo.');
      }
    });
  };

  App.forms.songLink = function songLink(songId) {
    const s = M.song(songId);
    if (!s) return;
    App.player.askLink({
      title: `Grabación de "${s.title}"`,
      songId,
      onSave: (data) => { A.addSongLink(songId, data); ui.toast('Grabación agregada al repertorio.'); }
    });
  };
})();
