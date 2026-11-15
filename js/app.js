/* =========================================================================
   SELAH · Arranque, navegación y estructura de la app
   Rutas por hash: #inicio, #calendario, #evento-e4, #canciones,
   #cancion-s1, #escuchar, #equipo, #equipo-m3, #chat, #asistente, #ajustes
   Para agregar una pantalla: crea js/views/mi-vista.js con
   App.views['mivista'] = { title, render(root, param, ctx) } y enlázala.
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc;

  const NAV = [
    { route: 'inicio', label: 'Inicio', icon: 'home', match: ['inicio'] },
    { route: 'calendario', label: 'Agenda', icon: 'calendar', match: ['calendario', 'evento'] },
    { route: 'cronograma', label: 'Cronograma', icon: 'columns', match: ['cronograma'], more: true },
    { route: 'canciones', label: 'Canciones', icon: 'music', match: ['canciones', 'cancion'] },
    { route: 'escuchar', label: 'Escuchar', icon: 'headphones', match: ['escuchar'] },
    { route: 'estudio', label: 'Estudio', icon: 'wave', match: ['estudio'], more: true },
    { route: 'chat', label: 'Chat', icon: 'chat', match: ['chat'] },
    { route: 'equipo', label: 'Equipo', icon: 'users', match: ['equipo'], more: true },
    { route: 'asistente', label: 'Asistente', icon: 'sparkle', match: ['asistente'], more: true }
  ];
  // En el celular, Equipo, Asistente y Ajustes van en "Más"
  const MORE = NAV.filter((n) => n.more).map((n) => n.route).concat('ajustes');

  const main = document.getElementById('view');
  let current = { name: null, param: null };

  function parseHash() {
    const h = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    const m = /^([a-z]+)(?:-([A-Za-z0-9]+))?$/.exec(h);
    if (!m || !App.views[m[1]]) return { name: 'inicio', param: null };
    return { name: m[1], param: m[2] || null };
  }

  function render(entering) {
    const next = parseHash();
    const changed = entering || next.name !== current.name || next.param !== current.param;
    if (changed && current.name && App.views[current.name] && App.views[current.name].onLeave) App.views[current.name].onLeave();
    current = next;
    const view = App.views[current.name];
    const y = window.scrollY;
    const root = document.createElement('div');
    if (changed) root.className = 'view-enter';
    main.replaceChildren(root);
    try {
      view.render(root, current.param, { entering: changed });
    } catch (err) {
      console.error(err);
      root.innerHTML = `<div class="view">${ui.empty({ icon: 'alert', title: 'Algo salió mal en esta pantalla', text: err.message, action: '<a class="btn btn--primary" href="#inicio">Volver al inicio</a>' })}</div>`;
    }
    if (changed) {
      window.scrollTo(0, 0);
      document.title = `${view.title} · ${App.config.siteTitle}`;
    } else {
      window.scrollTo(0, y);
    }
    markNav();
  }

  function markNav() {
    U.$$('[data-route]').forEach((a) => {
      const item = NAV.find((n) => n.route === a.dataset.route);
      const on = a.dataset.route === 'mas' ? MORE.includes(current.name) : item ? item.match.includes(current.name) : a.dataset.route === current.name;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function renderShell() {
    const me = M.me();
    const pending = M.myPendingCount();
    const s = M.settings();

    const unread = App.chatUnread ? App.chatUnread() : 0;
    const badge = (n) => (n.route === 'inicio' && pending ? `<span class="nav-count" title="Confirmaciones pendientes">${pending}</span>`
      : n.route === 'chat' && unread ? `<span class="nav-count nav-count--chat" title="Mensajes sin leer">${unread > 99 ? '99+' : unread}</span>` : '');

    U.$('#nav').innerHTML = NAV.map((n) => `
      <a class="nav-item" href="#${n.route}" data-route="${n.route}">${I(n.icon, 18)}<span>${n.label}</span>${badge(n)}</a>`).join('');

    U.$('#tabbar').innerHTML = NAV.filter((n) => !n.more).map((n) => `
      <a class="tab" href="#${n.route}" data-route="${n.route}"><span class="tab-icon">${I(n.icon, 20)}${n.route === 'chat' && unread ? '<span class="tab-dot"></span>' : ''}${n.route === 'inicio' && pending ? '<span class="tab-dot tab-dot--warn"></span>' : ''}</span><span>${n.label}</span></a>`).join('') +
      `<button class="tab" type="button" data-route="mas" id="tab-more">${I('more', 20)}<span>Más</span></button>`;

    U.$('#brand-sub').textContent = s.churchName;
    const avisos = App.notify ? App.notify.count() : 0;
    U.$$('[data-bell-count]').forEach((b) => { b.hidden = !avisos; b.textContent = avisos > 9 ? '9+' : avisos; });

    const chip = `${ui.avatar(me, 'sm')}<span class="uc-text"><span class="uc-name truncate">${esc(me.name)}</span><span class="uc-role">${M.isLeader(me) ? 'Líder de alabanza' : me.roles.map(M.posLabel).slice(0, 2).join(' · ')}</span></span>${I('chevron-up', 16)}`;
    U.$('#user-chip').innerHTML = chip;
    U.$('#top-user').innerHTML = ui.avatar(me, 'sm');
    markNav();
  }

  /** Menú de la persona: cerrar sesión y (solo líderes) ver la app como otra persona. */
  function userMenu() {
    const me = M.me();
    const session = App.auth.current();
    const realId = session ? session.memberId : me.id;
    const real = M.member(realId) || me;
    const canPreview = M.isLeader(real);
    const members = M.members().slice().sort((a, b) => (M.isLeader(b) - M.isLeader(a)) || a.name.localeCompare(b.name));
    const m = ui.sheet({
      title: real.name,
      body: `
        <div class="ms-head">${ui.avatar(real, 'xl')}<div class="stack-sm"><span class="strong">${esc(real.name)}</span><span class="small muted">${M.isLeader(real) ? 'Líder de alabanza' : real.roles.map(M.posLabel).join(', ')}${session ? ` · usuario <span class="mono">${esc(session.username)}</span>` : ''}</span></div></div>
        <div class="row">
          <a class="btn btn--ghost btn--sm" href="#ajustes" data-close>${I('sliders', 14)} Ajustes</a>
          ${App.pwa.isStandalone() ? '' : `<button class="btn btn--ghost btn--sm" data-act="install">${I('arrow-down', 14)} Instalar app</button>`}
          <button class="btn btn--danger btn--sm" data-act="logout">${I('arrow-right', 14)} Cerrar sesión</button>
        </div>
        ${canPreview ? `
          <section class="stack-sm">
            <h3 class="eyebrow">Ver la app como…</h3>
            <p class="small muted">Para revisar lo que ve cada músico. Mientras tanto tendrás sus mismos permisos; vuelve a ti desde este menú.</p>
            <div class="menu-list">${members.map((x) => `
              <button class="menu-item ${x.id === me.id ? 'is-on' : ''}" data-user="${esc(x.id)}">
                ${ui.avatar(x, 'sm')}
                <span class="grow"><span class="strong small">${esc(x.name)}${x.id === realId ? ' (tú)' : ''}</span><span class="xsmall faint">${M.isLeader(x) ? 'Líder · ' : ''}${x.roles.map(M.posLabel).join(', ')}</span></span>
                ${x.id === me.id ? I('check', 16) : ''}
              </button>`).join('')}</div>
          </section>` : ''}`
    });
    m.body.addEventListener('click', (e) => {
      if (e.target.closest('[data-act="logout"]')) { App.auth.logout(); return; }
      if (e.target.closest('[data-act="install"]')) { m.close(); App.pwa.install(); return; }
      const b = e.target.closest('[data-user]');
      if (!b) return;
      App.actions.switchUser(b.dataset.user);
      m.close();
      ui.toast(b.dataset.user === realId ? 'Volviste a tu vista.' : `Ahora ves la app como ${M.member(b.dataset.user).name}.`);
    });
  }

  /** Menú "Más" del celular. */
  function moreMenu() {
    const items = NAV.filter((n) => n.more).concat([{ route: 'ajustes', label: 'Ajustes', icon: 'sliders' }]);
    const m = ui.sheet({
      title: 'Más',
      body: `<div class="menu-list more-list">${items.map((n) => `
        <a class="menu-item" href="#${n.route}" data-close>${I(n.icon, 18)}<span class="grow"><span class="strong">${n.label}</span></span>${I('chevron-right', 16)}</a>`).join('')}
        ${App.pwa.isStandalone() ? '' : `<button class="menu-item" data-act="install">${I('arrow-down', 18)}<span class="grow"><span class="strong">Instalar app</span></span></button>`}
      </div>`
    });
    m.body.addEventListener('click', (e) => { if (e.target.closest('[data-act="install"]')) { m.close(); App.pwa.install(); } });
  }

  App.router = {
    go(name, param) {
      const h = `#${name}${param ? '-' + param : ''}`;
      if (location.hash === h) render(true); else location.hash = h;
    },
    get current() { return current; }
  };

  App.app = {
    refresh: () => render(false),
    renderShell
  };

  // ---- Arranque ----
  let started = false;
  function start() {
    if (started) return;
    started = true;
    renderShell();
    render(true);
    window.addEventListener('hashchange', () => render(true));
    App.store.on((state, meta) => {
      renderShell();
      render(!!(meta && meta.reset));
    });
    U.$('#user-chip').addEventListener('click', userMenu);
    U.$('#top-user').addEventListener('click', userMenu);
    U.$('#tabbar').addEventListener('click', (e) => { if (e.target.closest('#tab-more')) moreMenu(); });
    U.$$('[data-bell]').forEach((b) => b.addEventListener('click', () => App.notify.panel()));
    App.store.on(() => App.notify.checkSoon());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) App.notify.checkSoon(); });
    setTimeout(() => App.notify.check(), 1200);
  }

  function syncIndicator() {
    if (!App.cloud || !App.cloud.enabled) return;
    const LABEL = { ok: 'Sincronizado', syncing: 'Guardando…', offline: 'Sin conexión', error: 'No se pudo guardar', idle: 'Conectando…' };
    const paint = (st) => U.$$('[data-sync]').forEach((el) => {
      el.hidden = false;
      el.dataset.state = st;
      el.title = LABEL[st] || st;
      const t = el.querySelector('.sync-text');
      if (t) t.textContent = LABEL[st] || st;
    });
    paint(App.cloud.status);
    App.cloud.onStatus(paint);
  }

  async function boot() {
    App.pwa.register();
    App.store.init();
    App.applyTheme(App.store.state.prefs.theme);
    const intro = App.intro.show();
    let notice = null;

    // ---- Con base de datos compartida ----
    if (App.cloud && App.cloud.enabled) {
      document.body.classList.add('is-locked');
      let profile = null;
      try { profile = await App.cloud.restore(); } catch (e) { profile = null; }
      if (profile) {
        try { await App.cloud.pull(); } catch (e) { notice = 'Sin conexión: ves lo último guardado en este celular.'; }
        App.store.update((s) => { s.session.userId = profile.member_id; }, { silent: true, remote: true });
        App.cloud.startRealtime();
      }
      await intro.ready;
      if (profile) {
        U.$('#login-root').innerHTML = '';
        document.body.classList.remove('is-locked');
        start();
      } else {
        App.login.show(() => start());
      }
      syncIndicator();
      await intro.leave();
      if (notice) ui.toast(notice, { kind: 'info', timeout: 5000 });
      return;
    }

    // ---- Solo en este navegador ----
    const session = App.auth.current();
    await intro.ready;
    if (session) {
      App.store.update((s) => { if (!s.members.some((m) => m.id === s.session.userId)) s.session.userId = session.memberId; }, { silent: true });
      start();
    } else {
      App.login.show(() => start());
    }
    await intro.leave();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
