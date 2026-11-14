/* =========================================================================
   SELAH · Vista: Chat del equipo
   Canales: General, Líderes y uno por cada evento próximo. App.chatPanel
   también se usa dentro de la pestaña "Chat" de cada evento.
   - Vista previa del último mensaje y contador de no leídos.
   - Links de música con tarjeta que se escucha dentro de la app.
   - Reacciones, emojis, copiar y borrar (el propio mensaje o el líder).
   - El borrador no se pierde cuando llega un mensaje nuevo.
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc;

  const vs = App.viewState.chat = { channel: 'general', mobileList: true, drafts: {}, focused: null, scroll: {} };
  const REACTIONS = ['🙏', '🔥', '🙌', '❤️', '👍', '😂'];
  const EMOJIS = ['🙏', '🙌', '🔥', '❤️', '👍', '👏', '😊', '😂', '🎶', '🎸', '🥁', '🎹', '🎤', '✝️', '🕊️', '⭐', '✅', '⏰', '📍', '🙂'];

  // ---------------------------------------------------------------------
  // Leídos (se guarda en este celular)
  // ---------------------------------------------------------------------
  const READ_KEY = 'selah-chat-read-v1';
  let read = App.storage.load(READ_KEY);
  if (!read || !read.since) { read = { since: Date.now(), ch: {} }; App.storage.save(READ_KEY, read); }
  const lastRead = (ch) => Math.max(read.since, read.ch[ch] || 0);

  function markRead(ch) {
    const msgs = messagesFor(ch);
    const last = msgs.length ? msgs[msgs.length - 1].ts : 0;
    if (last && last > lastRead(ch)) {
      read.ch[ch] = last;
      App.storage.save(READ_KEY, read);
      return true;
    }
    return false;
  }

  function channels() {
    const members = M.members().length;
    const base = [{ id: 'general', name: 'General', sub: `Todo el ministerio · ${U.plural(members, 'persona', 'personas')}`, icon: 'chat', kind: 'general' }];
    if (M.isLeader()) base.push({ id: 'lideres', name: 'Líderes', sub: 'Solo líderes', icon: 'crown', kind: 'lideres' });
    M.upcoming({ days: 21 }).forEach((e) => base.push({ id: e.id, name: e.title, sub: `${U.fmtDate(e.date, 'short')} · ${U.fmtTime(e.time)}`, icon: 'calendar', type: e.type, kind: 'event', event: e }));
    return base;
  }

  function messagesFor(channel) {
    return App.store.state.messages.filter((m) => m.channel === channel).sort((a, b) => a.ts - b.ts);
  }

  const unreadIn = (ch, meId) => messagesFor(ch).filter((m) => m.memberId !== meId && m.ts > lastRead(ch)).length;

  /** Total de mensajes sin leer (para el menú). */
  App.chatUnread = () => {
    const me = M.me();
    if (!me) return 0;
    return channels().reduce((n, c) => n + unreadIn(c.id, me.id), 0);
  };

  // ---------------------------------------------------------------------
  // Mensajes
  // ---------------------------------------------------------------------
  function linkify(text) {
    const links = App.media.findLinks(text);
    if (!links.length) return esc(text);
    let out = '';
    let rest = String(text);
    links.forEach((l) => {
      const i = rest.indexOf(l);
      if (i < 0) return;
      out += esc(rest.slice(0, i));
      const href = /^https?:/i.test(l) ? l : 'https://' + l;
      out += `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(l.length > 48 ? l.slice(0, 45) + '…' : l)}</a>`;
      rest = rest.slice(i + l.length);
    });
    return out + esc(rest);
  }

  function mediaCards(text) {
    const cards = [];
    let body = String(text);
    App.media.findLinks(text).slice(0, 2).forEach((l) => {
      const info = App.media.parse(l);
      if (!info || !App.media.playable(info)) return;
      // Si el link está solo en su línea, no se repite como texto
      body = body.split('\n').filter((line) => line.trim() !== l).join('\n');
      const t = App.media.cachedTitle(info.url) || App.media.fallbackTitle(info);
      cards.push(`
        <button class="msg-media ${info.thumb ? 'has-thumb' : ''}" data-play-url="${esc(info.url)}" aria-label="Escuchar">
          ${info.thumb ? `<span class="mm-art"><img src="${esc(info.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="mm-play">${I('play', 16)}</span></span>`
            : `<span class="mm-art mm-art--plain" style="--pc:${App.media.platform(info.kind).color}">${I('headphones', 20)}<span class="mm-play">${I('play', 14)}</span></span>`}
          <span class="mm-info"><span class="mm-title" data-lt="${esc(info.url)}">${esc(t)}</span><span class="mm-sub">${App.media.badge(info)} <span>Escuchar aquí</span></span></span>
        </button>`);
    });
    return { cards: cards.join(''), body: body.trim() };
  }

  function bubbles(channel) {
    const me = M.me();
    const leader = M.isLeader();
    const msgs = messagesFor(channel);
    if (!msgs.length) {
      return `<div class="chat-empty">
        <span class="chat-empty-icon">${I('chat', 26)}</span>
        <p class="strong">Empieza la conversación</p>
        <p class="small muted">Horarios, cambios de tono, quién lleva qué… o comparte el link de una alabanza para ensayar.</p>
      </div>`;
    }
    const since = vs.prevRead && vs.prevRead.ch === channel ? vs.prevRead.ts : lastRead(channel);
    let lastDay = '';
    let newShown = false;
    return msgs.map((m, i) => {
      const who = M.member(m.memberId);
      const mine = m.memberId === me.id;
      const day = U.ymd(m.ts);
      let sep = day !== lastDay ? `<div class="chat-day"><span>${U.relDay(day) === 'Hoy' ? 'Hoy' : U.relDay(day) === 'Ayer' ? 'Ayer' : U.fmtDate(day, 'long')}</span></div>` : '';
      lastDay = day;
      if (!newShown && !mine && m.ts > since) { newShown = true; sep += '<div class="chat-new"><span>Mensajes nuevos</span></div>'; }
      const prev = msgs[i - 1];
      const nextM = msgs[i + 1];
      const grouped = prev && prev.memberId === m.memberId && U.ymd(prev.ts) === day && m.ts - prev.ts < 10 * 60 * 1000 && !sep;
      const tail = !(nextM && nextM.memberId === m.memberId && U.ymd(nextM.ts) === day && nextM.ts - m.ts < 10 * 60 * 1000);
      const { cards, body } = mediaCards(m.text);
      const rx = Object.entries(m.reactions || {}).filter(([, ids]) => ids && ids.length);
      const hue = who ? U.hue(who.id + who.name) : 0;
      return `${sep}
        <div class="msg ${mine ? 'msg--mine' : ''} ${grouped ? 'msg--grouped' : ''} ${tail ? 'msg--tail' : ''}" data-id="${esc(m.id)}">
          ${mine ? '' : `<div class="msg-av">${tail ? ui.avatar(who, 'sm') : ''}</div>`}
          <div class="msg-body">
            ${grouped || mine ? '' : `<span class="msg-name" style="--h:${hue}">${esc(who ? who.name : 'Alguien')}${who && M.isLeader(who) ? ` <span class="msg-role">Líder</span>` : ''}</span>`}
            <div class="msg-bubble ${cards && !body ? 'msg-bubble--media' : ''}" data-bubble>
              ${body ? `<div class="msg-text">${linkify(body)}</div>` : ''}
              ${cards}
              <span class="msg-time">${U.clockTime(m.ts)}</span>
            </div>
            ${rx.length ? `<div class="msg-rx">${rx.map(([e, ids]) => `<button class="rx ${ids.includes(me.id) ? 'is-mine' : ''}" data-rx="${esc(e)}" data-mid="${esc(m.id)}" title="${esc(ids.map((id) => (M.member(id) || { name: '?' }).name).join(', '))}">${e}<span>${ids.length}</span></button>`).join('')}</div>` : ''}
            <div class="msg-tools" role="toolbar" aria-label="Acciones del mensaje">
              ${REACTIONS.map((e) => `<button class="mt-rx" data-rx="${e}" data-mid="${esc(m.id)}" aria-label="Reaccionar ${e}">${e}</button>`).join('')}
              <span class="mt-sep"></span>
              <button class="mt-btn" data-copy="${esc(m.id)}" aria-label="Copiar">${I('copy', 14)}</button>
              ${mine || leader ? `<button class="mt-btn mt-btn--bad" data-del="${esc(m.id)}" aria-label="Borrar">${I('trash', 14)}</button>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // ---------------------------------------------------------------------
  // Panel de conversación reutilizable
  // ---------------------------------------------------------------------
  App.chatPanel = function chatPanel(container, channel, { compact = false, visible = true } = {}) {
    const me = M.me();
    const ev = M.event(channel);
    container.innerHTML = `
      <div class="chat-panel ${compact ? 'chat-panel--compact' : ''}">
        <div class="chat-scroll" id="chat-scroll-${esc(channel)}">${bubbles(channel)}</div>
        <button class="chat-jump" type="button" hidden aria-label="Ir al final">${I('arrow-down', 16)}</button>
        <form class="chat-input" autocomplete="off">
          <div class="ci-emoji" hidden>${EMOJIS.map((e) => `<button type="button" data-emoji="${e}">${e}</button>`).join('')}</div>
          <button type="button" class="ci-btn" data-ci="emoji" aria-label="Emojis">${I('smile', 19)}</button>
          <button type="button" class="ci-btn" data-ci="link" aria-label="Compartir una alabanza">${I('headphones', 19)}</button>
          <div class="ci-field">
            <label class="sr-only" for="chat-text-${esc(channel)}">Mensaje</label>
            <textarea id="chat-text-${esc(channel)}" rows="1" placeholder="Mensaje como ${esc(U.firstName(me.name))}…">${esc(vs.drafts[channel] || '')}</textarea>
          </div>
          <button class="ci-send" type="submit" aria-label="Enviar">${I('send', 18)}</button>
        </form>
      </div>`;

    const scroll = container.querySelector('.chat-scroll');
    const ta = container.querySelector('textarea');
    const form = container.querySelector('form');
    const jump = container.querySelector('.chat-jump');
    const emojiBox = container.querySelector('.ci-emoji');
    const sendBtn = container.querySelector('.ci-send');

    const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; sendBtn.classList.toggle('is-ready', !!ta.value.trim()); };
    fit();

    // Posición: al final, salvo que la persona estuviera leyendo más arriba
    const pos = vs.scroll[channel];
    if (!pos || pos.atBottom || App.viewState.chat.refocus === channel) scroll.scrollTop = scroll.scrollHeight;
    else { scroll.scrollTop = pos.top; jump.hidden = false; }
    scroll.addEventListener('scroll', () => {
      const atBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 60;
      vs.scroll[channel] = { top: scroll.scrollTop, atBottom };
      jump.hidden = atBottom;
    }, { passive: true });
    jump.addEventListener('click', () => scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'smooth' }));

    ui.hydrateLinkTitles(scroll);
    if (visible && !document.hidden && markRead(channel)) setTimeout(() => App.app.renderShell(), 0);

    const send = () => {
      const text = ta.value.trim();
      if (!text) return;
      vs.drafts[channel] = '';
      vs.scroll[channel] = { atBottom: true };
      App.viewState.chat.refocus = channel;
      App.actions.sendMessage(channel, text);
      markRead(channel);
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); send(); });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
    ta.addEventListener('input', () => { vs.drafts[channel] = ta.value; fit(); });
    ta.addEventListener('focus', () => { vs.focused = channel; });
    ta.addEventListener('blur', () => setTimeout(() => { if (ta.isConnected) vs.focused = null; }, 0));

    const insert = (txt) => {
      const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? ta.value.length;
      ta.value = ta.value.slice(0, a) + txt + ta.value.slice(b);
      ta.selectionStart = ta.selectionEnd = a + txt.length;
      vs.drafts[channel] = ta.value;
      fit();
      ta.focus();
    };

    form.addEventListener('click', (e) => {
      const em = e.target.closest('[data-emoji]');
      if (em) { insert(em.dataset.emoji); return; }
      const b = e.target.closest('[data-ci]');
      if (!b) return;
      if (b.dataset.ci === 'emoji') { emojiBox.hidden = !emojiBox.hidden; b.classList.toggle('is-on', !emojiBox.hidden); return; }
      if (b.dataset.ci === 'link') {
        if (ev) { App.forms.shareLink(ev.id); return; }
        App.player.askLink({
          title: 'Compartir una alabanza',
          onSave: (data) => {
            vs.scroll[channel] = { atBottom: true };
            App.actions.sendMessage(channel, `🎵 ${data.title || 'Escuchen esta alabanza'}\n${data.url}`);
          }
        });
      }
    });

    scroll.addEventListener('click', async (e) => {
      const play = e.target.closest('[data-play-url]');
      if (play) { App.player.play([{ url: play.dataset.playUrl, sub: ev ? ev.title : '' }]); return; }
      const rx = e.target.closest('[data-rx]');
      if (rx) { App.actions.react(rx.dataset.mid, rx.dataset.rx); return; }
      const cp = e.target.closest('[data-copy]');
      if (cp) {
        const msg = App.store.state.messages.find((m) => m.id === cp.dataset.copy);
        if (msg && await U.copy(msg.text)) ui.toast('Mensaje copiado.');
        scroll.querySelectorAll('.msg.is-active').forEach((x) => x.classList.remove('is-active'));
        return;
      }
      const del = e.target.closest('[data-del]');
      if (del) {
        const ok = await ui.confirm({ title: 'Borrar mensaje', message: 'El mensaje se borrará para todo el equipo.', confirmLabel: 'Borrar', danger: true });
        if (ok) App.actions.deleteMessage(del.dataset.del);
        return;
      }
      if (e.target.closest('a')) return;
      // Tocar una burbuja muestra las reacciones (en el celular)
      const bubble = e.target.closest('[data-bubble]');
      const msg = bubble && bubble.closest('.msg');
      scroll.querySelectorAll('.msg.is-active').forEach((x) => { if (x !== msg) x.classList.remove('is-active'); });
      if (msg) msg.classList.toggle('is-active');
    });

    if (App.viewState.chat.refocus === channel) {
      App.viewState.chat.refocus = null;
      const last = scroll.querySelector('.msg:last-of-type');
      if (last) last.classList.add('msg-in');
      setTimeout(() => ta.focus({ preventScroll: true }), 0);
    } else if (vs.focused === channel) {
      setTimeout(() => { ta.focus({ preventScroll: true }); ta.selectionStart = ta.selectionEnd = ta.value.length; }, 0);
    }
  };

  // ---------------------------------------------------------------------
  // Vista
  // ---------------------------------------------------------------------
  function channelAvatar(c, size = '') {
    if (c.kind === 'event') {
      const d = U.parseYmd(c.event.date);
      return `<span class="ch-av ch-av--event ${size}" style="--tc: var(--t-${esc(c.type)})"><span class="ch-av-day">${d.getDate()}</span><span class="ch-av-mon">${U.MESES_C[d.getMonth()]}</span></span>`;
    }
    return `<span class="ch-av ch-av--orb ${c.kind === 'lideres' ? 'ch-av--gold' : ''} ${size}">${I(c.icon, size ? 20 : 17)}</span>`;
  }

  function preview(c, meId) {
    const msgs = messagesFor(c.id);
    const last = msgs[msgs.length - 1];
    if (!last) return { text: c.sub, time: '', unread: 0 };
    const who = M.member(last.memberId);
    const links = App.media.findLinks(last.text);
    let txt = last.text.replace(/\s+/g, ' ');
    if (links.length && txt.trim() === links[0]) txt = '🎵 Link de alabanza';
    const author = last.memberId === meId ? 'Tú' : who ? U.firstName(who.name) : '';
    const today = U.ymd(last.ts) === U.today();
    return { text: `${author ? author + ': ' : ''}${txt}`, time: today ? U.clockTime(last.ts) : U.fmtDate(U.ymd(last.ts), 'short'), unread: unreadIn(c.id, meId) };
  }

  function stack(members) {
    const shown = members.slice(0, 4);
    return `<span class="av-stack">${shown.map((m) => ui.avatar(m, 'xs')).join('')}${members.length > shown.length ? `<span class="av-more">+${members.length - shown.length}</span>` : ''}</span>`;
  }

  App.views.chat = {
    title: 'Chat',
    render(root) {
      const me = M.me();
      const list = channels();
      if (!list.some((c) => c.id === vs.channel)) vs.channel = 'general';
      // Lo que se está viendo cuenta como leído (el aviso de "nuevos" se calcula antes)
      const narrow = window.matchMedia('(max-width: 900px)').matches;
      const convVisible = !(narrow && vs.mobileList);
      vs.prevRead = { ch: vs.channel, ts: lastRead(vs.channel) };
      if (convVisible && !document.hidden && markRead(vs.channel)) setTimeout(() => App.app.renderShell(), 0);
      const cur = list.find((c) => c.id === vs.channel);
      const people = cur.kind === 'event'
        ? M.members().filter((m) => cur.event.assignments.some((a) => a.memberId === m.id))
        : cur.kind === 'lideres' ? M.members().filter((m) => M.isLeader(m)) : M.members();
      const sub = cur.kind === 'event' ? `${U.fmtDate(cur.event.date, 'long')} · ${U.fmtTime(cur.event.time)} · ${U.plural(people.length, 'persona', 'personas')}` : cur.sub;

      root.innerHTML = `
        <div class="view view--chat">
          <header class="view-head chat-head">
            <div class="titles">
              <span class="eyebrow">Comunicación</span>
              <h1 class="view-title">Chat del equipo</h1>
            </div>
          </header>
          <div class="chat-layout ${vs.mobileList ? 'show-list' : 'show-conv'}">
            <nav class="chat-channels" aria-label="Canales">
              <p class="ch-group">Canales</p>
              ${list.map((c, i) => {
                const p = preview(c, me.id);
                const groupHead = c.kind === 'event' && (i === 0 || list[i - 1].kind !== 'event') ? '<p class="ch-group">Próximos eventos</p>' : '';
                return `${groupHead}
                  <button class="ch-item ${c.id === vs.channel ? 'is-on' : ''} ${p.unread ? 'has-unread' : ''}" data-ch="${esc(c.id)}">
                    ${channelAvatar(c)}
                    <span class="ch-text">
                      <span class="ch-top"><span class="ch-name truncate">${esc(c.name)}</span><span class="ch-time">${esc(p.time)}</span></span>
                      <span class="ch-bottom"><span class="ch-prev truncate">${esc(p.text)}</span>${p.unread ? `<span class="ch-unread">${p.unread > 99 ? '99+' : p.unread}</span>` : ''}</span>
                    </span>
                  </button>`;
              }).join('')}
            </nav>
            <section class="chat-conv">
              <header class="chat-conv-head">
                <button class="btn btn--plain btn--icon btn--sm chat-back" data-act="back" aria-label="Volver a canales">${I('chevron-left', 18)}</button>
                ${channelAvatar(cur, 'ch-av--lg')}
                <div class="grow chat-conv-title"><span class="strong truncate">${esc(cur.name)}</span><span class="xsmall faint truncate">${esc(sub)}</span></div>
                ${stack(people)}
                ${cur.kind === 'event' ? `<a class="btn btn--ghost btn--sm chat-ev-link" href="#evento-${esc(cur.id)}">${I('calendar', 14)}<span>Ver evento</span></a>` : ''}
              </header>
              <div id="chat-host"></div>
            </section>
          </div>
        </div>`;

      App.chatPanel(root.querySelector('#chat-host'), vs.channel, { visible: convVisible });
      vs.prevRead = null;

      root.addEventListener('click', (e) => {
        const ch = e.target.closest('[data-ch]');
        if (ch) { vs.channel = ch.dataset.ch; vs.mobileList = false; App.app.refresh(); return; }
        if (e.target.closest('[data-act="back"]')) { vs.mobileList = true; App.app.refresh(); }
      });
    }
  };

  // Al volver a la app, marcar como leído lo que está abierto
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !App.router || !App.router.current || App.router.current.name !== 'chat' || vs.mobileList) return;
    if (markRead(vs.channel) && App.app) App.app.renderShell();
  });
})();
