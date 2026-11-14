/* =========================================================================
   SELAH · Componentes de interfaz
   Funciones que devuelven HTML (avatar, pills…) y componentes con
   comportamiento (modal, confirmación, toast).
   ========================================================================= */
(function () {
  const U = App.utils;
  const esc = U.esc;
  const I = App.icon;
  const ui = App.ui;

  const STATUS = {
    confirmed: 'Confirmado',
    pending: 'Pendiente',
    declined: 'No puede',
    empty: 'Sin asignar'
  };
  ui.STATUS = STATUS;

  ui.avatar = (m, size = '') => {
    const cls = `avatar${size ? ' avatar--' + size : ''}`;
    if (!m) return `<span class="${cls} avatar--empty" aria-hidden="true">${I('plus', 12)}</span>`;
    return `<span class="${cls}" style="--h:${U.hue(m.id + m.name)}" title="${esc(m.name)}" aria-hidden="true">${esc(U.initials(m.name))}</span>`;
  };

  ui.person = (m, size = 'sm', extra = '') => m
    ? `<span class="person">${ui.avatar(m, size)}<span class="person-name truncate">${esc(m.name)}</span>${extra}</span>`
    : `<span class="person">${ui.avatar(null, size)}<span class="faint">Sin asignar</span></span>`;

  ui.status = (status) => `<span class="pill pill--${status}">${STATUS[status] || status}</span>`;

  ui.typeTag = (type) => `<span class="type-tag" style="--tc: var(--t-${esc(type)})">${esc(App.model.typeLabel(type))}</span>`;

  ui.keyBadge = (key) => `<span class="key-badge">${esc(App.chords.formatKey(key, App.store.state.prefs.notation))}</span>`;

  ui.progress = (st) => {
    const t = Math.max(1, st.total);
    return `<div class="progress" role="img" aria-label="${st.confirmed} de ${st.total} confirmados">
      <span class="p-ok" style="width:${(st.confirmed / t) * 100}%"></span>
      <span class="p-pending" style="width:${(st.pending / t) * 100}%"></span>
      <span class="p-bad" style="width:${(st.declined / t) * 100}%"></span>
    </div>`;
  };

  ui.empty = ({ icon = 'music', title, text = '', action = '' }) => `
    <div class="empty">${I(icon, 28)}<p class="empty-title">${esc(title)}</p>${text ? `<p class="small">${esc(text)}</p>` : ''}${action}</div>`;

  ui.memberOptions = (members, selected) => members.map((m) => `<option value="${esc(m.id)}" ${m.id === selected ? 'selected' : ''}>${esc(m.name)}</option>`).join('');

  // ---------------------------------------------------------------------
  // Modal / hoja lateral
  // ---------------------------------------------------------------------
  ui.modal = function modal({ title, body = '', actions = [], size = 'md', kind = 'dialog', onClose, className = '' }) {
    const root = document.getElementById('overlay-root');
    const prevFocus = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = `overlay overlay--${kind} ${className}`;
    wrap.innerHTML = `
      <div class="scrim" data-close></div>
      <div class="modal modal--${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <header class="modal-head">
          <h2 class="modal-title">${esc(title)}</h2>
          <button class="btn btn--icon btn--plain" data-close aria-label="Cerrar">${I('x')}</button>
        </header>
        <div class="modal-body"></div>
        <footer class="modal-foot"></footer>
      </div>`;
    const bodyEl = wrap.querySelector('.modal-body');
    const footEl = wrap.querySelector('.modal-foot');
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);

    let closed = false;
    const api = { el: wrap, body: bodyEl, foot: footEl, close };

    actions.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn btn--${a.kind || 'ghost'}${a.spacer ? ' spacer' : ''}`;
      b.innerHTML = (a.icon ? I(a.icon, 16) : '') + esc(a.label);
      b.addEventListener('click', async () => {
        if (!a.onClick) return close();
        const r = await a.onClick(api);
        if (r !== false) close();
      });
      footEl.appendChild(b);
    });

    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      wrap.classList.add('is-closing');
      setTimeout(() => { wrap.remove(); if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true }); }, 200);
      if (onClose) onClose();
    }

    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    root.appendChild(wrap);
    const first = bodyEl.querySelector('input:not([type=checkbox]), select, textarea');
    setTimeout(() => (first || wrap.querySelector('.modal-head button')).focus({ preventScroll: true }), 30);
    return api;
  };

  ui.sheet = (opts) => ui.modal(Object.assign({ kind: 'sheet' }, opts));

  /** Confirmación propia (confirm() no funciona dentro de un artefacto). */
  ui.confirm = ({ title, message, confirmLabel = 'Confirmar', danger = false }) => new Promise((resolve) => {
    let answered = false;
    ui.modal({
      title,
      body: `<p class="muted">${esc(message)}</p>`,
      actions: [
        { label: 'Cancelar', kind: 'ghost', onClick: () => { answered = true; resolve(false); } },
        { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: () => { answered = true; resolve(true); } }
      ],
      onClose: () => { if (!answered) resolve(false); }
    });
  });

  // ---------------------------------------------------------------------
  // Toasts
  // ---------------------------------------------------------------------
  ui.toast = (message, { kind = 'ok', action = null, timeout = 3400 } = {}) => {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `toast toast--${kind}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `${I(kind === 'ok' ? 'check' : kind === 'warn' ? 'alert' : 'bell', 16)}<span class="grow">${esc(message)}</span>`;
    if (action) {
      const b = document.createElement('button');
      b.textContent = action.label;
      b.addEventListener('click', () => { action.onClick(); dismiss(); });
      el.appendChild(b);
    }
    root.appendChild(el);
    const t = setTimeout(dismiss, timeout);
    function dismiss() {
      clearTimeout(t);
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 220);
    }
  };

  /** Botón que hace una pequeña animación al confirmar. */
  ui.pop = (el) => {
    if (!el) return;
    el.classList.remove('is-popped');
    void el.offsetWidth;
    el.classList.add('is-popped');
  };
})();
