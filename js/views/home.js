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

  /** Guía para el líder mientras el ministerio se configura. */
  function onboarding() {
    const prefs = App.store.state.prefs;
    const steps = [
      { done: M.members().length > 1, title: 'Agrega a tu equipo', text: 'Cantantes, músicos y técnicos con sus instrumentos.', act: 'add-member', cta: 'Agregar persona' },
      { done: M.members().filter((m) => App.auth.accountOf(m)).length > 1, title: 'Crea sus usuarios', text: 'En Equipo, abre a cada persona y dale usuario y contraseña.', act: 'go-team', cta: 'Ir a Equipo' },
      { done: M.songs().length > 0, title: 'Importa tus canciones', text: 'Sube los PDF de LaCuerda.net con letra y acordes.', act: 'import', cta: 'Importar PDF' },
      { done: M.events().length > 0, title: 'Programa el primer servicio', text: 'Fecha, setlist y quién sirve.', act: 'new-event', cta: 'Nuevo evento' },
      { done: App.pwa.isStandalone(), title: 'Instala la app en tu celular', text: 'Queda con su ícono, sin Play Store ni App Store.', act: 'install', cta: 'Instalar' }
    ];
    const done = steps.filter((s) => s.done).length;
    if (done === steps.length || prefs.onboardingHidden) return '';
    return `
      <section class="onboard card">
        <div class="row-between">
          <div><span class="eyebrow">Primeros pasos</span><h2 class="section-title">Deja listo el ministerio</h2></div>
          <div class="row"><span class="small muted mono">${done}/${steps.length}</span><button class="btn btn--plain btn--sm" data-act="hide-onboarding">Ocultar</button></div>
        </div>
        <div class="onboard-bar"><span style="width:${(done / steps.length) * 100}%"></span></div>
        <ol class="onboard-list">${steps.map((s) => `
          <li class="onboard-step ${s.done ? 'is-done' : ''}">
            <span class="onboard-check">${s.done ? I('check', 14) : ''}</span>
            <span class="grow"><span class="strong">${esc(s.title)}</span><span class="small muted" style="display:block">${esc(s.text)}</span></span>
            ${s.done ? '' : `<button class="btn btn--ghost btn--sm" data-act="${s.act}">${esc(s.cta)}</button>`}
          </li>`).join('')}</ol>
      </section>`;
  }

  /** Mosaico de arriba: próximo servicio, equipo, racha, mes y repertorio. */
  function bento(me, leader, mine, settings) {
    const next = mine[0] || null;
    const pending = mine.filter((x) => x.assignment.status === 'pending');
    const nextAny = M.nextEvent((e) => e.assignments.some((a) => a.memberId));
    const st = nextAny ? M.eventStats(nextAny) : null;
    const pct = st && st.total ? Math.round((st.confirmed / st.total) * 100) : 0;
    const R = 40, len = 2 * Math.PI * R;
    const streak = M.streak(me.id);
    const month = U.today().slice(0, 7);
    const monthEvents = M.events().filter((e) => e.date.slice(0, 7) === month);
    const mineMonth = monthEvents.filter((e) => e.assignments.some((a) => a.memberId === me.id && a.status !== 'declined')).length;
    return `
      <section class="bento" aria-label="Resumen">
        <article class="bn bn--hero tilt">
          <div class="bn-top"><span class="eyebrow">${U.fmtDate(U.today(), 'long')}</span><span class="bn-chip">${I('logo', 13)} ${esc(settings.churchName)}</span></div>
          <h1 class="bn-hello">${U.greeting()},<br>${esc(U.firstName(me.name))}</h1>
          <p class="bn-sub">${pending.length ? `Tienes <strong>${U.plural(pending.length, 'servicio', 'servicios')}</strong> por aceptar.` : next ? 'Todo listo para tu próximo servicio.' : 'No tienes servicios asignados por ahora.'}</p>
          ${next ? `
            <a class="bn-next" href="#evento-${esc(next.event.id)}">
              <span class="bn-date"><b>${U.fmtDate(next.event.date, 'day')}</b><span>${U.fmtDate(next.event.date, 'mon')}</span></span>
              <span class="grow stack-sm"><span class="bn-cap">Tu próximo servicio</span><strong>${esc(next.event.title)}</strong><span class="small muted">${U.relDay(next.event.date)} · ${U.fmtTime(next.event.time)} · ${esc(M.posLabel(next.assignment.position))}</span></span>
              ${ui.status(next.assignment.status)}
            </a>` : ''}
          <div class="bn-actions">
            ${next && next.assignment.status === 'pending' ? `<button class="btn btn--white" data-act="confirm" data-ev="${esc(next.event.id)}" data-slot="${esc(next.assignment.slot)}">${I('check', 16)} Acepto</button>` : ''}
            ${next ? `<a class="btn ${next.assignment.status === 'pending' ? 'btn--ghost' : 'btn--white'}" href="#evento-${esc(next.event.id)}">Ver servicio ${I('arrow-right', 15)}</a>` : ''}
            ${leader ? `<button class="btn ${next ? 'btn--ghost' : 'btn--white'}" data-act="new-event">${I('plus', 16)} Nuevo evento</button>` : ''}
            <button class="btn btn--ghost" data-act="ask">${I('sparkle', 16)} Asistente</button>
          </div>
        </article>

        <a class="bn tilt" ${nextAny ? `href="#evento-${esc(nextAny.id)}"` : 'href="#calendario"'}>
          <span class="bn-cap">Equipo del próximo culto</span>
          <div class="bn-row">
            <span class="bn-ring">
              <svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="bn-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5EE7F0"/><stop offset="1" stop-color="#8B7BFF"/></linearGradient></defs>
                <circle class="track" cx="50" cy="50" r="${R}" fill="none" stroke-width="9"/>
                <circle class="bar" cx="50" cy="50" r="${R}" fill="none" stroke-width="9" stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${(len * (1 - pct / 100)).toFixed(1)}" style="--len:${len.toFixed(1)}"/></svg>
              <b>${pct}%</b>
            </span>
            <span class="stack-sm"><span class="bn-big">${st ? st.confirmed : 0}<small>/${st ? st.total : 0}</small></span><span class="bn-label">confirmados</span></span>
          </div>
          <span class="bn-foot"><span class="truncate">${nextAny ? esc(nextAny.title) + ' · ' + U.fmtDate(nextAny.date, 'short') : 'Sin cultos próximos'}</span>${I('arrow-right', 14)}</span>
        </a>

        <a class="bn tilt" href="#equipo-${esc(me.id)}">
          <span class="bn-cap">Tu racha</span>
          <div class="bn-row"><span class="flame flame--md flame--${streak.current >= 20 ? 'legend' : streak.current >= 10 ? 'blue' : streak.current >= 3 ? 'hot' : streak.current ? 'warm' : 'off'}">${App.streak.FLAME}</span><span class="bn-big">${streak.current}</span></div>
          <span class="bn-label">${streak.current === 1 ? 'servicio cumplido' : 'servicios cumplidos seguidos'}</span>
          <span class="bn-foot"><span>Mejor racha: ${streak.best}</span>${streak.level ? `<span>${streak.level.icon}</span>` : ''}</span>
        </a>

        <a class="bn tilt" href="#cronograma">
          <span class="bn-cap">Este mes</span>
          <span class="bn-big">${mineMonth}<small>/${monthEvents.length}</small></span>
          <span class="bn-label">cultos en los que sirves</span>
          <span class="bn-foot"><span>Ver el cronograma</span>${I('arrow-right', 14)}</span>
        </a>

        <a class="bn tilt" href="#estudio">
          <span class="bn-cap">Repertorio</span>
          <span class="bn-big">${M.songs().length}</span>
          <span class="bn-label">alabanzas con letra y acordes</span>
          <span class="bn-foot"><span>Ensayar en el Estudio</span>${I('arrow-right', 14)}</span>
        </a>
      </section>`;
  }

  function topSongs() {
    if (!M.songs().length) {
      return `<section class="panel"><h2 class="panel-title">${I('music', 18)} Repertorio</h2><p class="small muted">Aún no hay canciones. ${M.isLeader() ? 'Impórtalas desde los PDF de LaCuerda.net.' : 'El líder las agregará pronto.'}</p>${M.isLeader() ? `<div><button class="btn btn--soft btn--sm" data-act="import">${I('arrow-up', 14)} Importar PDF</button></div>` : ''}</section>`;
    }
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
          ${bento(me, leader, mine, settings)}

          ${leader ? onboarding() : ''}

          ${App.streak.card(me)}

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
              ${App.listado.card(me)}
              ${leader ? App.streak.pendingPanel() : ''}
              ${leader ? attentionPanel() : ''}
              ${App.streak.board(5)}
              ${topSongs()}
            </div>
          </div>
        </div>`;

      App.streak.afterCard(root, me);

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
            case 'add-member': App.forms.member(); break;
            case 'go-team': App.router.go('equipo'); break;
            case 'import': App.importer.open(); break;
            case 'install': App.pwa.install(); break;
            case 'hide-onboarding': App.store.setPref('onboardingHidden', true); break;
          }
          return;
        }
        const rank = e.target.closest('.st-rank-row[data-member]');
        if (rank) { App.router.go('equipo', rank.dataset.member); return; }
        const go = e.target.closest('[data-go]');
        if (go) { const [name, ...rest] = go.dataset.go.split('-'); App.router.go(name, rest.join('-')); }
      });
      root.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.matches('.svc-card')) e.target.click();
      });
    }
  };
})();
