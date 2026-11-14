/* =========================================================================
   SELAH · Vista: Agenda (calendario mensual + lista)
   Incluye el modo "Mis fechas no disponibles" para que cada persona
   bloquee los días en que no puede servir.
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc;

  const vs = App.viewState.calendar = {
    month: U.today().slice(0, 7),
    mode: 'mes',
    team: 'all',
    selected: U.today(),
    blocking: false
  };

  const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const filtered = (list) => (vs.team === 'all' ? list : list.filter((e) => e.teamId === vs.team));

  function monthGrid() {
    const [y, m] = vs.month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    const rows = Math.ceil((offset + daysInMonth) / 7);
    const start = U.addDays(first, -offset);
    const today = U.today();
    const me = M.me();

    let cells = '';
    for (let i = 0; i < rows * 7; i++) {
      const day = U.ymd(U.addDays(start, i));
      const out = day.slice(0, 7) !== vs.month;
      const evs = filtered(M.eventsOn(day));
      const blocked = (me.unavailable || []).includes(day);
      const mine = evs.some((e) => e.assignments.some((a) => a.memberId === me.id));
      cells += `
        <div class="cal-cell ${out ? 'is-out' : ''} ${day === today ? 'is-today' : ''} ${day === vs.selected ? 'is-selected' : ''} ${blocked ? 'is-blocked' : ''} ${day < today ? 'is-past' : ''}" data-day="${day}" role="gridcell" tabindex="0" aria-label="${U.fmtDate(day, 'long')}${evs.length ? ', ' + U.plural(evs.length, 'evento', 'eventos') : ''}${blocked ? ', no disponible' : ''}">
          <div class="cal-num-row"><span class="cal-num">${U.fmtDate(day, 'day')}</span>${mine ? `<span class="cal-mine" title="Sirves este día">${I('mic', 12)}</span>` : ''}${blocked ? `<span class="cal-block" title="No disponible">${I('block', 12)}</span>` : ''}</div>
          <div class="cal-evs">
            ${evs.slice(0, 3).map((e) => `<button class="cal-ev" style="--tc: var(--t-${esc(e.type)})" data-ev="${esc(e.id)}"><span class="cal-ev-time">${U.fmtTime(e.time).replace(/\s?[ap]\. m\./, '')}</span><span class="cal-ev-title">${esc(e.title)}</span></button>`).join('')}
            ${evs.length > 3 ? `<span class="cal-more">+${evs.length - 3} más</span>` : ''}
          </div>
          <div class="cal-dots">${evs.map((e) => `<span style="--tc: var(--t-${esc(e.type)})"></span>`).join('')}</div>
        </div>`;
    }
    return `
      <div class="cal" role="grid">
        <div class="cal-dow">${DOW.map((d) => `<span>${d}</span>`).join('')}</div>
        <div class="cal-grid">${cells}</div>
      </div>`;
  }

  function dayPanel() {
    const day = vs.selected;
    const evs = filtered(M.eventsOn(day));
    const me = M.me();
    const blocked = (me.unavailable || []).includes(day);
    const leader = M.isLeader();
    return `
      <section class="panel day-panel">
        <div class="row-between">
          <div>
            <span class="eyebrow">${U.relDay(day)}</span>
            <h2 class="panel-title">${U.fmtDate(day, 'long')}</h2>
          </div>
          <div class="row">
            <button class="btn btn--ghost btn--sm" data-act="toggle-block" data-day="${day}">${I('block', 14)} ${blocked ? 'Estoy disponible' : 'No puedo este día'}</button>
            ${leader ? `<button class="btn btn--soft btn--sm" data-act="new" data-day="${day}">${I('plus', 14)} Evento</button>` : ''}
          </div>
        </div>
        ${blocked ? `<div class="notice notice--warn">${I('block', 16)}<span>Marcaste este día como no disponible. Los líderes lo verán al asignar.</span></div>` : ''}
        ${evs.length ? evs.map((e) => {
          const st = M.eventStats(e);
          const mine = e.assignments.filter((a) => a.memberId === me.id);
          return `
            <a class="day-ev" href="#evento-${esc(e.id)}" style="--tc: var(--t-${esc(e.type)})">
              <span class="day-ev-bar"></span>
              <div class="grow stack-sm">
                <div class="row-between"><span class="strong">${esc(e.title)}</span>${ui.typeTag(e.type)}</div>
                <span class="xsmall muted">${U.fmtTime(e.time)}${e.place ? ' · ' + esc(e.place) : ''} · ${st.confirmed}/${st.total} confirmados</span>
                ${mine.length ? `<span class="xsmall strong" style="color: var(--accent-text)">Sirves como ${mine.map((a) => esc(M.posLabel(a.position))).join(', ')}</span>` : ''}
              </div>
              ${I('chevron-right', 16)}
            </a>`;
        }).join('') : '<p class="small muted">No hay eventos este día.</p>'}
      </section>`;
  }

  function listView() {
    const list = filtered(M.upcoming({ days: 90 }));
    if (!list.length) return ui.empty({ icon: 'calendar', title: 'Sin eventos en los próximos 90 días' });
    let lastMonth = '';
    return `<div class="stack">${list.map((e) => {
      const month = e.date.slice(0, 7);
      const head = month !== lastMonth ? `<h3 class="eyebrow list-month">${U.fmtDate(e.date, 'month')}</h3>` : '';
      lastMonth = month;
      const st = M.eventStats(e);
      return `${head}
        <a class="card ag-row" href="#evento-${esc(e.id)}" style="--tc: var(--t-${esc(e.type)})">
          <div class="ag-date"><span class="ag-day">${U.fmtDate(e.date, 'day')}</span><span class="xsmall faint">${U.fmtDate(e.date, 'weekday')}</span></div>
          <div class="grow stack-sm">
            <div class="row-between"><span class="strong">${esc(e.title)}</span>${ui.typeTag(e.type)}</div>
            <span class="xsmall muted">${U.fmtTime(e.time)}${e.place ? ' · ' + esc(e.place) : ''}${M.team(e.teamId) ? ' · ' + esc(M.team(e.teamId).name) : ''} · ${U.plural(e.setlist.length, 'canción', 'canciones')}</span>
            ${ui.progress(st)}
          </div>
        </a>`;
    }).join('')}</div>`;
  }

  App.views.calendario = {
    title: 'Agenda',
    render(root) {
      const leader = M.isLeader();
      const [y, m] = vs.month.split('-').map(Number);
      root.innerHTML = `
        <div class="view view--calendar">
          <header class="view-head">
            <div class="titles">
              <span class="eyebrow">Agenda del ministerio</span>
              <h1 class="view-title">${U.fmtDate(`${vs.month}-01`, 'month')}</h1>
            </div>
            <div class="view-actions">
              <button class="btn ${vs.blocking ? 'btn--primary' : 'btn--ghost'}" data-act="blocking">${I('block', 16)} ${vs.blocking ? 'Listo' : 'Mis fechas no disponibles'}</button>
              ${leader ? `<button class="btn btn--primary" data-act="new" data-day="${vs.selected}">${I('plus', 16)} Nuevo evento</button>` : ''}
            </div>
          </header>

          <div class="cal-toolbar">
            <div class="row">
              <button class="btn btn--ghost btn--icon btn--sm" data-act="prev" aria-label="Mes anterior">${I('chevron-left', 16)}</button>
              <button class="btn btn--ghost btn--sm" data-act="today">Hoy</button>
              <button class="btn btn--ghost btn--icon btn--sm" data-act="next" aria-label="Mes siguiente">${I('chevron-right', 16)}</button>
            </div>
            <div class="chip-row chip-row--scroll grow">
              <button class="chip ${vs.team === 'all' ? 'is-on' : ''}" data-team="all">Todos los equipos</button>
              ${M.teams().map((t) => `<button class="chip ${vs.team === t.id ? 'is-on' : ''}" data-team="${esc(t.id)}">${esc(t.name)}</button>`).join('')}
            </div>
            <div class="seg" role="group" aria-label="Vista">
              <button class="${vs.mode === 'mes' ? 'is-on' : ''}" data-mode="mes">${I('grid', 14)} Mes</button>
              <button class="${vs.mode === 'lista' ? 'is-on' : ''}" data-mode="lista">${I('list', 14)} Lista</button>
            </div>
          </div>

          ${vs.blocking ? `<div class="notice notice--warn">${I('block', 16)}<span>Toca los días en que <strong>no</strong> puedes servir. Toca otra vez para quitar el bloqueo.</span></div>` : ''}

          ${vs.mode === 'mes' ? `
            <div class="cal-layout">
              ${monthGrid()}
              ${dayPanel()}
            </div>
            <div class="cal-legend">${Object.keys(App.config.eventTypes).map((t) => ui.typeTag(t)).join('')}<span class="xsmall faint row">${I('block', 12)} No disponible</span><span class="xsmall faint row">${I('mic', 12)} Sirves</span></div>`
            : listView()}
        </div>`;

      root.addEventListener('click', (e) => {
        const t = e.target;
        const evBtn = t.closest('[data-ev]');
        if (evBtn && !vs.blocking) { App.router.go('evento', evBtn.dataset.ev); return; }

        const act = t.closest('[data-act]');
        if (act) {
          const a = act.dataset.act;
          if (a === 'prev' || a === 'next') {
            const d = new Date(y, m - 1 + (a === 'next' ? 1 : -1), 1);
            vs.month = U.ymd(d).slice(0, 7);
            vs.selected = U.ymd(d);
          } else if (a === 'today') {
            vs.month = U.today().slice(0, 7);
            vs.selected = U.today();
          } else if (a === 'blocking') {
            vs.blocking = !vs.blocking;
            vs.mode = 'mes';
          } else if (a === 'new') {
            App.forms.event(null, { date: act.dataset.day });
            return;
          } else if (a === 'toggle-block') {
            const blocked = App.actions.toggleUnavailable(M.me().id, act.dataset.day);
            ui.toast(blocked ? 'Día marcado como no disponible.' : 'Vuelves a estar disponible ese día.', { kind: blocked ? 'info' : 'ok' });
            return;
          }
          App.app.refresh();
          return;
        }

        const team = t.closest('[data-team]');
        if (team) { vs.team = team.dataset.team; App.app.refresh(); return; }
        const mode = t.closest('[data-mode]');
        if (mode) { vs.mode = mode.dataset.mode; App.app.refresh(); return; }

        const cell = t.closest('[data-day]');
        if (cell && cell.classList.contains('cal-cell')) {
          const day = cell.dataset.day;
          if (vs.blocking) {
            App.actions.toggleUnavailable(M.me().id, day);
            return;
          }
          vs.selected = day;
          if (day.slice(0, 7) !== vs.month) vs.month = day.slice(0, 7);
          App.app.refresh();
        }
      });

      root.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('cal-cell')) e.target.click();
      });
    }
  };
})();
