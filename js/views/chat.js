/* =========================================================================
   SELAH · Vista: Chat del equipo
   Canales: General, Líderes y uno por cada evento próximo. App.chatPanel
   también se usa dentro de la pestaña "Chat" de cada evento.
   En la demo los mensajes se guardan en este navegador.
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc;

  const vs = App.viewState.chat = { channel: 'general', mobileList: true };

  function channels() {
    const base = [
      { id: 'general', name: 'General', sub: 'Todo el ministerio', icon: 'chat' }
    ];
    if (M.isLeader()) base.push({ id: 'lideres', name: 'Líderes', sub: 'Solo líderes', icon: 'crown' });
    M.upcoming({ days: 21 }).forEach((e) => base.push({ id: e.id, name: e.title, sub: `${U.fmtDate(e.date, 'short')} · ${U.fmtTime(e.time)}`, icon: 'calendar', type: e.type }));
    return base;
  }

  function messagesFor(channel) {
    return App.store.state.messages.filter((m) => m.channel === channel).sort((a, b) => a.ts - b.ts);
  }

  function bubbles(channel) {
    const me = M.me();
    const msgs = messagesFor(channel);
    if (!msgs.length) return `<div class="chat-empty">${I('chat', 26)}<p class="strong">Aún no hay mensajes</p><p class="small muted">Escribe el primero: horarios, cambios de tono, quién lleva qué.</p></div>`;
    let lastDay = '';
    return msgs.map((m, i) => {
      const who = M.member(m.memberId);
      const mine = m.memberId === me.id;
      const day = U.ymd(m.ts);
      const sep = day !== lastDay ? `<div class="chat-day"><span>${U.relDay(day) === 'Hoy' ? 'Hoy' : U.fmtDate(day, 'long')}</span></div>` : '';
      lastDay = day;
      const prev = msgs[i - 1];
      const grouped = prev && prev.memberId === m.memberId && U.ymd(prev.ts) === day && m.ts - prev.ts < 10 * 60 * 1000;
      return `${sep}
        <div class="msg ${mine ? 'msg--mine' : ''} ${grouped ? 'msg--grouped' : ''}" data-id="${esc(m.id)}">
          ${mine ? '' : `<div class="msg-av">${grouped ? '' : ui.avatar(who, 'sm')}</div>`}
          <div class="msg-body">
            ${grouped || mine ? '' : `<span class="msg-name">${esc(who ? who.name : 'Alguien')}</span>`}
            <div class="msg-bubble">${esc(m.text)}</div>
            <span class="msg-time">${U.clockTime(m.ts)}</span>
          </div>
        </div>`;
    }).join('');
  }

  /** Panel de conversación reutilizable. */
  App.chatPanel = function chatPanel(container, channel, { compact = false } = {}) {
    container.innerHTML = `
      <div class="chat-panel ${compact ? 'chat-panel--compact' : ''}">
        <div class="chat-scroll" id="chat-scroll-${esc(channel)}">${bubbles(channel)}</div>
        <form class="chat-input" autocomplete="off">
          <label class="sr-only" for="chat-text-${esc(channel)}">Mensaje</label>
          <textarea class="textarea" id="chat-text-${esc(channel)}" rows="1" placeholder="Escribe al equipo como ${esc(U.firstName(M.me().name))}…"></textarea>
          <button class="btn btn--primary btn--icon" type="submit" aria-label="Enviar">${I('send', 17)}</button>
        </form>
      </div>`;
    const scroll = container.querySelector('.chat-scroll');
    const ta = container.querySelector('textarea');
    const form = container.querySelector('form');
    scroll.scrollTop = scroll.scrollHeight;

    const send = () => {
      const text = ta.value.trim();
      if (!text) return;
      App.viewState.chat.refocus = channel;
      App.actions.sendMessage(channel, text);
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); send(); });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; });

    if (App.viewState.chat.refocus === channel) {
      App.viewState.chat.refocus = null;
      const last = scroll.lastElementChild;
      if (last) last.classList.add('msg-in');
      setTimeout(() => ta.focus({ preventScroll: true }), 0);
    }
  };

  App.views.chat = {
    title: 'Chat',
    render(root) {
      const list = channels();
      if (!list.some((c) => c.id === vs.channel)) vs.channel = 'general';
      const cur = list.find((c) => c.id === vs.channel);
      const counts = {};
      App.store.state.messages.forEach((m) => { counts[m.channel] = (counts[m.channel] || 0) + 1; });

      root.innerHTML = `
        <div class="view view--chat">
          <header class="view-head">
            <div class="titles">
              <span class="eyebrow">Comunicación</span>
              <h1 class="view-title">Chat del equipo</h1>
            </div>
          </header>
          <div class="chat-layout ${vs.mobileList ? 'show-list' : 'show-conv'}">
            <nav class="chat-channels card" aria-label="Canales">
              ${list.map((c) => `
                <button class="ch-item ${c.id === vs.channel ? 'is-on' : ''}" data-ch="${esc(c.id)}" ${c.type ? `style="--tc: var(--t-${esc(c.type)})"` : ''}>
                  <span class="ch-icon ${c.type ? 'ch-icon--event' : ''}">${I(c.icon, 16)}</span>
                  <span class="grow"><span class="strong small truncate" style="display:block">${esc(c.name)}</span><span class="xsmall faint">${esc(c.sub)}</span></span>
                  ${counts[c.id] ? `<span class="xsmall faint mono">${counts[c.id]}</span>` : ''}
                </button>`).join('')}
            </nav>
            <section class="chat-conv card">
              <header class="chat-conv-head">
                <button class="btn btn--plain btn--icon btn--sm chat-back" data-act="back" aria-label="Volver a canales">${I('chevron-left', 18)}</button>
                <div class="grow"><span class="strong">${esc(cur.name)}</span><span class="xsmall faint" style="display:block">${esc(cur.sub)}</span></div>
                ${cur.type ? `<a class="btn btn--ghost btn--sm" href="#evento-${esc(cur.id)}">Ver evento</a>` : ''}
              </header>
              <div id="chat-host"></div>
            </section>
          </div>
        </div>`;

      App.chatPanel(root.querySelector('#chat-host'), vs.channel);

      root.addEventListener('click', (e) => {
        const ch = e.target.closest('[data-ch]');
        if (ch) { vs.channel = ch.dataset.ch; vs.mobileList = false; App.app.refresh(); return; }
        if (e.target.closest('[data-act="back"]')) { vs.mobileList = true; App.app.refresh(); }
      });
    }
  };
})();
