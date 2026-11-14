/* =========================================================================
   SELAH · Rachas (como un juego)
   La racha no es por día: sube cada vez que una persona cumple un culto
   hasta el final y el líder lo verifica.
   - App.streak.verify(eventId)  → ventana para verificar el servicio
   - App.streak.card()           → "Tu racha" (Inicio)
   - App.streak.board(limit)     → tabla de rachas del equipo
   - App.streak.eventBanner(ev)  → aviso dentro del evento
   - ui.flame(n)                 → llamita con el número
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc;
  const SEEN_KEY = 'selah-streak-seen-v1';

  const tier = (n) => (n >= 20 ? 'legend' : n >= 10 ? 'blue' : n >= 3 ? 'hot' : n >= 1 ? 'warm' : 'off');

  const FLAME = `<svg class="flame-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.3 2.2c.5 3.1 4.7 5.3 4.7 10.3a5 5 0 0 1-10 0c0-2.4 1.2-4 2.4-5.1.2 1.6.9 2.7 2 3.3-.2-3.2.1-5.8.9-8.5z"/><path class="flame-core" d="M12 21a2.8 2.8 0 0 1-2.8-2.8c0-1.6 1.1-2.6 2.1-3.5.1 1 .6 1.6 1.2 1.9.1-.9.3-1.7.8-2.5.9 1 1.5 2.3 1.5 4.1A2.8 2.8 0 0 1 12 21z"/></svg>`;

  ui.flame = (n, size = 'sm') => `<span class="flame flame--${size} flame--${tier(n)}" title="Racha: ${n} ${n === 1 ? 'servicio cumplido' : 'servicios cumplidos'} seguidos">${FLAME}<b class="mono">${n}</b></span>`;

  function badges(best) {
    return `<div class="st-badges">${M.LEVELS.map((l) => `<span class="st-badge ${best >= l.n ? 'is-on' : ''}" title="${esc(l.name)} · ${l.n} ${l.n === 1 ? 'servicio' : 'servicios'} seguidos">${l.icon}<span>${l.n}</span></span>`).join('')}</div>`;
  }

  // ---------------------------------------------------------------------
  // "Tu racha"
  // ---------------------------------------------------------------------
  function card(member = M.me()) {
    const s = M.streak(member.id);
    const seen = App.storage.load(SEEN_KEY) || {};
    const grew = s.current > (seen[member.id] != null ? seen[member.id] : s.current);
    const pct = s.next ? Math.min(100, (s.current / s.next.n) * 100) : 100;
    const lastWin = s.history.find((h) => h.done);
    return `
      <section class="st-card ${grew ? 'is-new' : ''} st-card--${tier(s.current)}" data-streak-card="${esc(member.id)}">
        <div class="st-main">
          <div class="st-flame">${FLAME}<span class="st-num mono">${s.current}</span></div>
          <div class="stack-sm grow">
            <span class="eyebrow">Tu racha</span>
            <h2 class="st-title">${s.current ? (s.current === 1 ? '1 servicio cumplido' : `${s.current} servicios cumplidos seguidos`) : (s.total ? 'Vuelve a encender tu racha' : 'Enciende tu racha')}</h2>
            <p class="small muted">${s.current ? (lastWin ? `Último: ${esc(lastWin.event.title)} · ${U.fmtDate(lastWin.event.date, 'short')}` : '') : 'Cumple tu próximo servicio hasta el final. Cuando el líder lo verifique, suma 1.'}</p>
          </div>
        </div>
        <div class="st-progress">
          <div class="row-between xsmall"><span class="muted">${s.next ? `Faltan <strong>${s.next.n - s.current}</strong> para ${s.next.icon} ${esc(s.next.name)}` : '¡Llegaste al nivel más alto! 👑'}</span><span class="faint mono">${s.current}/${s.next ? s.next.n : s.best}</span></div>
          <div class="st-bar"><span style="width:${pct}%"></span></div>
        </div>
        <div class="st-stats">
          <span><strong class="mono">${s.best}</strong> mejor racha</span>
          <span><strong class="mono">${s.total}</strong> cumplidos</span>
          ${s.level ? `<span>${s.level.icon} ${esc(s.level.name)}</span>` : ''}
        </div>
        ${badges(s.best)}
      </section>`;
  }

  /** Marca la racha como vista; si subió, celebra. Llamar después de pintar card(). */
  function afterCard(root, member = M.me()) {
    const s = M.streak(member.id);
    const seen = App.storage.load(SEEN_KEY) || {};
    const prev = seen[member.id];
    if (prev != null && s.current > prev) {
      const leveled = M.LEVELS.find((l) => l.n > prev && l.n <= s.current);
      ui.toast(leveled ? `¡Nuevo nivel: ${leveled.icon} ${leveled.name}! Tu racha va en ${s.current}.` : `¡Tu racha subió a ${s.current}! 🔥 Gracias por servir.`);
      sparks(root.querySelector('[data-streak-card] .st-flame'));
    }
    if (prev !== s.current) { seen[member.id] = s.current; App.storage.save(SEEN_KEY, seen); }
  }

  // ---------------------------------------------------------------------
  // Tabla del equipo
  // ---------------------------------------------------------------------
  function board(limit = 0) {
    const all = M.leaderboard();
    const rows = limit ? all.slice(0, limit) : all;
    const me = M.me();
    const medal = ['🥇', '🥈', '🥉'];
    return `
      <section class="panel st-board">
        <div class="row-between"><h2 class="panel-title">${I('crown', 17)} Rachas del equipo</h2>${limit && all.length > limit ? '<a class="small" href="#equipo">Ver todas</a>' : ''}</div>
        ${rows.length ? `<ol class="st-rank">${rows.map((x, i) => `
          <li class="st-rank-row ${x.member.id === me.id ? 'is-me' : ''}" data-member="${esc(x.member.id)}">
            <span class="st-pos">${x.s.current && i < 3 ? medal[i] : `<span class="mono">${i + 1}</span>`}</span>
            ${ui.avatar(x.member, 'sm')}
            <span class="grow stack-sm"><span class="strong small truncate">${esc(x.member.name)}${x.member.id === me.id ? ' (tú)' : ''}</span><span class="xsmall faint">${x.s.total} cumplidos · mejor ${x.s.best}${x.s.level ? ' · ' + x.s.level.icon : ''}</span></span>
            ${ui.flame(x.s.current)}
          </li>`).join('')}</ol>`
          : '<p class="small muted">Todavía no hay servicios verificados. Cuando termine un culto, el líder marca quién cumplió y empiezan las rachas.</p>'}
      </section>`;
  }

  /** Cultos pendientes de verificar (para líderes). */
  function pendingPanel() {
    const list = M.toVerify().slice(0, 4);
    if (!list.length) return '';
    return `
      <section class="panel st-pending">
        <h2 class="panel-title">${FLAME.replace('flame-svg', 'flame-svg flame-svg--title')} Cultos por verificar</h2>
        <p class="small muted">Marca quién cumplió hasta el final para que sume a su racha.</p>
        <div class="stack-sm">${list.map((e) => `
          <div class="att-row">
            <div class="grow"><a class="strong" href="#evento-${esc(e.id)}">${esc(e.title)}</a><div class="xsmall muted">${U.fmtDate(e.date, 'short')} · ${U.relDay(e.date)} · ${U.plural(M.eventServers(e).length, 'persona', 'personas')}</div></div>
            <button class="btn btn--primary btn--sm" data-verify="${esc(e.id)}">${I('check', 14)} Verificar</button>
          </div>`).join('')}</div>
      </section>`;
  }

  // ---------------------------------------------------------------------
  // Aviso dentro del evento
  // ---------------------------------------------------------------------
  function eventBanner(ev) {
    const leader = M.isLeader();
    const me = M.me();
    const mine = M.eventServers(ev).some((x) => x.member.id === me.id);
    if (M.isVerified(ev)) {
      const v = ev.verified;
      const by = M.member(v.by);
      const myDone = (v.done || []).includes(me.id), myMiss = (v.missed || []).includes(me.id);
      const s = myDone ? M.streak(me.id) : null;
      return `
        <div class="st-banner is-done">
          <span class="st-banner-icon">${I('check', 18)}</span>
          <div class="grow stack-sm">
            <span class="strong">Servicio verificado · ${U.plural((v.done || []).length, 'persona cumplió', 'personas cumplieron')} hasta el final</span>
            <span class="xsmall muted">${by ? `Por ${esc(by.name)} · ` : ''}${U.timeAgo(v.at)}${(v.missed || []).length ? ` · ${(v.missed || []).length} no cumplieron` : ''}</span>
            ${myDone ? `<span class="small">Tú cumpliste ${ui.flame(s.current)} <span class="muted">tu racha va en ${s.current}</span></span>` : myMiss ? '<span class="small muted">Esta vez no se contó para tu racha. ¡La próxima la vuelves a encender!</span>' : ''}
          </div>
          ${leader ? `<button class="btn btn--ghost btn--sm" data-verify="${esc(ev.id)}">${I('edit', 14)} Editar</button>` : ''}
        </div>`;
    }
    if (!M.canVerify(ev)) return '';
    if (leader) {
      return `
        <div class="st-banner is-ask">
          <span class="st-banner-icon st-banner-icon--flame">${FLAME}</span>
          <div class="grow stack-sm">
            <span class="strong">¿Terminó el culto?</span>
            <span class="small muted">Verifica quién participó y cumplió hasta el final. Cada uno suma 1 a su racha.</span>
          </div>
          <button class="btn btn--primary btn--sm" data-verify="${esc(ev.id)}">${I('check', 14)} Verificar servicio</button>
        </div>`;
    }
    return mine ? `
      <div class="st-banner">
        <span class="st-banner-icon st-banner-icon--flame">${FLAME}</span>
        <span class="small muted grow">Cuando el líder verifique este servicio, se sumará a tu racha si cumpliste hasta el final.</span>
      </div>` : '';
  }

  // ---------------------------------------------------------------------
  // Verificar el servicio
  // ---------------------------------------------------------------------
  function verify(eventId) {
    const ev = M.event(eventId);
    if (!ev) return;
    if (!M.isLeader()) { ui.toast('Solo el líder puede verificar el servicio.', { kind: 'info' }); return; }
    const servers = M.eventServers(ev);
    const declined = ev.assignments.filter((a) => a.memberId && a.status === 'declined' && !servers.some((x) => x.member.id === a.memberId)).map((a) => M.member(a.memberId)).filter(Boolean);
    const prevV = ev.verified || null;
    const marks = {};
    servers.forEach((x) => { marks[x.member.id] = prevV ? !(prevV.missed || []).includes(x.member.id) : true; });

    const m = ui.modal({
      title: prevV ? 'Editar verificación' : 'Verificar servicio',
      size: 'lg',
      body: `
        <div class="vf-head">
          <span class="vf-flame">${FLAME}</span>
          <div class="stack-sm">
            <span class="strong">${esc(ev.title)}</span>
            <span class="small muted">${U.fmtDate(ev.date, 'long')} · ${U.fmtTime(ev.time)}</span>
            <span class="small muted">Marca quién participó y cumplió hasta el final. Cada ✓ suma 1 a su racha; ✗ la reinicia.</span>
          </div>
        </div>
        <div class="row-between">
          <span class="small"><strong class="mono" id="vf-count"></strong></span>
          <div class="row"><button type="button" class="btn btn--ghost btn--sm" data-all="1">${I('check', 13)} Todos cumplieron</button></div>
        </div>
        <div class="card vf-list">${servers.map((x) => {
          const s = M.streak(x.member.id);
          return `
            <div class="vf-row" data-row="${esc(x.member.id)}">
              ${ui.avatar(x.member, 'sm')}
              <div class="grow stack-sm"><span class="strong small truncate">${esc(x.member.name)}</span><span class="xsmall faint">${x.positions.map((p) => esc(M.posLabel(p))).join(' · ')}${x.status === 'pending' ? ' · no confirmó' : ''}</span></div>
              <span class="vf-streak" data-streak="${esc(x.member.id)}" data-base="${prevV && (prevV.done || []).includes(x.member.id) ? s.current - 1 : s.current}"></span>
              <div class="vf-seg" role="group" aria-label="${esc(x.member.name)}">
                <button type="button" data-mark="done" data-mid="${esc(x.member.id)}">${I('check', 14)}<span>Cumplió</span></button>
                <button type="button" data-mark="missed" data-mid="${esc(x.member.id)}">${I('x', 14)}<span>No</span></button>
              </div>
            </div>`;
        }).join('')}</div>
        ${declined.length ? `<p class="xsmall faint">Avisaron que no podían (no afecta su racha): ${declined.map((d) => esc(d.name)).join(', ')}.</p>` : ''}
        <label class="check"><input type="checkbox" id="vf-announce" ${prevV ? '' : 'checked'}> <span>Anunciar en el chat general</span></label>`,
      actions: [
        ...(prevV ? [{ label: 'Quitar verificación', kind: 'danger', spacer: true, onClick: async () => {
          const ok = await ui.confirm({ title: 'Quitar verificación', message: 'Las rachas se recalculan como si este servicio no se hubiera verificado.', confirmLabel: 'Quitar', danger: true });
          if (ok) { App.actions.unverifyEvent(ev.id); ui.toast('Verificación quitada.'); return true; }
          return false;
        } }] : []),
        { label: 'Cancelar', kind: 'ghost' },
        {
          label: prevV ? 'Guardar cambios' : 'Verificar servicio', kind: 'primary', icon: 'check',
          onClick: (api) => {
            const done = servers.filter((x) => marks[x.member.id]).map((x) => x.member.id);
            const missed = servers.filter((x) => !marks[x.member.id]).map((x) => x.member.id);
            const before = {};
            servers.forEach((x) => { before[x.member.id] = M.streak(x.member.id); });
            const announce = api.body.querySelector('#vf-announce').checked;
            App.actions.verifyEvent(ev.id, { done, missed });
            if (announce && done.length) App.actions.sendMessage('general', `🔥 ${ev.title} (${U.fmtDate(ev.date, 'short')}) verificado: ${U.plural(done.length, 'persona cumplió', 'personas cumplieron')} hasta el final. ¡Gracias, equipo! Cada uno suma a su racha.`);
            setTimeout(() => celebrate(ev.id, before), 260);
          }
        }
      ]
    });

    const paint = () => {
      servers.forEach((x) => {
        const id = x.member.id;
        const row = m.body.querySelector(`[data-row="${CSS.escape(id)}"]`);
        row.classList.toggle('is-missed', !marks[id]);
        row.querySelector('[data-mark="done"]').classList.toggle('is-on', marks[id]);
        row.querySelector('[data-mark="missed"]').classList.toggle('is-on', !marks[id]);
        const st = row.querySelector('[data-streak]');
        const base = Number(st.dataset.base);
        st.innerHTML = marks[id] ? `${ui.flame(base)}<span class="vf-arrow">→</span>${ui.flame(base + 1)}` : `${ui.flame(base)}<span class="vf-arrow">→</span>${ui.flame(0)}`;
      });
      const n = servers.filter((x) => marks[x.member.id]).length;
      m.body.querySelector('#vf-count').textContent = `${n}/${servers.length} cumplieron`;
    };
    paint();
    m.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mark]');
      if (b) { marks[b.dataset.mid] = b.dataset.mark === 'done'; paint(); return; }
      if (e.target.closest('[data-all]')) { servers.forEach((x) => { marks[x.member.id] = true; }); paint(); }
    });
  }

  // ---------------------------------------------------------------------
  // Celebración
  // ---------------------------------------------------------------------
  function sparks(anchor) {
    if (!anchor || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const box = document.createElement('span');
    box.className = 'sparks';
    box.innerHTML = Array.from({ length: 14 }, (_, i) => `<i style="--a:${(i / 14) * 360}deg;--d:${40 + (i % 3) * 18}px;--c:${['#FBBF24', '#F97316', '#5EE7F0', '#8B8CFF'][i % 4]}"></i>`).join('');
    anchor.appendChild(box);
    setTimeout(() => box.remove(), 1200);
  }

  function celebrate(eventId, before) {
    const ev = M.event(eventId);
    if (!ev || !M.isVerified(ev)) return;
    const done = (ev.verified.done || []).map((id) => ({ m: M.member(id), b: before[id], a: M.streak(id) })).filter((x) => x.m);
    const ups = done.map((x) => ({ ...x, lvl: M.LEVELS.find((l) => l.n > (x.b ? x.b.current : 0) && l.n <= x.a.current) })).sort((p, q) => q.a.current - p.a.current);
    const m = ui.modal({
      title: '¡Servicio verificado!',
      className: 'st-celebrate',
      body: `
        <div class="cel-hero">
          <span class="cel-flame">${FLAME}</span>
          <p class="cel-big">${done.length ? `+1 para ${U.plural(done.length, 'persona', 'personas')}` : 'Verificado'}</p>
          <p class="small muted">${esc(ev.title)} · ${U.fmtDate(ev.date, 'short')}</p>
        </div>
        ${ups.length ? `<div class="cel-list">${ups.slice(0, 12).map((x) => `
          <div class="cel-row">
            ${ui.avatar(x.m, 'sm')}
            <span class="grow strong small truncate">${esc(x.m.name)}</span>
            ${x.lvl ? `<span class="cel-lvl">${x.lvl.icon} ${esc(x.lvl.name)}</span>` : ''}
            ${ui.flame(x.a.current)}
          </div>`).join('')}${ups.length > 12 ? `<p class="xsmall faint">y ${ups.length - 12} más…</p>` : ''}</div>` : ''}`,
      actions: [{ label: '¡Gloria a Dios!', kind: 'primary' }]
    });
    sparks(m.body.querySelector('.cel-flame'));
  }

  // Botones [data-verify] en cualquier pantalla
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-verify]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    verify(b.dataset.verify);
  }, true);

  App.streak = { verify, card, afterCard, board, pendingPanel, eventBanner, celebrate, FLAME };
})();
