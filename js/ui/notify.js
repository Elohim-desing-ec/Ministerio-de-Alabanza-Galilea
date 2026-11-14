/* =========================================================================
   SELAH · Avisos
   - Te asignaron un servicio → aparece para aceptar o decir que no puedes.
   - Un día antes (y el mismo día) → recordatorio de qué servicio te toca.
   - Un cantante envió el listado del culto → todos los del culto lo ven.
   - Al líder: quién dijo que no puede.
   Se ven en la campana y, si la persona lo activa, también como
   notificación del celular mientras la app está abierta o en segundo plano.
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc, A = App.actions;
  const KEY = 'selah-avisos-v1';
  let st = Object.assign({ seen: {}, popped: {}, sys: {} }, App.storage.load(KEY) || {});
  const save = () => {
    // Guardar solo lo reciente (máx. 400 claves por grupo)
    ['seen', 'popped', 'sys'].forEach((g) => { const k = Object.keys(st[g]); if (k.length > 400) k.slice(0, k.length - 400).forEach((x) => delete st[g][x]); });
    App.storage.save(KEY, st);
  };

  function items() {
    const me = M.me();
    if (!me) return [];
    const today = U.today(), tomorrow = U.ymd(U.addDays(new Date(), 1));
    const map = new Map();
    const add = (it) => { if (!map.has(it.key)) map.set(it.key, it); };
    M.myUpcoming(me.id).forEach(({ event: ev, assignment: a }) => {
      if (a.status === 'pending') add({ key: `inv:${ev.id}:${a.slot}`, kind: 'invite', ev, a });
      if (a.status !== 'declined' && (ev.date === today || ev.date === tomorrow)) add({ key: `rem:${ev.id}:${ev.date}`, kind: ev.date === today ? 'today' : 'tomorrow', ev, a });
    });
    M.upcoming({ days: 30 }).forEach((ev) => {
      if (ev.list && ev.list.by !== me.id && ev.assignments.some((a) => a.memberId === me.id && a.status !== 'declined')) {
        add({ key: `list:${ev.id}:${ev.list.at}`, kind: 'list', ev, by: M.member(ev.list.by) });
      }
    });
    if (M.isLeader(me)) {
      M.upcoming({ days: 21 }).forEach((ev) => ev.assignments.forEach((a) => {
        if (a.memberId && a.status === 'declined') add({ key: `decl:${ev.id}:${a.slot}:${a.memberId}`, kind: 'declined', ev, a, who: M.member(a.memberId) });
      }));
    }
    const order = { invite: 0, today: 1, tomorrow: 2, list: 3, declined: 4 };
    return Array.from(map.values()).sort((x, y) => (order[x.kind] - order[y.kind]) || (x.ev.date < y.ev.date ? -1 : 1));
  }

  const isNew = (it) => it.kind === 'invite' || !st.seen[it.key];
  const count = () => items().filter(isNew).length;

  // ---------------------------------------------------------------------
  // Notificaciones del celular
  // ---------------------------------------------------------------------
  const supported = () => 'Notification' in window;
  const granted = () => supported() && Notification.permission === 'granted';

  async function enable() {
    if (!supported()) {
      ui.toast(App.pwa.isIOS() ? 'En iPhone, primero instala la app (Compartir → Agregar a inicio) y ábrela desde el ícono.' : 'Este navegador no permite notificaciones.', { kind: 'info', timeout: 6000 });
      return false;
    }
    const r = await Notification.requestPermission();
    if (r === 'granted') { ui.toast('Listo: te avisaremos en este celular.'); systemNotify('Avisos activados', 'Así te llegará cuando te asignen un servicio.', 'test', '#inicio'); }
    else ui.toast('No se activaron. Puedes permitirlas desde los ajustes del navegador.', { kind: 'info' });
    App.app.renderShell();
    return r === 'granted';
  }

  async function systemNotify(title, body, tag, hash) {
    if (!granted()) return;
    const opts = { body, tag, icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', data: { url: hash || '#inicio' } };
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) { await reg.showNotification(title, opts); return; }
    } catch (e) { /* sin service worker */ }
    try { const n = new Notification(title, opts); n.onclick = () => { window.focus(); location.hash = hash || '#inicio'; }; } catch (e) { /* nada */ }
  }

  const role = (it) => (it.a ? M.posLabel(it.a.position) : '');
  const when = (ev) => `${U.relDay(ev.date)} · ${U.fmtDate(ev.date, 'short')} · ${U.fmtTime(ev.time)}`;

  function textOf(it) {
    switch (it.kind) {
      case 'invite': return { title: 'Te asignaron un servicio', body: `${it.ev.title} · ${when(it.ev)} · ${role(it)}. ¿Puedes servir?` };
      case 'tomorrow': return { title: 'Mañana te toca servir', body: `${it.ev.title} · ${U.fmtTime(it.ev.time)} · ${role(it)}` };
      case 'today': return { title: 'Hoy te toca servir', body: `${it.ev.title} · ${U.fmtTime(it.ev.time)} · ${role(it)}` };
      case 'list': return { title: 'Llegó el listado', body: `${it.by ? U.firstName(it.by.name) : 'Un cantante'} envió el listado para ${it.ev.title}. Revisa las canciones y ensaya con los links.` };
      case 'declined': return { title: 'Alguien no puede', body: `${it.who ? it.who.name : 'Alguien'} no puede en ${it.ev.title} (${U.fmtDate(it.ev.date, 'short')}) · ${role(it)}` };
      default: return { title: 'Aviso', body: '' };
    }
  }

  // ---------------------------------------------------------------------
  // Campana
  // ---------------------------------------------------------------------
  function rowHTML(it) {
    const t = textOf(it);
    const icon = { invite: 'bell', tomorrow: 'clock', today: 'clock', list: 'list', declined: 'alert' }[it.kind];
    return `
      <div class="nt-row nt-row--${it.kind} ${isNew(it) ? 'is-new' : ''}">
        <span class="nt-icon">${I(icon, 16)}</span>
        <div class="grow stack-sm">
          <span class="strong small">${esc(t.title)}</span>
          <span class="small muted">${esc(t.body)}</span>
          ${it.kind === 'invite' ? `<div class="row"><button class="btn btn--ok btn--sm" data-nt="accept" data-ev="${esc(it.ev.id)}" data-slot="${esc(it.a.slot)}">${I('check', 14)} Acepto</button><button class="btn btn--ghost btn--sm" data-nt="decline" data-ev="${esc(it.ev.id)}" data-slot="${esc(it.a.slot)}">No puedo</button><a class="btn btn--plain btn--sm" href="#evento-${esc(it.ev.id)}" data-close>Ver</a></div>`
            : it.kind === 'list' ? `<div class="row"><a class="btn btn--soft btn--sm" href="#evento-${esc(it.ev.id)}" data-close data-tab="setlist">${I('list', 14)} Ver listado</a></div>`
            : `<div class="row"><a class="btn btn--plain btn--sm" href="#evento-${esc(it.ev.id)}" data-close>Ver el culto</a></div>`}
        </div>
      </div>`;
  }

  function panel() {
    const list = items();
    const inv = list.filter((x) => x.kind === 'invite');
    const rest = list.filter((x) => x.kind !== 'invite');
    const m = ui.sheet({
      title: 'Avisos',
      body: `
        ${!granted() ? `<div class="nt-enable">${I('bell', 18)}<div class="grow stack-sm"><span class="strong small">Recibe los avisos en este celular</span><span class="xsmall muted">Cuando te asignen un servicio y un día antes de que te toque.</span></div><button class="btn btn--primary btn--sm" data-nt="enable">Activar</button></div>` : ''}
        ${inv.length ? `<section class="stack-sm"><h3 class="eyebrow">Por aceptar</h3>${inv.map(rowHTML).join('')}</section>` : ''}
        ${rest.length ? `<section class="stack-sm"><h3 class="eyebrow">Novedades</h3>${rest.map(rowHTML).join('')}</section>` : ''}
        ${!list.length ? ui.empty({ icon: 'check', title: 'Estás al día', text: 'Aquí aparecerán tus servicios por aceptar, los recordatorios y los listados.' }) : ''}`
    });
    rest.forEach((it) => { st.seen[it.key] = Date.now(); });
    save();
    App.app.renderShell();
    m.body.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab) App.viewState.event.tab = tab.dataset.tab;
      const b = e.target.closest('[data-nt]');
      if (!b) return;
      if (b.dataset.nt === 'enable') { enable().then(() => { m.close(); }); return; }
      answer(b.dataset.nt, b.dataset.ev, b.dataset.slot);
      const row = b.closest('.nt-row');
      if (row) row.innerHTML = `<span class="nt-icon">${I(b.dataset.nt === 'accept' ? 'check' : 'x', 16)}</span><span class="small strong">${b.dataset.nt === 'accept' ? '¡Gracias! Quedaste confirmado.' : 'Listo, avisamos al líder.'}</span>`;
    });
  }

  function answer(kind, evId, slot) {
    A.setStatus(evId, slot, kind === 'accept' ? 'confirmed' : 'declined');
    ui.toast(kind === 'accept' ? 'Confirmado. ¡Gracias por servir!' : 'Avisamos a los líderes que no puedes.', { kind: kind === 'accept' ? 'ok' : 'info' });
  }

  // ---------------------------------------------------------------------
  // Ventana al llegar un servicio nuevo
  // ---------------------------------------------------------------------
  let popupOpen = false;
  function popup(list) {
    if (popupOpen || !list.length || document.querySelector('.stage, .intro')) return;
    popupOpen = true;
    const m = ui.modal({
      title: list.length === 1 ? 'Te asignaron un servicio' : `Te asignaron ${list.length} servicios`,
      body: `
        <p class="small muted">Acepta para que el líder sepa que cuenta contigo.</p>
        <div class="stack-sm">${list.map((it) => `
          <div class="nt-invite" style="--tc: var(--t-${esc(it.ev.type)})">
            <div class="nt-date"><span>${U.fmtDate(it.ev.date, 'day')}</span><span>${U.fmtDate(it.ev.date, 'mon')}</span></div>
            <div class="grow stack-sm">
              <span class="strong">${esc(it.ev.title)}</span>
              <span class="small muted">${U.fmtDate(it.ev.date, 'long')} · ${U.fmtTime(it.ev.time)}</span>
              <span class="small">${I(M.groupIcon(it.a.position), 14)} ${esc(M.posLabel(it.a.position))}</span>
              <div class="row" data-row><button class="btn btn--ok btn--sm" data-nt="accept" data-ev="${esc(it.ev.id)}" data-slot="${esc(it.a.slot)}">${I('check', 14)} Acepto</button><button class="btn btn--ghost btn--sm" data-nt="decline" data-ev="${esc(it.ev.id)}" data-slot="${esc(it.a.slot)}">No puedo</button></div>
            </div>
          </div>`).join('')}</div>`,
      actions: [{ label: 'Después', kind: 'ghost' }],
      onClose: () => { popupOpen = false; }
    });
    list.forEach((it) => { st.popped[it.key] = Date.now(); });
    save();
    m.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-nt]');
      if (!b) return;
      answer(b.dataset.nt, b.dataset.ev, b.dataset.slot);
      b.closest('[data-row]').innerHTML = `<span class="small strong ${b.dataset.nt === 'accept' ? 'ok-text' : 'muted'}">${b.dataset.nt === 'accept' ? '✓ Aceptado' : 'Avisamos que no puedes'}</span>`;
    });
  }

  /** Revisa si hay algo nuevo: ventana, aviso del celular y recordatorios. */
  function check() {
    if (!App.auth.current()) return;
    const list = items();
    const fresh = list.filter((it) => it.kind === 'invite' && !st.popped[it.key]);
    if (fresh.length) popup(fresh);
    list.forEach((it) => {
      if (st.sys[it.key]) return;
      if (!['invite', 'tomorrow', 'today', 'list'].includes(it.kind)) return;
      st.sys[it.key] = Date.now();
      const t = textOf(it);
      if (document.hidden) systemNotify(t.title, t.body, it.key, `#evento-${it.ev.id}`);
      if (!document.hidden && (it.kind === 'tomorrow' || it.kind === 'today')) ui.toast(`${t.title}: ${t.body}`, { kind: 'info', timeout: 6000, action: { label: 'Ver', onClick: () => App.router.go('evento', it.ev.id) } });
      if (!document.hidden && it.kind === 'list') ui.toast(t.body, { kind: 'info', timeout: 6000, action: { label: 'Ver', onClick: () => { App.viewState.event.tab = 'setlist'; App.router.go('evento', it.ev.id); } } });
    });
    save();
  }

  const checkSoon = U.debounce(check, 900);

  App.notify = { items, count, panel, check, checkSoon, enable, granted, supported, systemNotify };
})();
