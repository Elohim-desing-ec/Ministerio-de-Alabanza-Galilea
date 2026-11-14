/* =========================================================================
   SELAH · Vista: Evento (setlist, equipo, chat y detalles)
   También define los formularios App.forms.event, App.forms.autofill y
   App.forms.songPicker, que se usan desde otras pantallas.
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc, A = App.actions;

  const vs = App.viewState.event = { tab: 'setlist' };

  // ---------------------------------------------------------------------
  // Formulario de evento (crear / editar)
  // ---------------------------------------------------------------------
  App.forms.event = function eventForm(existing, defaults = {}) {
    const ev = existing || Object.assign({ title: '', type: 'servicio', date: U.today(), time: '10:00', place: App.config.places[0], teamId: M.teams()[0] && M.teams()[0].id, notes: '' }, defaults);
    const types = Object.entries(App.config.eventTypes);
    ui.modal({
      title: existing ? 'Editar evento' : 'Nuevo evento',
      body: `
        <form class="stack" id="event-form" autocomplete="off">
          <div class="field"><label class="field-label" for="ev-title">Nombre</label>
            <input class="input" id="ev-title" name="title" required placeholder="Servicio Dominical AM" value="${esc(ev.title)}"></div>
          <div class="field-row">
            <div class="field"><label class="field-label" for="ev-type">Tipo</label>
              <select class="select" id="ev-type" name="type" ${existing ? 'disabled' : ''}>${types.map(([id, t]) => `<option value="${id}" ${id === ev.type ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></div>
            <div class="field"><label class="field-label" for="ev-team">Equipo</label>
              <select class="select" id="ev-team" name="teamId"><option value="">Sin equipo fijo</option>${M.teams().map((t) => `<option value="${esc(t.id)}" ${t.id === ev.teamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
          </div>
          <div class="field-row">
            <div class="field"><label class="field-label" for="ev-date">Fecha</label><input class="input" type="date" id="ev-date" name="date" required value="${esc(ev.date)}"></div>
            <div class="field"><label class="field-label" for="ev-time">Hora</label><input class="input" type="time" id="ev-time" name="time" required value="${esc(ev.time)}"></div>
          </div>
          <div class="field"><label class="field-label" for="ev-place">Lugar</label>
            <input class="input" id="ev-place" name="place" list="ev-places" value="${esc(ev.place)}">
            <datalist id="ev-places">${App.config.places.map((p) => `<option value="${esc(p)}">`).join('')}</datalist></div>
          <div class="field"><label class="field-label" for="ev-notes">Notas para el equipo</label>
            <textarea class="textarea" id="ev-notes" name="notes" rows="3" placeholder="Hora de llegada, vestimenta, detalles del servicio…">${esc(ev.notes)}</textarea></div>
          ${existing ? '' : '<p class="field-hint">Los puestos del equipo se crean según el tipo de evento. Puedes agregar o quitar puestos después.</p>'}
        </form>`,
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        {
          label: existing ? 'Guardar cambios' : 'Crear evento', kind: 'primary',
          onClick: (m) => {
            const f = m.body.querySelector('form');
            if (!f.reportValidity()) return false;
            const data = Object.fromEntries(new FormData(f).entries());
            if (existing) {
              A.updateEvent(existing.id, { title: data.title, teamId: data.teamId || null, date: data.date, time: data.time, place: data.place, notes: data.notes });
              ui.toast('Evento actualizado.');
            } else {
              const created = A.createEvent(Object.assign(data, { teamId: data.teamId || null }));
              ui.toast('Evento creado. Ahora arma el setlist y el equipo.');
              App.router.go('evento', created.id);
            }
          }
        }
      ]
    });
  };

  // ---------------------------------------------------------------------
  // Auto-asignar equipo con la rotación justa (vista previa + aplicar)
  // ---------------------------------------------------------------------
  App.forms.autofill = function autofill(eventId) {
    const ev = M.event(eventId);
    if (!ev) return;
    const plan = App.rotation.plan(ev);
    if (!plan.length) { ui.toast('Todos los puestos ya tienen a alguien asignado.'); return; }
    const filled = plan.filter((p) => p.memberId);
    ui.modal({
      title: 'Completar equipo por rotación',
      size: 'lg',
      body: `
        <p class="muted small">Propuesta para <strong>${esc(ev.title)}</strong> · ${U.fmtDate(ev.date, 'long')}. Prioriza a quien menos ha servido, respeta los días no disponibles y evita cruces con otros eventos.</p>
        <div class="card list">${plan.map((p) => {
          const m = M.member(p.memberId);
          const prev = p.replaces ? M.member(p.replaces) : null;
          return `<div class="list-row plan-row">
            <span class="plan-pos">${I(M.groupIcon(p.position), 16)} ${esc(M.posLabel(p.position))}</span>
            <div class="grow stack-sm">${ui.person(m, 'sm')}<span class="xsmall faint">${esc(p.reason)}${prev ? ` · reemplaza a ${esc(prev.name)}` : ''}</span></div>
          </div>`;
        }).join('')}</div>`,
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        {
          label: `Asignar ${U.plural(filled.length, 'persona', 'personas')}`, kind: 'primary', icon: 'check',
          onClick: () => {
            const n = App.rotation.apply(ev.id, plan);
            ui.toast(`${U.plural(n, 'persona asignada', 'personas asignadas')}. Quedan pendientes de confirmar.`);
          }
        }
      ]
    });
  };

  // ---------------------------------------------------------------------
  // Selector de canciones para el setlist
  // ---------------------------------------------------------------------
  App.forms.songPicker = function songPicker(eventId) {
    const ev = M.event(eventId);
    const inSet = new Set(ev.setlist.map((it) => it.songId));
    const m = ui.modal({
      title: 'Agregar canciones',
      size: 'lg',
      body: `
        <div class="search">${I('search', 16)}<input class="input" id="pick-q" placeholder="Buscar por título, tema o tonalidad"></div>
        <div class="card list" id="pick-list"></div>`,
      actions: [{ label: 'Listo', kind: 'primary' }]
    });
    const listEl = m.body.querySelector('#pick-list');
    const draw = (q = '') => {
      const nq = U.normalize(q);
      const songs = M.songs().filter((s) => !nq || U.normalize(`${s.title} ${s.artist} ${(s.tags || []).join(' ')} ${s.key}`).includes(nq));
      listEl.innerHTML = songs.map((s) => {
        const last = M.songLastUsed(s.id);
        return `<div class="list-row">
          ${ui.keyBadge(s.key)}
          <div class="grow stack-sm"><span class="strong truncate">${esc(s.title)}</span><span class="xsmall faint">${M.bpm(s)} · ${esc(M.tempoLabel(s.tempo))} · ${(s.tags || []).map(esc).join(', ')}${last ? ` · usada ${U.relDay(last).toLowerCase()}` : ''}</span></div>
          <button class="btn btn--sm ${inSet.has(s.id) ? 'btn--ghost' : 'btn--soft'}" data-add="${esc(s.id)}" ${inSet.has(s.id) ? 'disabled' : ''}>${inSet.has(s.id) ? `${I('check', 14)} En el setlist` : `${I('plus', 14)} Agregar`}</button>
        </div>`;
      }).join('') || '<p class="small muted" style="padding:16px">Sin resultados.</p>';
    };
    draw();
    m.body.querySelector('#pick-q').addEventListener('input', (e) => draw(e.target.value));
    listEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-add]');
      if (!b) return;
      A.addSong(eventId, b.dataset.add);
      inSet.add(b.dataset.add);
      draw(m.body.querySelector('#pick-q').value);
    });
  };

  // ---------------------------------------------------------------------
  // Pestañas
  // ---------------------------------------------------------------------
  function setlistTab(ev, leader) {
    const notation = App.store.state.prefs.notation;
    const total = M.setlistDuration(ev);
    const voices = M.members().filter((m) => m.roles.some((r) => M.position(r).voice));
    const head = `
      <div class="row-between">
        <p class="small muted">${U.plural(ev.setlist.length, 'canción', 'canciones')} · ${U.fmtMinutes(total)} aprox.</p>
        <div class="row">
          ${ev.setlist.length ? `<button class="btn btn--ghost btn--sm" data-act="stage">${I('stage', 14)} Modo escenario</button>` : ''}
          ${ev.setlist.length ? `<button class="btn btn--ghost btn--sm" data-act="practice">${I('metronome', 14)} Ensayar con la música</button>` : ''}
          ${leader ? `<button class="btn btn--soft btn--sm" data-act="ai-setlist">${I('sparkle', 14)} Sugerir con IA</button>` : ''}
          ${App.listado.canCreate(ev) ? `<button class="btn ${leader ? 'btn--ghost' : 'btn--primary'} btn--sm" data-listado="${esc(ev.id)}">${I('mic', 14)} ${ev.list ? 'Editar listado' : 'Crear listado'}</button>` : ''}
          ${leader ? `<button class="btn btn--primary btn--sm" data-act="add-song">${I('plus', 14)} Agregar canción</button>` : ''}
        </div>
      </div>
      ${ev.list ? (() => {
        const by = M.member(ev.list.by);
        return `<div class="li-banner">${ui.avatar(by, 'sm')}<div class="grow stack-sm"><span class="small"><strong>${esc(by ? by.name : 'Alguien')}</strong> envió el listado · ${U.timeAgo(ev.list.at)}</span>${ev.list.note ? `<span class="small muted">📝 ${esc(ev.list.note)}</span>` : ''}</div></div>`;
      })() : ''}`;
    if (!ev.setlist.length) {
      return head + ui.empty({ icon: 'music', title: 'Todavía no hay listado', text: App.listado.canCreate(ev) ? 'Arma el listado con las alabanzas, el tono y un link de referencia, y envíalo al equipo.' : 'Cuando los cantantes envíen el listado, aparecerá aquí con los links para ensayar.' });
    }
    return head + `<ol class="setlist card">${ev.setlist.map((it, i) => {
      const s = M.song(it.songId);
      if (!s) {
        return `
        <li class="sl-row sl-row--free" data-idx="${i}">
          <span class="sl-num mono">${i + 1}</span>
          <div class="sl-main">
            <span class="sl-title-row"><span class="sl-title">${esc(it.title || 'Canción')}</span>${it.link ? `<button class="sl-listen" data-listen-url="${esc(it.link)}" data-listen-title="${esc(it.title || '')}" aria-label="Escuchar" title="Escuchar">${I('headphones', 13)}</button>` : ''}</span>
            <span class="xsmall faint">Canción nueva · todavía no está en el repertorio</span>
          </div>
          <div class="sl-key">${it.key ? ui.keyBadge(it.key) : ''}</div>
          <div class="sl-lead">${it.leaderId && M.member(it.leaderId) ? ui.person(M.member(it.leaderId), 'xs') : ''}</div>
          ${leader ? `<div class="sl-actions">
            <button class="btn btn--plain btn--icon btn--sm" data-act="up" data-idx="${i}" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${I('arrow-up', 15)}</button>
            <button class="btn btn--plain btn--icon btn--sm" data-act="down" data-idx="${i}" aria-label="Bajar" ${i === ev.setlist.length - 1 ? 'disabled' : ''}>${I('arrow-down', 15)}</button>
            <button class="btn btn--plain btn--icon btn--sm" data-act="remove-song" data-idx="${i}" aria-label="Quitar">${I('x', 15)}</button>
          </div>` : ''}
        </li>`;
      }
      const keys = App.chords.keysFor(s.key);
      const lead = M.member(it.leaderId);
      const diff = App.chords.semitones(s.key, it.key);
      return `
        <li class="sl-row" data-idx="${i}" ${leader ? 'draggable="true"' : ''}>
          ${leader ? `<span class="sl-grip" title="Arrastra para reordenar">${I('grip', 16)}</span>` : ''}
          <span class="sl-num mono">${i + 1}</span>
          <div class="sl-main">
            <span class="sl-title-row"><button class="sl-title" data-open="${esc(s.id)}" data-key="${esc(it.key)}">${esc(s.title)}</button>${songLinksFor(ev, s.id).length ? `<button class="sl-listen" data-listen-song="${esc(s.id)}" aria-label="Escuchar ${esc(s.title)}" title="Escuchar">${I('headphones', 13)}</button>` : ''}</span>
            <span class="xsmall faint">${M.bpm(s)} · ${esc(M.tempoLabel(s.tempo))} · ${U.fmtDuration(s.duration)}${diff ? ` · ${diff > 0 ? '+' : ''}${diff} del original (${esc(App.chords.formatKey(s.key, notation))})` : ''}</span>
          </div>
          <div class="sl-key">
            ${leader ? `<label class="sr-only" for="k-${i}">Tonalidad</label><select class="select select--sm mono" id="k-${i}" data-field="key" data-idx="${i}">${keys.map((k) => `<option value="${k}" ${k === it.key ? 'selected' : ''}>${esc(App.chords.formatKey(k, notation))}</option>`).join('')}</select>` : ui.keyBadge(it.key)}
          </div>
          <div class="sl-lead">
            ${leader ? `<label class="sr-only" for="l-${i}">Dirige</label><select class="select select--sm" id="l-${i}" data-field="leaderId" data-idx="${i}"><option value="">Dirige: —</option>${ui.memberOptions(voices, it.leaderId)}</select>` : (lead ? ui.person(lead, 'xs') : '<span class="xsmall faint">Sin asignar</span>')}
          </div>
          ${leader ? `<div class="sl-actions">
            <button class="btn btn--plain btn--icon btn--sm" data-act="up" data-idx="${i}" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${I('arrow-up', 15)}</button>
            <button class="btn btn--plain btn--icon btn--sm" data-act="down" data-idx="${i}" aria-label="Bajar" ${i === ev.setlist.length - 1 ? 'disabled' : ''}>${I('arrow-down', 15)}</button>
            <button class="btn btn--plain btn--icon btn--sm" data-act="remove-song" data-idx="${i}" aria-label="Quitar">${I('x', 15)}</button>
          </div>` : ''}
        </li>`;
    }).join('')}</ol>`;
  }

  /** Links de una canción en este evento: primero los compartidos aquí, luego los del repertorio. */
  function songLinksFor(ev, songId) {
    const shared = M.eventLinks(ev).filter((l) => l.songId === songId);
    const song = M.song(songId);
    const repo = ((song && song.links) || []).map((l) => Object.assign({ source: 'song' }, l, { songId })).filter((l) => !shared.some((x) => x.url === l.url));
    return shared.concat(repo);
  }

  let queues = [];

  function listenTab(ev, leader) {
    const me = M.me();
    queues = [];
    const add = (links) => { queues.push(links); return queues.length - 1; };
    const inSet = new Set(ev.setlist.map((it) => it.songId));
    const others = M.eventLinks(ev).filter((l) => !l.songId || !inSet.has(l.songId));
    const firsts = ev.setlist.map((it) => songLinksFor(ev, it.songId)[0]).filter(Boolean).concat(others);
    const allIdx = firsts.length ? add(firsts) : -1;
    const canRemove = (l) => l.source === 'event' && (leader || l.memberId === me.id);

    const head = `
      <div class="listen-head">
        <div class="stack-sm">
          <span class="strong">Escucha las alabanzas de este evento</span>
          <span class="small muted">Cada persona puede enviar el link de la versión que se va a tocar. Se escucha aquí mismo.</span>
        </div>
        <div class="row">
          ${allIdx >= 0 ? `<button class="btn btn--primary btn--sm" data-qall="${allIdx}">${I('play', 13)} Escuchar todo</button>` : ''}
          <button class="btn btn--soft btn--sm" data-act="share-link">${I('link', 13)} Enviar link</button>
        </div>
      </div>`;

    const songBlocks = ev.setlist.map((it, n) => {
      const s = M.song(it.songId);
      if (!s) return '';
      const links = songLinksFor(ev, s.id);
      const qi = links.length ? add(links) : -1;
      return `
        <section class="listen-song">
          <header class="listen-song-head">
            <span class="sl-num mono">${n + 1}</span>
            <div class="grow stack-sm"><span class="strong">${esc(s.title)}</span><span class="xsmall faint">${esc(s.artist || '')}</span></div>
            ${ui.keyBadge(it.key)}
            <button class="btn btn--ghost btn--sm" data-act="share-link" data-song="${esc(s.id)}">${I('plus', 13)} Link</button>
          </header>
          ${links.length ? `<div class="listen-links">${links.map((l, k) => ui.linkRow(l, { i: `${qi}:${k}`, canRemove: canRemove(l) })).join('')}</div>`
            : '<p class="xsmall faint listen-none">Nadie ha enviado un link de esta canción todavía.</p>'}
        </section>`;
    }).join('');

    ev.setlist.forEach((it) => {
      if (!M.song(it.songId) && it.link && !others.some((l) => l.url === it.link)) others.push({ url: it.link, title: it.title || '', source: 'list' });
    });
    const otherIdx = others.length ? add(others) : -1;
    const otherBlock = others.length ? `
      <section class="listen-song">
        <header class="listen-song-head"><span class="sl-num">${I('link', 14)}</span><div class="grow"><span class="strong">Otros links</span></div></header>
        <div class="listen-links">${others.map((l, k) => ui.linkRow(l, { i: `${otherIdx}:${k}`, canRemove: canRemove(l) })).join('')}</div>
      </section>` : '';

    if (!ev.setlist.length && !others.length) {
      return head + ui.empty({ icon: 'headphones', title: 'Aún no hay links', text: 'Cuando el setlist esté listo, cada persona puede enviar el link de YouTube, Spotify o Drive de cada alabanza.' });
    }
    return head + `<div class="listen-list card">${songBlocks}${otherBlock}</div>`;
  }

  /** Después de verificar el culto: "Cumplió" o "No cumplió" en vez del estado. */
  function verifiedPill(ev, m) {
    if (!m || !M.isVerified(ev)) return '';
    if ((ev.verified.done || []).includes(m.id)) return `<span class="pill pill--done">${I('check', 12)} Cumplió</span>`;
    if ((ev.verified.missed || []).includes(m.id)) return '<span class="pill pill--missed">No cumplió</span>';
    return '';
  }

  function teamTab(ev, leader) {
    const me = M.me();
    const st = M.eventStats(ev);
    const groups = App.config.positionGroups.map((g) => ({ g, items: ev.assignments.filter((a) => M.position(a.position).group === g.id) })).filter((x) => x.items.length);
    const head = `
      <div class="team-summary">
        <div class="ts-stats">
          <span><strong class="mono">${st.confirmed}</strong> confirmados</span>
          <span><strong class="mono">${st.pending}</strong> pendientes</span>
          <span><strong class="mono">${st.declined}</strong> no pueden</span>
          <span><strong class="mono">${st.empty}</strong> sin asignar</span>
        </div>
        ${ui.progress(st)}
        ${leader ? `<div class="row">
          <button class="btn btn--soft btn--sm" data-act="autofill">${I('sparkle', 14)} Completar por rotación</button>
          <button class="btn btn--ghost btn--sm" data-act="remind" ${st.pending ? '' : 'disabled'}>${I('bell', 14)} Recordar a pendientes</button>
          <label class="sr-only" for="add-slot">Agregar puesto</label>
          <select class="select select--sm add-slot" id="add-slot"><option value="">+ Agregar puesto</option>${App.config.positions.map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join('')}</select>
        </div>` : ''}
      </div>`;

    return head + groups.map(({ g, items }) => `
      <div class="slot-group">
        <h3 class="eyebrow slot-group-name">${I(g.icon, 14)} ${esc(g.label)}</h3>
        <div class="card list">
          ${items.map((a) => {
            const m = M.member(a.memberId);
            const conflicts = m ? M.conflicts(m.id, ev, a.position).filter((c) => c.code !== 'puesto' || leader) : [];
            const isMe = m && m.id === me.id;
            const status = m ? a.status : 'empty';
            const cands = leader ? M.candidates(ev, a.position) : [];
            return `
              <div class="slot-row status-${status} ${isMe ? 'is-me' : ''}">
                <span class="slot-label">${esc(M.slotLabel(ev, a))}</span>
                <div class="slot-member">
                  ${leader ? `
                    <label class="sr-only" for="s-${esc(a.slot)}">${esc(M.slotLabel(ev, a))}</label>
                    <select class="select select--sm" id="s-${esc(a.slot)}" data-slot="${esc(a.slot)}">
                      <option value="">— Sin asignar —</option>
                      ${cands.map((c) => {
                        const hard = c.conflicts.find((x) => x.hard);
                        const note = hard ? ' · no disponible' : c.conflicts.length ? ' · otro evento ese día' : c.inEvent ? ' · ya tiene otro puesto' : '';
                        return `<option value="${esc(c.member.id)}" ${c.member.id === a.memberId ? 'selected' : ''}>${esc(c.member.name)} (${c.load})${note}</option>`;
                      }).join('')}
                      ${m && !cands.some((c) => c.member.id === m.id) ? `<option value="${esc(m.id)}" selected>${esc(m.name)}</option>` : ''}
                    </select>` : ui.person(m, 'sm', isMe ? '<span class="tag">Tú</span>' : '')}
                  ${m && m.roles.length > 1 && (leader || isMe) ? `<label class="swap"><span class="xsmall faint">Ese día toca</span><select class="select select--sm" data-swap="${esc(a.slot)}">${m.roles.map((r) => `<option value="${r}" ${r === a.position ? 'selected' : ''}>${esc(M.posLabel(r))}</option>`).join('')}</select></label>` : ''}
                  ${conflicts.map((c) => `<span class="${c.hard ? 'bad-text' : 'warn-text'}">${I('alert', 12)} ${esc(c.label)}</span>`).join('')}
                </div>
                <div class="slot-status">${verifiedPill(ev, m) || ui.status(status)}</div>
                <div class="slot-actions">
                  ${isMe && a.status !== 'confirmed' ? `<button class="btn btn--ok btn--sm" data-act="confirm" data-slot="${esc(a.slot)}">${I('check', 14)} Confirmar</button>` : ''}
                  ${isMe && a.status !== 'declined' ? `<button class="btn btn--ghost btn--sm" data-act="decline" data-slot="${esc(a.slot)}">No puedo</button>` : ''}
                  ${leader && m && !isMe ? `<button class="btn btn--plain btn--icon btn--sm" data-act="cycle" data-slot="${esc(a.slot)}" title="Cambiar estado manualmente" aria-label="Cambiar estado">${I('refresh', 14)}</button>` : ''}
                  ${leader ? `<button class="btn btn--plain btn--icon btn--sm" data-act="remove-slot" data-slot="${esc(a.slot)}" aria-label="Quitar puesto">${I('trash', 14)}</button>` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`).join('') + (leader ? '<p class="xsmall faint">El número entre paréntesis es cuántas veces sirvió esa persona en los últimos 60 días y las próximas 4 semanas. La lista va de quien menos ha servido a quien más.</p>' : '');
  }

  function detailsTab(ev, leader) {
    const team = M.team(ev.teamId);
    return `
      <div class="details-grid">
        <section class="panel">
          <h3 class="panel-title">Información</h3>
          <dl class="dl">
            <dt>Fecha</dt><dd>${U.fmtDate(ev.date, 'full')}</dd>
            <dt>Hora</dt><dd>${U.fmtTime(ev.time)}</dd>
            <dt>Lugar</dt><dd>${esc(ev.place || '—')}</dd>
            <dt>Equipo</dt><dd>${team ? esc(team.name) : 'Sin equipo fijo'}</dd>
            <dt>Tipo</dt><dd>${esc(M.typeLabel(ev.type))}</dd>
          </dl>
        </section>
        <section class="panel">
          <h3 class="panel-title">Notas para el equipo</h3>
          ${leader ? `<textarea class="textarea" id="ev-notes-inline" rows="6" placeholder="Escribe indicaciones para el equipo…">${esc(ev.notes)}</textarea><p class="field-hint">Se guarda automáticamente.</p>`
            : `<p class="${ev.notes ? '' : 'muted'}" style="white-space:pre-wrap">${esc(ev.notes || 'Sin notas por ahora.')}</p>`}
        </section>
        ${leader ? `<section class="panel">
          <h3 class="panel-title">Acciones</h3>
          <div class="row">
            <button class="btn btn--ghost btn--sm" data-act="edit">${I('edit', 14)} Editar</button>
            <button class="btn btn--ghost btn--sm" data-act="duplicate">${I('copy', 14)} Duplicar a la semana siguiente</button>
            <button class="btn btn--danger btn--sm" data-act="delete">${I('trash', 14)} Eliminar</button>
          </div>
        </section>` : ''}
      </div>`;
  }

  // ---------------------------------------------------------------------
  // Vista
  // ---------------------------------------------------------------------
  App.views.evento = {
    title: 'Evento',
    render(root, id) {
      const ev = M.event(id);
      if (!ev) {
        root.innerHTML = `<div class="view">${ui.empty({ icon: 'calendar', title: 'Este evento ya no existe', action: '<a class="btn btn--primary" href="#calendario">Ir a la agenda</a>' })}</div>`;
        return;
      }
      const leader = M.isLeader();
      const team = M.team(ev.teamId);
      const chatCount = App.store.state.messages.filter((m) => m.channel === ev.id).length;
      const tabs = [
        ['setlist', 'Setlist', 'music', ev.setlist.length],
        ['equipo', 'Equipo', 'users', ev.assignments.filter((a) => a.memberId).length + '/' + ev.assignments.length],
        ['escuchar', 'Escuchar', 'headphones', (ev.links || []).length],
        ['chat', 'Chat', 'chat', chatCount],
        ['detalles', 'Detalles', 'list', null]
      ];

      root.innerHTML = `
        <div class="view view--event">
          <header class="view-head">
            <div class="titles">
              <a class="back-link" href="#calendario">${I('chevron-left', 16)} Agenda</a>
              <div class="row">${ui.typeTag(ev.type)}${team ? `<span class="tag">${esc(team.name)}</span>` : ''}<span class="xsmall faint">${U.relDay(ev.date)}</span></div>
              <h1 class="view-title">${esc(ev.title)}</h1>
              <p class="muted row">${I('calendar', 15)} ${U.fmtDate(ev.date, 'long')} <span class="faint">·</span> ${I('clock', 15)} ${U.fmtTime(ev.time)}${ev.place ? ` <span class="faint">·</span> ${I('pin', 15)} ${esc(ev.place)}` : ''}</p>
            </div>
            <div class="view-actions">
              ${ev.setlist.length ? `<button class="btn btn--ghost" data-act="stage">${I('stage', 16)} Modo escenario</button>` : ''}
              ${leader ? `<button class="btn btn--ghost" data-act="edit">${I('edit', 16)} Editar</button>` : ''}
            </div>
          </header>

          ${ev.notes ? `<div class="notice">${I('bell', 16)}<span style="white-space:pre-wrap">${esc(ev.notes)}</span></div>` : ''}

          ${App.streak.eventBanner(ev)}

          <div class="tabs" role="tablist">
            ${tabs.map(([key, label, icon, count]) => `<button role="tab" aria-selected="${vs.tab === key}" class="${vs.tab === key ? 'is-on' : ''}" data-tab="${key}">${I(icon, 15)} ${label}${count !== null && count !== 0 ? ` <span class="tag">${count}</span>` : ''}</button>`).join('')}
          </div>

          <div class="tab-body" id="tab-body">
            ${vs.tab === 'setlist' ? setlistTab(ev, leader) : ''}
            ${vs.tab === 'equipo' ? teamTab(ev, leader) : ''}
            ${vs.tab === 'escuchar' ? listenTab(ev, leader) : ''}
            ${vs.tab === 'chat' ? '<div id="event-chat"></div>' : ''}
            ${vs.tab === 'detalles' ? detailsTab(ev, leader) : ''}
          </div>
        </div>`;

      if (vs.tab === 'chat') App.chatPanel(root.querySelector('#event-chat'), ev.id, { compact: true });
      if (vs.tab === 'escuchar') ui.hydrateLinkTitles(root);

      // ---- Clicks ----
      root.addEventListener('click', async (e) => {
        const tab = e.target.closest('[data-tab]');
        if (tab) { vs.tab = tab.dataset.tab; App.app.refresh(); return; }

        const qall = e.target.closest('[data-qall]');
        if (qall) { ui.playLinks(queues[Number(qall.dataset.qall)] || []); return; }
        const pl = e.target.closest('[data-play]');
        if (pl) { const [qi, k] = pl.dataset.play.split(':').map(Number); ui.playLinks(queues[qi] || [], k || 0); return; }
        const lu = e.target.closest('[data-listen-url]');
        if (lu) { App.player.play([{ url: lu.dataset.listenUrl, title: lu.dataset.listenTitle, sub: ev.title }]); return; }
        const ls = e.target.closest('[data-listen-song]');
        if (ls) { ui.playLinks(songLinksFor(ev, ls.dataset.listenSong)); return; }
        const rml = e.target.closest('[data-remove-link]');
        if (rml) { A.removeEventLink(ev.id, rml.dataset.removeLink); ui.toast('Link quitado.'); return; }

        const open = e.target.closest('[data-open]');
        if (open) { App.viewState.song.keys[open.dataset.open] = open.dataset.key; App.router.go('cancion', open.dataset.open); return; }

        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const idx = Number(btn.dataset.idx);
        const slot = btn.dataset.slot;
        switch (btn.dataset.act) {
          case 'add-song': App.forms.songPicker(ev.id); break;
          case 'ai-setlist': App.ai.askAbout(`Sugiere un setlist para "${ev.title}" del ${U.fmtDate(ev.date, 'long')}. ${ev.notes ? 'Notas: ' + ev.notes : ''}`.trim(), ev.id); break;
          case 'stage': App.stage.openEvent(ev.id); break;
          case 'practice': App.stage.openEvent(ev.id, 0, { practice: true, music: true }); break;
          case 'share-link': App.forms.shareLink(ev.id, btn.dataset.song || null); break;
          case 'up': A.moveSong(ev.id, idx, idx - 1); break;
          case 'down': A.moveSong(ev.id, idx, idx + 1); break;
          case 'remove-song': A.removeSong(ev.id, idx); ui.toast('Canción quitada del setlist.'); break;
          case 'autofill': App.forms.autofill(ev.id); break;
          case 'remind': {
            const n = M.eventStats(ev).pending;
            ui.toast(`Recordatorio enviado a ${U.plural(n, 'persona', 'personas')} (simulado en la demo).`, { kind: 'info' });
            A.sendMessage(ev.id, `Recordatorio: por favor confirmen su asistencia para ${ev.title} (${U.fmtDate(ev.date, 'short')}).`);
            break;
          }
          case 'confirm': A.setStatus(ev.id, slot, 'confirmed'); ui.toast('Confirmado. ¡Gracias por servir!'); break;
          case 'decline': A.setStatus(ev.id, slot, 'declined'); ui.toast('Avisamos a los líderes que no puedes.', { kind: 'info' }); break;
          case 'cycle': {
            const a = ev.assignments.find((x) => x.slot === slot);
            const next = { pending: 'confirmed', confirmed: 'declined', declined: 'pending' }[a.status] || 'pending';
            A.setStatus(ev.id, slot, next);
            break;
          }
          case 'remove-slot': A.removeSlot(ev.id, slot); break;
          case 'edit': App.forms.event(ev); break;
          case 'duplicate': {
            const copy = A.duplicateEvent(ev.id);
            ui.toast(`Evento duplicado para el ${U.fmtDate(copy.date, 'short')}.`, { action: { label: 'Abrir', onClick: () => App.router.go('evento', copy.id) } });
            break;
          }
          case 'delete': {
            const ok = await ui.confirm({ title: 'Eliminar evento', message: `Se eliminará "${ev.title}" con su setlist, equipo y chat. Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar', danger: true });
            if (ok) { App.router.go('calendario'); A.deleteEvent(ev.id); ui.toast('Evento eliminado.'); }
            break;
          }
        }
      });

      // ---- Cambios en selects / notas ----
      root.addEventListener('change', (e) => {
        const t = e.target;
        if (t.dataset.swap) {
          const a = ev.assignments.find((x) => x.slot === t.dataset.swap);
          const who = a && M.member(a.memberId);
          A.changePosition(ev.id, t.dataset.swap, t.value);
          ui.toast(`${who ? who.name : 'La persona'} tocará ${M.posLabel(t.value).toLowerCase()} ese día.`);
          return;
        }
        if (t.dataset.field) { A.updateSetItem(ev.id, Number(t.dataset.idx), { [t.dataset.field]: t.value || null }); return; }
        if (t.dataset.slot) {
          A.assign(ev.id, t.dataset.slot, t.value);
          const m = M.member(t.value);
          if (m) {
            const c = M.conflicts(m.id, ev, ev.assignments.find((a) => a.slot === t.dataset.slot).position);
            ui.toast(c.length ? `${m.name} asignado. Ojo: ${c[0].label.toLowerCase()}.` : `${m.name} asignado. Queda pendiente de confirmar.`, { kind: c.length ? 'warn' : 'ok' });
          }
          return;
        }
        if (t.id === 'add-slot' && t.value) { A.addSlot(ev.id, t.value); }
      });

      const notes = root.querySelector('#ev-notes-inline');
      if (notes) {
        const save = U.debounce(() => App.store.update((s) => { s.events.find((x) => x.id === ev.id).notes = notes.value; }, { silent: true }), 400);
        notes.addEventListener('input', save);
      }

      // ---- Arrastrar para reordenar el setlist ----
      let dragFrom = null;
      root.addEventListener('dragstart', (e) => {
        const row = e.target.closest('.sl-row');
        if (!row) return;
        dragFrom = Number(row.dataset.idx);
        row.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', String(dragFrom)); } catch (err) { /* algunos navegadores */ }
      });
      root.addEventListener('dragover', (e) => {
        const row = e.target.closest('.sl-row');
        if (!row || dragFrom === null) return;
        e.preventDefault();
        root.querySelectorAll('.sl-row.is-over').forEach((r) => r.classList.remove('is-over'));
        row.classList.add('is-over');
      });
      root.addEventListener('drop', (e) => {
        const row = e.target.closest('.sl-row');
        if (!row || dragFrom === null) return;
        e.preventDefault();
        const to = Number(row.dataset.idx);
        const from = dragFrom;
        dragFrom = null;
        if (from !== to) A.moveSong(ev.id, from, to);
      });
      root.addEventListener('dragend', () => {
        dragFrom = null;
        root.querySelectorAll('.is-dragging, .is-over').forEach((r) => r.classList.remove('is-dragging', 'is-over'));
      });
    }
  };
})();
