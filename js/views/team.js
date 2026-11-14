/* =========================================================================
   SELAH · Vista: Equipo
   Personas, puestos (voces, guitarras, piano…), sub-equipos, fechas no
   disponibles e historial de servicio. Pensado para ministerios grandes.
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc, A = App.actions;

  const vs = App.viewState.team = { q: '', group: 'all', team: 'all' };

  function filteredMembers() {
    const q = U.normalize(vs.q);
    return M.members()
      .filter((m) => (vs.team === 'all' || (m.teams || []).includes(vs.team)) &&
        (vs.group === 'all' || m.roles.some((r) => M.position(r).group === vs.group)) &&
        (!q || U.normalize(`${m.name} ${m.roles.map(M.posLabel).join(' ')}`).includes(q)))
      .sort((a, b) => (M.isLeader(b) - M.isLeader(a)) || a.name.localeCompare(b.name));
  }

  function memberCard(m) {
    const next = M.myUpcoming(m.id)[0];
    const served = M.servedCount(m.id);
    const blockedSoon = (m.unavailable || []).filter((d) => d >= U.today()).length;
    return `
      <button class="member-card card" data-member="${esc(m.id)}">
        <div class="mc-top">
          ${ui.avatar(m, 'lg')}
          <div class="grow mc-id">
            <span class="strong truncate">${esc(m.name)}</span>
            <span class="xsmall faint">${(m.teams || []).map((t) => esc((M.team(t) || {}).name || '')).join(' · ') || 'Sin equipo'}</span>
          </div>
          ${M.isLeader() && App.auth.accountOf(m) ? `<span class="acc-badge" title="Tiene usuario para entrar">${I('key', 13)}</span>` : ''}
          ${M.isLeader(m) ? `<span class="leader-badge" title="Líder">${I('crown', 13)}</span>` : ''}
        </div>
        <div class="chip-row">${m.roles.map((r) => `<span class="tag">${I(M.groupIcon(r), 12)}&nbsp;${esc(M.posLabel(r))}</span>`).join('')}</div>
        <div class="mc-foot xsmall muted">
          <span><strong class="mono">${served}</strong> ${served === 1 ? 'servicio' : 'servicios'} en 60 días</span>
          ${blockedSoon ? `<span class="warn-text">${I('block', 12)} ${blockedSoon} no disp.</span>` : ''}
        </div>
        <div class="mc-next xsmall">${next ? `Próximo: <strong>${esc(next.event.title)}</strong> · ${U.fmtDate(next.event.date, 'short')}` : '<span class="faint">Sin servicios próximos</span>'}</div>
      </button>`;
  }

  function coverage() {
    const cov = M.coverage();
    const max = Math.max(...cov.map((c) => c.count), 1);
    return `
      <section class="panel">
        <div class="row-between"><h2 class="panel-title">${I('grid', 16)} Cobertura por puesto</h2><span class="xsmall faint">personas que pueden servir</span></div>
        <div class="coverage">
          ${cov.map((c) => `
            <button class="cov-row ${vs.group === c.position.group ? 'is-on' : ''}" data-group="${esc(c.position.group)}">
              <span class="cov-label truncate">${esc(c.position.label)}</span>
              <span class="cov-bar"><span style="width:${(c.count / max) * 100}%" class="${c.count <= 2 ? 'is-low' : ''}"></span></span>
              <span class="mono cov-n ${c.count <= 2 ? 'warn-text' : ''}">${c.count}</span>
            </button>`).join('')}
        </div>
        <p class="xsmall faint">En rojo los puestos con 2 personas o menos: conviene formar a alguien más.</p>
      </section>`;
  }

  function list() {
    const members = filteredMembers();
    if (!members.length) return ui.empty({ icon: 'users', title: 'Nadie coincide con la búsqueda', text: 'Quita filtros o busca por otro nombre o instrumento.' });
    return `<div class="member-grid">${members.map(memberCard).join('')}</div>`;
  }

  // ---------------------------------------------------------------------
  // Ficha de una persona (hoja lateral)
  // ---------------------------------------------------------------------
  function openMember(id) {
    const m = M.member(id);
    if (!m) return;
    const leader = M.isLeader();
    const isMe = m.id === M.me().id;
    const canEdit = leader || isMe;
    const hist = M.history(m.id, 6);
    const next = M.myUpcoming(m.id).slice(0, 5);
    const blocked = (m.unavailable || []).filter((d) => d >= U.today());

    const sheet = ui.sheet({
      title: m.name,
      body: `
        <div class="ms-head">
          ${ui.avatar(m, 'xl')}
          <div class="stack-sm">
            <div class="row">${M.isLeader(m) ? `<span class="tag">${I('crown', 12)}&nbsp;Líder</span>` : ''}${(m.teams || []).map((t) => `<span class="tag">${esc((M.team(t) || {}).name || '')}</span>`).join('')}</div>
            <span class="small muted">${M.servedCount(m.id)} servicios en 60 días · último ${M.lastServed(m.id) ? U.relDay(M.lastServed(m.id)).toLowerCase() : 'nunca'}</span>
          </div>
        </div>

        <section class="stack-sm">
          <h3 class="eyebrow">Contacto</h3>
          <div class="contact-row">${I('phone', 15)}<span class="mono grow" style="user-select:all">${esc(m.phone || '—')}</span><button class="btn btn--plain btn--sm" data-copy="${esc(m.phone || '')}">${I('copy', 14)} Copiar</button></div>
          ${leader && App.auth.accountOf(m) ? `<div class="contact-row">${I('key', 15)}<span class="grow">Usuario <span class="mono strong">${esc(App.auth.accountOf(m))}</span></span></div>` : ''}
          <div class="contact-row">${I('mail', 15)}<span class="grow truncate" style="user-select:all">${esc(m.email || '—')}</span><button class="btn btn--plain btn--sm" data-copy="${esc(m.email || '')}">${I('copy', 14)} Copiar</button></div>
        </section>

        <section class="stack-sm">
          <h3 class="eyebrow">Puestos</h3>
          <div class="chip-row">${m.roles.map((r) => `<span class="tag">${I(M.groupIcon(r), 12)}&nbsp;${esc(M.posLabel(r))}</span>`).join('')}</div>
        </section>

        <section class="stack-sm">
          <h3 class="eyebrow">Fechas no disponibles</h3>
          <div class="blocked-list">${blocked.length ? blocked.map((d) => `<span class="blocked-chip">${U.fmtDate(d, 'short')}${canEdit ? `<button data-unblock="${d}" aria-label="Quitar ${U.fmtDate(d, 'short')}">${I('x', 11)}</button>` : ''}</span>`).join('') : '<span class="small muted">Ninguna próxima.</span>'}</div>
          ${canEdit ? `<div class="row"><label class="sr-only" for="ms-block">Agregar fecha</label><input class="input input--sm" type="date" id="ms-block" min="${U.today()}" style="max-width:180px"><button class="btn btn--ghost btn--sm" data-act="block">${I('block', 14)} Bloquear fecha</button></div>` : ''}
        </section>

        <section class="stack-sm">
          <h3 class="eyebrow">Próximos servicios</h3>
          ${next.length ? next.map(({ event: e, assignment: a }) => `<a class="hist-row" href="#evento-${esc(e.id)}"><span class="grow"><span class="strong small">${esc(e.title)}</span><span class="xsmall faint" style="display:block">${U.fmtDate(e.date, 'short')} · ${esc(M.posLabel(a.position))}</span></span>${ui.status(a.status)}</a>`).join('') : '<span class="small muted">Sin servicios asignados.</span>'}
        </section>

        <section class="stack-sm">
          <h3 class="eyebrow">Historial</h3>
          ${hist.length ? hist.map(({ event: e, assignment: a }) => `<a class="hist-row" href="#evento-${esc(e.id)}"><span class="grow"><span class="small">${esc(e.title)}</span><span class="xsmall faint" style="display:block">${U.fmtDate(e.date, 'short')} · ${esc(M.posLabel(a.position))}</span></span></a>`).join('') : '<span class="small muted">Aún no ha servido.</span>'}
        </section>`,
      actions: [
        ...(leader && !isMe ? [{ label: 'Ver la app como esta persona', kind: 'ghost', icon: 'swap', spacer: true, onClick: () => { A.switchUser(m.id); ui.toast(`Ahora ves la app como ${m.name}.`); App.router.go('inicio'); } }] : []),
        ...(leader ? [{ label: 'Editar', kind: 'primary', icon: 'edit', onClick: () => { setTimeout(() => App.forms.member(m), 220); } }] : [{ label: 'Cerrar', kind: 'ghost' }])
      ]
    });

    sheet.body.addEventListener('click', async (e) => {
      const copy = e.target.closest('[data-copy]');
      if (copy) { const ok = await U.copy(copy.dataset.copy); ui.toast(ok ? 'Copiado.' : 'Selecciona el texto para copiarlo.', { kind: ok ? 'ok' : 'info' }); return; }
      const un = e.target.closest('[data-unblock]');
      if (un) { A.toggleUnavailable(m.id, un.dataset.unblock); un.parentElement.remove(); return; }
      if (e.target.closest('[data-act="block"]')) {
        const input = sheet.body.querySelector('#ms-block');
        if (!input.value) { input.focus(); return; }
        if (!(M.member(m.id).unavailable || []).includes(input.value)) A.toggleUnavailable(m.id, input.value);
        sheet.close();
        setTimeout(() => openMember(m.id), 230);
      }
      if (e.target.closest('a[href^="#"]')) sheet.close();
    });
  }

  // ---------------------------------------------------------------------
  // Formulario de persona
  // ---------------------------------------------------------------------
  const cloudOn = () => App.cloud && App.cloud.enabled;

  function accountSection(m) {
    const fixed = m.id && App.auth.fixedAccount(m.id);
    if (fixed) {
      return `<fieldset class="field account-box"><legend class="field-label">${I('key', 14)} Acceso a la app</legend>
        <p class="small muted">Usuario <span class="mono">${esc(fixed.username)}</span>. Es la cuenta principal del líder; se cambia en <span class="mono">js/config.js</span>.</p></fieldset>`;
    }
    const username = App.auth.accountOf(m);
    const isSelf = cloudOn() && m.id === (App.cloud.profile || {}).member_id;
    return `
      <fieldset class="field account-box">
        <legend class="field-label">${I('key', 14)} Acceso a la app</legend>
        ${isSelf ? '<input type="hidden" name="hasAccount" value="on">' : `<label class="check"><input type="checkbox" name="hasAccount" ${username ? 'checked' : ''}> Puede entrar con usuario y contraseña</label>`}
        <div class="field-row">
          <div class="field"><label class="field-label" for="mf-user">Usuario</label><input class="input mono" id="mf-user" name="username" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="ej. joel" value="${esc(username || '')}"></div>
          <div class="field"><label class="field-label" for="mf-pass">${username ? 'Nueva contraseña' : 'Contraseña'}</label><input class="input mono" id="mf-pass" name="password" type="text" autocomplete="new-password" placeholder="${username ? 'Vacío = no cambiarla' : 'Mínimo 6 caracteres'}"></div>
        </div>
        <p class="field-hint">${cloudOn()
          ? 'Entrega el usuario y la contraseña a la persona: podrá entrar desde cualquier celular o computadora.'
          : 'Entrega el usuario y la contraseña a la persona. Sin base de datos, la cuenta funciona solo en este navegador.'}</p>
      </fieldset>`;
  }

  /** Crea, cambia o quita la cuenta en la base de datos. Devuelve un texto para el aviso o lanza un error. */
  async function syncCloudAccount(memberId, fd, isLeader) {
    const profile = App.cloud.profileOf(memberId);
    const wants = fd.get('hasAccount') === 'on';
    const username = App.auth.normUser(fd.get('username') || '');
    const password = String(fd.get('password') || '');
    if (wants) {
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('El usuario debe tener de 3 a 30 letras o números, sin espacios.');
      if (App.auth.usernameTaken(username, memberId)) throw new Error('Ese usuario ya existe. Elige otro.');
      if (!profile) {
        if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
        await App.cloud.users('crear', { usuario: username, password, member_id: memberId, es_lider: isLeader });
        return `ya puede entrar con el usuario "${username}"`;
      }
      const patch = {};
      if (username !== profile.usuario) patch.usuario = username;
      if (password) { if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.'); patch.password = password; }
      if (isLeader !== profile.es_lider) patch.es_lider = isLeader;
      if (Object.keys(patch).length) {
        await App.cloud.users('actualizar', Object.assign({ member_id: memberId }, patch));
        return patch.password ? 'tiene contraseña nueva' : 'tiene su acceso actualizado';
      }
      return null;
    }
    if (profile) {
      await App.cloud.users('borrar', { member_id: memberId });
      return 'ya no puede entrar a la app';
    }
    return null;
  }

  App.forms.member = function memberForm(existing) {
    const m = existing ? U.clone(existing) : { name: '', phone: '', email: '', roles: [], teams: [], leader: false, unavailable: [] };
    ui.modal({
      title: existing ? 'Editar persona' : 'Agregar al equipo',
      size: 'lg',
      body: `
        <form class="stack" autocomplete="off">
          <div class="field"><label class="field-label" for="mf-name">Nombre completo</label><input class="input" id="mf-name" name="name" required value="${esc(m.name)}"></div>
          <div class="field-row">
            <div class="field"><label class="field-label" for="mf-phone">Teléfono</label><input class="input" id="mf-phone" name="phone" type="tel" value="${esc(m.phone)}"></div>
            <div class="field"><label class="field-label" for="mf-email">Correo</label><input class="input" id="mf-email" name="email" type="email" value="${esc(m.email)}"></div>
          </div>
          <fieldset class="field" style="border:0;padding:0;margin:0">
            <legend class="field-label">Puestos en los que puede servir</legend>
            <span class="field-hint">El primero que marques se toma como su puesto principal para la rotación.</span>
            ${App.config.positionGroups.map((g) => `
              <div class="stack-sm" style="margin-top:8px">
                <span class="eyebrow">${I(g.icon, 12)} ${esc(g.label)}</span>
                <div class="check-grid">${App.config.positions.filter((p) => p.group === g.id).map((p) => `<label class="check"><input type="checkbox" name="roles" value="${p.id}" ${m.roles.includes(p.id) ? 'checked' : ''}> ${esc(p.label)}</label>`).join('')}</div>
              </div>`).join('')}
          </fieldset>
          <fieldset class="field" style="border:0;padding:0;margin:0">
            <legend class="field-label">Equipos</legend>
            <div class="check-grid">${M.teams().map((t) => `<label class="check"><input type="checkbox" name="teams" value="${esc(t.id)}" ${(m.teams || []).includes(t.id) ? 'checked' : ''}> ${esc(t.name)}</label>`).join('')}</div>
          </fieldset>
          <label class="check"><input type="checkbox" name="leader" ${m.leader ? 'checked' : ''}> Es líder (puede crear eventos, editar canciones, asignar al equipo y crear cuentas)</label>
          ${accountSection(m)}
        </form>`,
      actions: [
        ...(existing ? [{ label: 'Quitar del equipo', kind: 'danger', icon: 'trash', spacer: true, onClick: async () => {
          if (existing.id === M.me().id) { ui.toast('No puedes quitarte a ti mismo mientras usas la app.', { kind: 'warn' }); return false; }
          const ok = await ui.confirm({ title: 'Quitar del equipo', message: `${existing.name} saldrá del equipo y de los puestos asignados.`, confirmLabel: 'Quitar', danger: true });
          if (!ok) return false;
          if (cloudOn() && App.cloud.profileOf(existing.id)) {
            try { await App.cloud.users('borrar', { member_id: existing.id }); } catch (err) { ui.toast(err.message, { kind: 'warn' }); return false; }
          }
          A.deleteMember(existing.id);
          ui.toast('Persona quitada del equipo.');
          return true;
        } }] : []),
        { label: 'Cancelar', kind: 'ghost' },
        {
          label: existing ? 'Guardar' : 'Agregar', kind: 'primary',
          onClick: async (api) => {
            const f = api.body.querySelector('form');
            if (!f.reportValidity()) return false;
            const fd = new FormData(f);
            const roles = fd.getAll('roles');
            if (!roles.length) { ui.toast('Marca al menos un puesto.', { kind: 'warn' }); return false; }

            const ordered0 = (m.roles || []).filter((r) => roles.includes(r)).concat(roles.filter((r) => !(m.roles || []).includes(r)));
            const isLeader = fd.get('leader') === 'on';

            // ---- Con base de datos: la cuenta la crea el servidor ----
            if (cloudOn()) {
              if (!m.id) m.id = U.uid('m');
              const btn = api.foot.querySelector('.btn--primary');
              btn.disabled = true;
              let note = null;
              try {
                note = await syncCloudAccount(m.id, fd, isLeader);
              } catch (err) {
                btn.disabled = false;
                ui.toast(err.message, { kind: 'warn', timeout: 6000 });
                return false;
              }
              delete m.account;
              A.saveMember(Object.assign(m, { name: fd.get('name').trim(), phone: fd.get('phone').trim(), email: fd.get('email').trim(), roles: ordered0, teams: fd.getAll('teams'), leader: isLeader }));
              ui.toast(note ? `Listo. ${m.name} ${note}.` : existing ? 'Datos guardados.' : `${m.name} se unió al equipo.`);
              return true;
            }

            // ---- Sin base de datos (solo este navegador) ----
            let account = m.account || null;
            let created = null;
            if (!App.auth.fixedAccount(m.id)) {
              if (fd.get('hasAccount') === 'on') {
                const username = App.auth.normUser(fd.get('username') || '');
                const password = String(fd.get('password') || '');
                if (!/^[a-z0-9._-]{3,30}$/.test(username)) { ui.toast('El usuario debe tener de 3 a 30 letras o números, sin espacios.', { kind: 'warn' }); return false; }
                if (App.auth.usernameTaken(username, m.id)) { ui.toast('Ese usuario ya existe. Elige otro.', { kind: 'warn' }); return false; }
                if ((!account || password) && password.length < 6) { ui.toast('La contraseña debe tener al menos 6 caracteres.', { kind: 'warn' }); return false; }
                if (account && !password && account.username !== username) { ui.toast('Para cambiar el usuario escribe también una contraseña nueva.', { kind: 'warn' }); return false; }
                if (password) { account = { username, passwordHash: await App.auth.accountHash(username, password) }; created = username; }
              } else {
                account = null;
              }
            }
            // Conserva el orden previo para no cambiar el puesto principal sin querer
            const ordered = (m.roles || []).filter((r) => roles.includes(r)).concat(roles.filter((r) => !(m.roles || []).includes(r)));
            A.saveMember(Object.assign(m, { name: fd.get('name').trim(), phone: fd.get('phone').trim(), email: fd.get('email').trim(), roles: ordered, teams: fd.getAll('teams'), leader: fd.get('leader') === 'on', account }));
            ui.toast(created ? `Listo. ${fd.get('name').trim()} ya puede entrar con el usuario "${created}".` : existing ? 'Datos guardados.' : `${fd.get('name').trim()} se unió al equipo.`);
          }
        }
      ]
    });
  };

  function teamsManager() {
    const m = ui.modal({
      title: 'Equipos',
      body: `
        <p class="small muted">Divide el ministerio en equipos (por horario, sede o grupo de edad). Cada evento puede tener un equipo preferido para la rotación.</p>
        <div class="stack-sm" id="team-list">${M.teams().map((t) => `
          <div class="row"><label class="sr-only" for="tn-${esc(t.id)}">Nombre del equipo</label><input class="input grow" id="tn-${esc(t.id)}" data-team-id="${esc(t.id)}" value="${esc(t.name)}"><span class="xsmall faint">${M.members().filter((x) => (x.teams || []).includes(t.id)).length} personas</span></div>`).join('')}
        </div>
        <div class="row"><label class="sr-only" for="tn-new">Nuevo equipo</label><input class="input grow" id="tn-new" placeholder="Nuevo equipo, por ejemplo: Sede Norte"></div>`,
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        {
          label: 'Guardar', kind: 'primary', onClick: (api) => {
            api.body.querySelectorAll('[data-team-id]').forEach((inp) => { if (inp.value.trim()) A.saveTeam({ id: inp.dataset.teamId, name: inp.value.trim() }); });
            const nv = api.body.querySelector('#tn-new').value.trim();
            if (nv) A.saveTeam({ name: nv });
            ui.toast('Equipos guardados.');
          }
        }
      ]
    });
    return m;
  }

  App.views.equipo = {
    title: 'Equipo',
    render(root, param, ctx = {}) {
      const leader = M.isLeader();
      const total = M.members().length;
      root.innerHTML = `
        <div class="view view--team">
          <header class="view-head">
            <div class="titles">
              <span class="eyebrow">${esc(M.settings().ministryName)}</span>
              <h1 class="view-title">Equipo</h1>
              <p class="muted">${U.plural(total, 'persona', 'personas')} en ${U.plural(M.teams().length, 'equipo', 'equipos')}.</p>
            </div>
            <div class="view-actions">
              ${leader ? `<button class="btn btn--ghost" data-act="teams">${I('users', 16)} Equipos</button><button class="btn btn--primary" data-act="new">${I('plus', 16)} Agregar persona</button>` : ''}
            </div>
          </header>

          <div class="team-layout">
            <div class="stack">
              <div class="team-filters">
                <div class="search grow"><label class="sr-only" for="team-q">Buscar personas</label>${I('search', 16)}<input class="input" id="team-q" placeholder="Buscar por nombre o instrumento" value="${esc(vs.q)}"></div>
                <label class="sr-only" for="team-sel">Equipo</label>
                <select class="select team-sel" id="team-sel"><option value="all">Todos los equipos</option>${M.teams().map((t) => `<option value="${esc(t.id)}" ${vs.team === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
              </div>
              <div class="chip-row chip-row--scroll">
                <button class="chip ${vs.group === 'all' ? 'is-on' : ''}" data-group="all">Todos</button>
                ${App.config.positionGroups.map((g) => `<button class="chip ${vs.group === g.id ? 'is-on' : ''}" data-group="${g.id}">${I(g.icon, 14)} ${esc(g.label)}</button>`).join('')}
              </div>
              <div id="member-list">${list()}</div>
            </div>
            <aside class="stack">${coverage()}</aside>
          </div>
        </div>`;

      const listEl = root.querySelector('#member-list');
      root.querySelector('#team-q').addEventListener('input', U.debounce((e) => { vs.q = e.target.value; listEl.innerHTML = list(); }, 120));
      root.querySelector('#team-sel').addEventListener('change', (e) => { vs.team = e.target.value; listEl.innerHTML = list(); });
      root.addEventListener('click', (e) => {
        const g = e.target.closest('[data-group]');
        if (g) { vs.group = vs.group === g.dataset.group && g.classList.contains('cov-row') ? 'all' : g.dataset.group; App.app.refresh(); return; }
        const mc = e.target.closest('[data-member]');
        if (mc) { openMember(mc.dataset.member); return; }
        const act = e.target.closest('[data-act]');
        if (!act) return;
        if (act.dataset.act === 'new') App.forms.member();
        if (act.dataset.act === 'teams') teamsManager();
      });

      if (param && ctx.entering) setTimeout(() => openMember(param), 50);
    }
  };

  App.forms.openMember = openMember;
})();
