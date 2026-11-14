/* =========================================================================
   SELAH · Listado de los cantantes
   Quien canta en un culto (voz principal, segunda voz, coros o director)
   —y el líder— arma el listado de canciones con el tono y un link de
   referencia, y lo envía al culto. Todos los del culto lo reciben (aviso
   y chat del evento) y ensayan con los links. Los instrumentistas solo
   lo reciben.
   Las canciones que todavía no están en el repertorio se guardan dentro
   del evento (título, tono y link), sin hoja de acordes.
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc, C = App.chords;

  /** ¿Esta persona canta en el evento? */
  const singsIn = (ev, m = M.me()) => ev.assignments.some((a) => a.memberId === m.id && a.status !== 'declined' && M.position(a.position).voice);
  const canCreate = (ev, m = M.me()) => M.isLeader(m) || singsIn(ev, m);

  function linkFor(ev, it) {
    if (it.link) return it.link;
    if (!it.songId) return '';
    const l = (ev.links || []).find((x) => x.songId === it.songId) || ((M.song(it.songId) || {}).links || [])[0];
    return l ? l.url : '';
  }

  // ---------------------------------------------------------------------
  // Armar y enviar el listado
  // ---------------------------------------------------------------------
  function open(eventId) {
    const ev = M.event(eventId);
    if (!ev) return;
    if (!canCreate(ev)) { ui.toast('El listado lo arman los cantantes de este culto o el líder.', { kind: 'info' }); return; }
    const items = ev.setlist.map((it) => {
      const s = M.song(it.songId);
      return { songId: s ? s.id : null, title: s ? s.title : (it.title || 'Canción'), key: it.key || (s && s.key) || '', link: linkFor(ev, it) };
    });
    let note = (ev.list && ev.list.note) || '';

    const m = ui.modal({
      title: ev.list ? 'Editar listado' : 'Crear listado',
      size: 'lg',
      body: `
        <div class="li-to">${ui.typeTag(ev.type)}<span class="strong">${esc(ev.title)}</span><span class="small muted">${U.fmtDate(ev.date, 'long')} · ${U.fmtTime(ev.time)}</span></div>
        <p class="small muted">Elige las alabanzas, el tono y un link de referencia (YouTube, Spotify…). Al enviarlo, todo el equipo del culto lo recibe para ensayar.</p>
        <ol class="li-items card" id="li-items"></ol>
        <div class="li-add">
          <div class="search">${I('search', 16)}<input class="input" id="li-q" placeholder="Buscar en el repertorio" autocomplete="off"></div>
          <div class="li-results" id="li-results"></div>
          <details class="li-new">
            <summary>${I('plus', 14)} Canción que no está en el repertorio</summary>
            <div class="li-new-row">
              <input class="input" id="li-nt" placeholder="Título de la canción">
              <input class="input mono" id="li-nk" placeholder="Tono (G, Am…)" maxlength="4">
              <button type="button" class="btn btn--soft" data-li="new">${I('plus', 14)} Agregar</button>
            </div>
          </details>
        </div>
        <div class="field"><label class="field-label" for="li-note">Indicaciones para el equipo (opcional)</label>
          <textarea class="textarea" id="li-note" rows="2" placeholder="Ej.: la segunda la empezamos solo con piano">${esc(note)}</textarea></div>`,
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        {
          label: 'Enviar al culto', kind: 'primary', icon: 'send',
          onClick: (api) => {
            if (!items.length) { ui.toast('Agrega al menos una canción.', { kind: 'warn' }); return false; }
            note = api.body.querySelector('#li-note').value.trim();
            send(ev.id, items, note);
          }
        }
      ]
    });

    const list = m.body.querySelector('#li-items');
    const results = m.body.querySelector('#li-results');
    const q = m.body.querySelector('#li-q');

    const paint = () => {
      list.innerHTML = items.length ? items.map((it, i) => {
        const s = it.songId ? M.song(it.songId) : null;
        const info = it.link ? App.media.parse(it.link) : null;
        return `
          <li class="li-row" data-i="${i}">
            <span class="li-num mono">${i + 1}</span>
            <div class="grow stack-sm li-main">
              <span class="strong small truncate">${esc(it.title)}${s ? '' : ' <span class="tag">Nueva</span>'}</span>
              <div class="li-fields">
                ${s ? `<select class="select select--sm mono" data-li-f="key" aria-label="Tono">${C.keysFor(s.key).map((k) => `<option value="${k}" ${k === it.key ? 'selected' : ''}>${esc(C.formatKey(k, App.store.state.prefs.notation))}</option>`).join('')}</select>`
                  : `<input class="input input--sm mono li-key" data-li-f="key" value="${esc(it.key)}" placeholder="Tono" maxlength="4" aria-label="Tono">`}
                <input class="input input--sm" data-li-f="link" value="${esc(it.link)}" placeholder="Link de referencia (YouTube, Spotify…)" inputmode="url" aria-label="Link de referencia">
                ${info ? App.media.badge(info) : ''}
              </div>
            </div>
            <div class="li-actions">
              <button type="button" class="btn btn--plain btn--icon btn--sm" data-li="up" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${I('arrow-up', 14)}</button>
              <button type="button" class="btn btn--plain btn--icon btn--sm" data-li="down" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Bajar">${I('arrow-down', 14)}</button>
              <button type="button" class="btn btn--plain btn--icon btn--sm" data-li="del" aria-label="Quitar">${I('x', 14)}</button>
            </div>
          </li>`;
      }).join('') : '<li class="small muted li-empty">Busca una alabanza abajo para empezar el listado.</li>';
    };

    const search = () => {
      const nq = U.normalize(q.value);
      const found = M.songs().filter((s) => !items.some((it) => it.songId === s.id) && (!nq || U.normalize(`${s.title} ${s.artist}`).includes(nq))).slice(0, nq ? 8 : 5);
      results.innerHTML = found.map((s) => `<button type="button" class="li-result" data-add="${esc(s.id)}">${ui.keyBadge(s.key)}<span class="grow truncate"><span class="strong small">${esc(s.title)}</span> <span class="xsmall faint">${esc(s.artist || '')}</span></span>${I('plus', 14)}</button>`).join('')
        || `<p class="xsmall faint" style="padding:6px 4px">${nq ? 'No está en el repertorio: agrégala como canción nueva.' : ''}</p>`;
    };

    paint();
    search();
    q.addEventListener('input', U.debounce(search, 120));

    m.body.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add]');
      if (add) {
        const s = M.song(add.dataset.add);
        items.push({ songId: s.id, title: s.title, key: s.key, link: linkFor(ev, { songId: s.id }) });
        q.value = ''; paint(); search();
        return;
      }
      const b = e.target.closest('[data-li]');
      if (!b) return;
      const row = b.closest('[data-i]');
      const i = row ? Number(row.dataset.i) : -1;
      if (b.dataset.li === 'new') {
        const t = m.body.querySelector('#li-nt'), k = m.body.querySelector('#li-nk');
        if (!t.value.trim()) { t.focus(); return; }
        items.push({ songId: null, title: t.value.trim(), key: C.readKey(k.value) || k.value.trim(), link: '' });
        t.value = ''; k.value = ''; paint();
        return;
      }
      if (b.dataset.li === 'up' && i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]];
      if (b.dataset.li === 'down' && i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]];
      if (b.dataset.li === 'del') items.splice(i, 1);
      paint();
    });
    m.body.addEventListener('change', (e) => {
      const f = e.target.dataset.liF;
      const row = e.target.closest('[data-i]');
      if (!f || !row) return;
      const it = items[Number(row.dataset.i)];
      it[f] = f === 'key' ? (C.readKey(e.target.value) || e.target.value.trim()) : e.target.value.trim();
      if (f === 'link') {
        const info = App.media.parse(it.link);
        if (it.link && !info) ui.toast('Ese link no parece válido.', { kind: 'warn' });
        paint();
      }
    });
  }

  function send(eventId, items, note) {
    const me = M.me();
    const voice = M.isLeader(me) && !singsIn(M.event(eventId), me) ? null : me.id;
    App.store.update((s) => {
      const ev = s.events.find((e) => e.id === eventId);
      if (!ev) return;
      ev.setlist = items.map((it) => {
        const item = { songId: it.songId || null, key: it.key || '', leaderId: voice, notes: '' };
        if (!it.songId) item.title = it.title;
        if (it.link) item.link = it.link;
        return item;
      });
      ev.list = { by: me.id, at: Date.now(), note: note || '', count: items.length };
      const links = ev.links || [];
      items.forEach((it) => {
        if (!it.link || links.some((l) => l.url === it.link)) return;
        links.push({ id: U.uid('l'), url: it.link, title: it.songId ? '' : it.title, songId: it.songId || null, memberId: me.id, ts: Date.now() });
      });
      ev.links = links;
    });
    const ev = M.event(eventId);
    const lines = items.map((it, i) => `${i + 1}. ${it.title}${it.key ? ` (${C.formatKey(it.key, App.store.state.prefs.notation)})` : ''}${it.link ? `\n${it.link}` : ''}`).join('\n');
    App.actions.sendMessage(eventId, `🎤 Listado para ${ev.title} (${U.fmtDate(ev.date, 'short')}):\n${lines}${note ? `\n\n📝 ${note}` : ''}`);
    ui.toast('Listado enviado. Todo el equipo del culto lo recibe.', { action: { label: 'Ver', onClick: () => { App.viewState.event.tab = 'setlist'; App.router.go('evento', eventId); } } });
  }

  // ---------------------------------------------------------------------
  // Inicio: "Tus listados" (cantantes y líder)
  // ---------------------------------------------------------------------
  function card(me = M.me()) {
    const leader = M.isLeader(me);
    const evs = M.upcoming({ days: leader ? 14 : 30 }).filter((e) => leader ? e.assignments.some((a) => M.position(a.position).voice) : singsIn(e, me));
    if (!evs.length) return '';
    return `
      <section class="panel li-card">
        <div class="row-between"><h2 class="panel-title">${I('mic', 17)} ${leader ? 'Listados de los cultos' : 'Tus listados'}</h2></div>
        <div class="stack-sm">${evs.slice(0, 6).map((ev) => {
          const by = ev.list ? M.member(ev.list.by) : null;
          return `
            <div class="att-row">
              <div class="grow stack-sm">
                <a class="strong small" href="#evento-${esc(ev.id)}">${esc(ev.title)}</a>
                <span class="xsmall ${ev.list ? 'muted' : 'warn-text'}">${U.fmtDate(ev.date, 'short')} · ${ev.list ? `${U.plural(ev.setlist.length, 'canción', 'canciones')} · enviado por ${esc(by ? U.firstName(by.name) : '—')}` : 'Falta el listado'}</span>
              </div>
              ${canCreate(ev, me) ? `<button class="btn ${ev.list ? 'btn--ghost' : 'btn--primary'} btn--sm" data-listado="${esc(ev.id)}">${ev.list ? I('edit', 14) + ' Editar' : I('plus', 14) + ' Crear'}</button>` : ''}
            </div>`;
        }).join('')}</div>
      </section>`;
  }

  // Botones [data-listado] en cualquier pantalla
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-listado]');
    if (!b) return;
    e.preventDefault();
    open(b.dataset.listado);
  });

  App.listado = { open, send, card, canCreate, singsIn };
})();
