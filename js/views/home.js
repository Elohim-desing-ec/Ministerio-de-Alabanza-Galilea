/* =========================================================================
   SELAH · Vista: Inicio
   Lo que cada persona necesita ver al abrir la app: sus servicios por
   confirmar, la semana y (si es líder) lo que necesita atención.
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc;

  /** Si la persona toca varios instrumentos, puede elegir cuál toca ese día. */
  function swapFor(ev, a) {
    const m = M.member(a.memberId);
    if (!m || m.roles.length < 2) return '';
    return `<label class="svc-swap"><span class="xsmall muted">Ese día quiero tocar</span>
      <select class="select select--sm" data-swap="${esc(a.slot)}" data-ev="${esc(ev.id)}">${m.roles.map((r) => `<option value="${r}" ${r === a.position ? 'selected' : ''}>${esc(M.posLabel(r))}</option>`).join('')}</select></label>`;
  }

  function serviceCard({ event: ev, assignment: a }) {
    const pending = a.status === 'pending';
    return `
      <article class="svc-card ${pending ? 'is-pending' : ''}" data-go="evento-${esc(ev.id)}" tabindex="0">
        <div class="svc-top">
          <div class="svc-date"><span class="svc-day">${U.fmtDate(ev.date, 'day')}</span><span class="svc-mon">${U.fmtDate(ev.date, 'mon')}</span></div>
          <div class="svc-info">
            ${ui.typeTag(ev.type)}
            <h3 class="svc-title">${esc(ev.title)}</h3>
            <p class="small muted">${U.fmtDate(ev.date, 'short')} · ${U.fmtTime(ev.time)}${ev.place ? ' · ' + esc(ev.place) : ''}</p>
          </div>
        </div>
        <div class="svc-role">${I(M.groupIcon(a.position), 16)}<span>${esc(M.slotLabel(ev, a))}</span><span class="faint">· ${U.relDay(ev.date)}</span></div>
        ${swapFor(ev, a)}
        <footer class="svc-foot">
          ${pending ? `
            <button class="btn btn--ok btn--sm" data-act="confirm" data-ev="${esc(ev.id)}" data-slot="${esc(a.slot)}">${I('check', 15)} Confirmar</button>
            <button class="btn btn--ghost btn--sm" data-act="decline" data-ev="${esc(ev.id)}" data-slot="${esc(a.slot)}">No puedo</button>`
            : `${ui.status(a.status)}<button class="btn btn--plain btn--sm" data-act="${a.status === 'confirmed' ? 'decline' : 'confirm'}" data-ev="${esc(ev.id)}" data-slot="${esc(a.slot)}">${a.status === 'confirmed' ? 'Ya no puedo' : 'Sí puedo'}</button>`}
        </footer>
      </article>`;
  }

  function weekStrip() {
    const start = U.parseYmd(U.today());
    const me = M.me();
    return Array.from({ length: 7 }, (_, i) => {
      const day = U.ymd(U.addDays(start, i));
      const evs = M.eventsOn(day);
      const mine = evs.some((e) => e.assignments.some((a) => a.memberId === me.id));
      return `
        <div class="wk-day ${i === 0 ? 'is-today' : ''} ${mine ? 'is-mine' : ''}">
          <div class="wk-head"><span class="wk-dow">${U.fmtDate(day, 'weekday')}</span><span class="wk-num">${U.fmtDate(day, 'day')}</span></div>
          <div class="wk-events">
            ${evs.length ? evs.map((e) => `<button class="wk-ev" style="--tc: var(--t-${esc(e.type)})" data-go="evento-${esc(e.id)}"><span class="wk-time">${U.fmtTime(e.time)}</span><span class="wk-title">${esc(e.title)}</span></button>`).join('') : '<span class="wk-none">—</span>'}
          </div>
        </div>`;
    }).join('');
  }

  function upcomingList() {
    const list = M.upcoming({ days: 30 }).slice(0, 6);
    if (!list.length) return ui.empty({ icon: 'calendar', title: 'No hay eventos próximos', text: 'Crea un servicio o ensayo desde la agenda.' });
    return `<div class="card list">${list.map((ev) => {
      const st = M.eventStats(ev);
      const team = M.team(ev.teamId);
      return `
        <div class="list-row list-row--link up-row" data-go="evento-${esc(ev.id)}">
          <div class="up-date"><span class="mono">${U.fmtDate(ev.date, 'day')}</span><span class="xsmall faint">${U.fmtDate(ev.date, 'mon')}</span></div>
          <div class="grow stack-sm">
            <div class="row-between"><span class="strong truncate">${esc(ev.title)}</span>${ui.typeTag(ev.type)}</div>
            <div class="xsmall muted">${U.fmtDate(ev.date, 'short')} · ${U.fmtTime(ev.time)}${team ? ' · ' + esc(team.name) : ''} · ${U.plural(ev.setlist.length, 'canción', 'canciones')}</div>
            ${ui.progress(st)}
            <div class="xsmall faint">${st.confirmed}/${st.total} confirmados${st.pending ? ` · ${st.pending} pendientes` : ''}${st.empty ? ` · ${st.empty} sin asignar` : ''}${st.declined ? ` · ${st.declined} no pueden` : ''}</div>
          </div>
        </div>`;
    }).join('')}</div>`;
  }

  function attentionPanel() {
    const items = M.attention(21);
    const byEvent = new Map();
    items.forEach((it) => {
      if (!byEvent.has(it.event.id)) byEvent.set(it.event.id, { event: it.event, empty: 0, declined: 0 });
      byEvent.get(it.event.id)[it.kind]++;
    });
    const rows = Array.from(byEvent.values()).slice(0, 5);
    return `
      <section class="panel">
        <h2 class="panel-title">${I('alert', 18)} Necesita atención</h2>
        ${rows.length ? `<div class="stack-sm">${rows.map((r) => `
          <div class="att-row">
            <div class="grow">
              <a class="strong" href="#evento-${esc(r.event.id)}">${esc(r.event.title)}</a>
              <div class="xsmall muted">${U.fmtDate(r.event.date, 'short')} · ${r.empty ? `${r.empty} sin asignar` : ''}${r.empty && r.declined ? ' · ' : ''}${r.declined ? `<span class="bad-text">${r.declined} no puede${r.declined > 1 ? 'n' : ''}</span>` : ''}</div>
            </div>
            <button class="btn btn--soft btn--sm" data-act="autofill" data-ev="${esc(r.event.id)}">${I('sparkle', 14)} Completar</button>
          </div>`).join('')}</div>` : '<p class="small muted">Todo el equipo de las próximas 3 semanas está asignado.</p>'}
      </section>`;
  }

  function topSongs() {
    const ranked = M.songs().map((s) => ({ s, n: M.songUseCount(s.id, 90) })).sort((a, b) => b.n - a.n).slice(0, 5);
    return `
      <section class="panel">
        <div class="row-between"><h2 class="panel-title">${I('music', 18)} Más cantadas</h2><a class="small" href="#canciones">Ver todas</a></div>
        <div class="stack-sm">${ranked.map(({ s, n }) => `
          <a class="song-mini" href="#cancion-${esc(s.id)}">
            ${ui.keyBadge(s.key)}
            <span class="grow truncate strong">${esc(s.title)}</span>
            <span class="xsmall faint">${n}× en 90 días</span>
          </a>`).join('')}</div>
      </section>`;
  }

  App.views.inicio = {
    title: 'Inicio',
    render(root) {
      const me = M.me();
      const leader = M.isLeader(me);
      const mine = M.myUpcoming(me.id).slice(0, 6);
      const pending = mine.filter((x) => x.assignment.status === 'pending').length;
      const settings = M.settings();

      root.innerHTML = `
        <div class="view view--home">
          <header class="view-head">
            <div class="titles">
              <span class="eyebrow">${U.fmtDate(U.today(), 'long')}</span>
              <h1 class="view-title">${U.greeting()}, ${esc(U.firstName(me.name))}</h1>
              <p class="muted">${esc(settings.churchName)} · ${esc(settings.ministryName)}</p>
            </div>
            <div class="view-actions">
              <button class="btn btn--soft" data-act="ask">${I('sparkle', 16)} Preguntar al asistente</button>
              ${leader ? `<button class="btn btn--primary" data-act="new-event">${I('plus', 16)} Nuevo evento</button>` : ''}
            </div>
          </header>

          <section class="section">
            <div class="section-head">
              <h2 class="section-title">Tus próximos servicios</h2>
              <span class="small ${pending ? 'warn-text' : 'faint'}">${pending ? `${U.plural(pending, 'confirmación pendiente', 'confirmaciones pendientes')}` : `${U.plural(mine.length, 'asignación', 'asignaciones')}`}</span>
            </div>
            ${mine.length ? `<div class="grid-cards">${mine.map(serviceCard).join('')}</div>`
              : ui.empty({ icon: 'calendar', title: 'No tienes servicios asignados', text: 'Cuando un líder te asigne a un evento aparecerá aquí para que confirmes.' })}
          </section>

          <section class="section">
            <div class="section-head"><h2 class="section-title">Esta semana</h2><a class="small" href="#calendario">Abrir agenda</a></div>
            <div class="week-strip">${weekStrip()}</div>
          </section>

          <div class="cols-2">
            <section class="section">
              <div class="section-head"><h2 class="section-title">Próximos eventos del ministerio</h2></div>
              ${upcomingList()}
            </section>
            <div class="stack">
              ${leader ? attentionPanel() : ''}
              ${topSongs()}
            </div>
          </div>
        </div>`;

      root.addEventListener('change', (e) => {
        const sel = e.target.closest('[data-swap]');
        if (!sel) return;
        App.actions.changePosition(sel.dataset.ev, sel.dataset.swap, sel.value);
        ui.toast(`Listo: ese día tocas ${M.posLabel(sel.value).toLowerCase()}.`);
      });

      root.addEventListener('click', (e) => {
        if (e.target.closest('select, .svc-swap')) return;
        const act = e.target.closest('[data-act]');
        if (act) {
          e.stopPropagation();
          const { ev, slot } = act.dataset;
          switch (act.dataset.act) {
            case 'confirm':
              App.actions.setStatus(ev, slot, 'confirmed');
              ui.toast('Confirmado. ¡Gracias por servir!');
              break;
            case 'decline':
              App.actions.setStatus(ev, slot, 'declined');
              ui.toast('Avisamos a los líderes que no puedes.', { kind: 'info' });
              break;
            case 'new-event':
              App.forms.event();
              break;
            case 'ask':
              App.router.go('asistente');
              break;
            case 'autofill':
              App.forms.autofill(ev);
              break;
          }
          return;
        }
        const go = e.target.closest('[data-go]');
        if (go) { const [name, ...rest] = go.dataset.go.split('-'); App.router.go(name, rest.join('-')); }
      });
      root.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.matches('.svc-card')) e.target.click();
      });
    }
  };
})();
