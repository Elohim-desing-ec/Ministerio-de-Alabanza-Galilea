/* =========================================================================
   SELAH · Vista: Asistente de IA
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc;
  const AI = App.ai;

  const suggestions = () => {
    const song = M.songs()[0];
    return [
      'Arma un setlist para el próximo domingo sobre la gracia',
      'Completa el equipo del próximo servicio por rotación',
      '¿Quién puede tocar batería el domingo?',
      '¿Quién no ha servido en el último mes?',
      song ? `Transpón «${song.title}» a ${App.chords.transposeKey(song.key, 2)}` : 'Crea un servicio el domingo a las 10 am',
      'Sugiere palabras de transición para el próximo servicio',
      'Crea un ensayo el jueves a las 7:30 pm',
      '¿Cómo va el próximo servicio?'
    ];
  };

  let mounted = null;

  function actionCard(msg, a, i) {
    const d = AI.describe(a);
    const done = msg.applied && msg.applied[i];
    return `
      <div class="ai-action">
        <div class="ai-action-head">
          <span class="ai-action-icon">${I(a.type === 'setlist' ? 'music' : a.type === 'assign' ? 'users' : a.type === 'event' ? 'calendar' : 'refresh', 16)}</span>
          <div class="grow"><span class="strong">${esc(d.title)}</span>${d.sub ? `<span class="xsmall faint" style="display:block">${esc(d.sub)}</span>` : ''}</div>
        </div>
        ${d.lines.length ? `<ul class="ai-action-list">${d.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
        <div class="row">
          <button class="btn btn--sm ${done ? 'btn--ghost' : 'btn--primary'}" data-apply="${esc(msg.id)}" data-idx="${i}" ${done ? 'disabled' : ''}>${I(done ? 'check' : 'arrow-right', 14)} ${done ? 'Aplicado' : esc(d.cta)}</button>
          ${a.eventId ? `<a class="btn btn--plain btn--sm" href="#evento-${esc(a.eventId)}">Ver evento</a>` : ''}
        </div>
      </div>`;
  }

  function bubble(msg) {
    if (msg.role === 'user') return `<div class="ai-msg ai-msg--user" data-id="${esc(msg.id)}"><div class="ai-bubble">${esc(msg.content)}</div></div>`;
    const streaming = msg.status === 'streaming';
    return `
      <div class="ai-msg ai-msg--bot ${msg.status === 'error' ? 'is-error' : ''}" data-id="${esc(msg.id)}">
        <span class="ai-avatar">${I('sparkle', 16)}</span>
        <div class="ai-body">
          <div class="md ai-text">${msg.content ? App.md(msg.content) : (streaming ? '<span class="typing"><span></span><span></span><span></span></span>' : '')}</div>
          ${msg.actions && msg.actions.length ? `<div class="ai-actions">${msg.actions.map((a, i) => actionCard(msg, a, i)).join('')}</div>` : ''}
          <div class="ai-meta xsmall faint">${msg.provider ? esc(msg.provider) : ''}${msg.note ? ` · ${esc(msg.note)}` : ''}</div>
        </div>
      </div>`;
  }

  function welcome() {
    const me = M.me();
    return `
      <div class="ai-welcome">
        <span class="ai-welcome-mark">${I('sparkle', 26)}</span>
        <h2>¿En qué te ayudo, ${esc(U.firstName(me.name))}?</h2>
        <p class="muted">Conozco el repertorio, el equipo y la agenda. Puedo proponer cambios, y tú decides si se aplican.</p>
        <div class="ai-suggest">${suggestions().map((s) => `<button class="ai-chip" data-suggest="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      </div>`;
  }

  async function providerBadge(el) {
    const p = await AI.resolve();
    if (!el.isConnected) return;
    const tone = p.id === 'local' ? 'local' : 'live';
    el.innerHTML = `<span class="ai-dot ai-dot--${tone}"></span>${esc(p.label)}`;
    el.title = p.description;
  }

  App.views.asistente = {
    title: 'Asistente',
    onLeave() { if (mounted) { mounted(); mounted = null; } },
    render(root) {
      const events = M.upcoming({ days: 60 });
      const focus = AI.focusEventId;
      root.innerHTML = `
        <div class="view view--ai">
          <header class="view-head">
            <div class="titles">
              <span class="eyebrow">Inteligencia artificial</span>
              <h1 class="view-title">Asistente</h1>
            </div>
            <div class="view-actions">
              <span class="ai-provider" id="ai-provider"><span class="ai-dot"></span>Buscando…</span>
              <a class="btn btn--ghost btn--sm" href="#ajustes">${I('sliders', 14)} Configurar IA</a>
              ${AI.history.length ? `<button class="btn btn--plain btn--sm" data-act="clear">${I('refresh', 14)} Nueva conversación</button>` : ''}
            </div>
          </header>

          <section class="ai-shell card">
            <div class="ai-scroll" id="ai-scroll">
              ${AI.history.length ? AI.history.map(bubble).join('') : welcome()}
            </div>
            <form class="ai-compose" id="ai-form" autocomplete="off">
              <div class="ai-focus">
                <label class="xsmall faint" for="ai-event">Sobre</label>
                <select class="select select--sm" id="ai-event">
                  <option value="">Todo el ministerio</option>
                  ${events.map((e) => `<option value="${esc(e.id)}" ${e.id === focus ? 'selected' : ''}>${esc(e.title)} · ${U.fmtDate(e.date, 'short')}</option>`).join('')}
                </select>
              </div>
              <div class="ai-input-row">
                <label class="sr-only" for="ai-text">Mensaje para el asistente</label>
                <textarea class="textarea" id="ai-text" rows="1" placeholder="Pide un setlist, completa un equipo, transpón una canción…"></textarea>
                ${AI.busy ? `<button class="btn btn--ghost btn--icon" type="button" data-act="stop" aria-label="Detener">${I('stop', 16)}</button>` : `<button class="btn btn--primary btn--icon" type="submit" aria-label="Enviar">${I('send', 17)}</button>`}
              </div>
            </form>
          </section>
        </div>`;

      const scroll = root.querySelector('#ai-scroll');
      const ta = root.querySelector('#ai-text');
      const sel = root.querySelector('#ai-event');
      scroll.scrollTop = scroll.scrollHeight;
      providerBadge(root.querySelector('#ai-provider'));

      const submit = () => {
        const text = ta.value.trim();
        if (!text || AI.busy) return;
        ta.value = '';
        AI.send(text, { eventId: sel.value || null });
      };
      root.querySelector('#ai-form').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
      ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; });
      sel.addEventListener('change', () => { AI.focusEventId = sel.value || null; });

      root.addEventListener('click', (e) => {
        const sug = e.target.closest('[data-suggest]');
        if (sug) { AI.send(sug.dataset.suggest, { eventId: sel.value || null }); return; }
        const ap = e.target.closest('[data-apply]');
        if (ap) { AI.apply(ap.dataset.apply, Number(ap.dataset.idx)); return; }
        const act = e.target.closest('[data-act]');
        if (act && act.dataset.act === 'clear') AI.clear();
        if (act && act.dataset.act === 'stop') AI.stop();
      });

      // Actualizaciones del asistente: streaming sin redibujar toda la vista
      if (mounted) mounted();
      mounted = AI.on((type) => {
        if (!root.isConnected) return;
        if (type === 'stream') {
          const last = AI.history[AI.history.length - 1];
          const el = scroll.querySelector(`[data-id="${CSS.escape(last.id)}"] .ai-text`);
          if (el) { el.innerHTML = App.md(last.content); scroll.scrollTop = scroll.scrollHeight; }
          return;
        }
        const draft = ta.value;
        App.app.refresh();
        const nta = document.getElementById('ai-text');
        if (nta) { nta.value = draft; if (!AI.busy) nta.focus({ preventScroll: true }); }
      });
    }
  };
})();
