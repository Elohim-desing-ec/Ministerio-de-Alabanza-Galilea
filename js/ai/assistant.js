/* =========================================================================
   SELAH · Asistente de IA (núcleo)
   Proveedores intercambiables, todos con la misma forma:
     { id, label, description, available(settings) → Promise<bool>,
       ask({ system, context, messages, text, onText, signal, settings }) → Promise<string> }
   Para agregar otro (por ejemplo, tu propio servidor), crea un archivo en
   js/ai/providers/ que llame a App.ai.register({...}).

   El modelo propone cambios con bloques ```accion {json}```. La app los
   valida (que existan los ids) y muestra un botón "Aplicar"; nunca se
   cambia nada sin que un líder lo apruebe.
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, C = App.chords;
  const AI = App.ai;
  const listeners = new Set();

  AI.history = [];
  AI.busy = false;
  AI.focusEventId = null;
  AI.lastProvider = null;
  let controller = null;

  // ---------------------------------------------------------------------
  // Configuración (guardada aparte de los datos: las claves no se exportan)
  // ---------------------------------------------------------------------
  AI.settings = function settings() {
    const cfg = App.config.ai;
    const saved = App.storage.load(App.config.aiStorageKey) || {};
    return {
      provider: saved.provider || 'auto',
      gemini: Object.assign({ key: '', model: cfg.gemini.model }, saved.gemini || {}),
      openai: Object.assign({ baseUrl: cfg.openai.baseUrl, key: '', model: cfg.openai.model }, saved.openai || {})
    };
  };
  AI.saveSettings = (s) => { App.storage.save(App.config.aiStorageKey, s); AI.lastProvider = null; emit('change'); };

  AI.register = (p) => { AI.providers[p.id] = p; };

  /** Elige el primer proveedor disponible según la configuración. */
  AI.resolve = async function resolve() {
    const s = AI.settings();
    const order = s.provider === 'auto' ? App.config.ai.order : [s.provider, 'local'];
    for (const id of order) {
      const p = AI.providers[id];
      if (!p) continue;
      try { if (await p.available(s)) { AI.lastProvider = p; return p; } } catch (e) { /* siguiente */ }
    }
    AI.lastProvider = AI.providers.local;
    return AI.providers.local;
  };

  AI.on = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  function emit(type) { Array.from(listeners).forEach((fn) => { try { fn(type); } catch (e) { console.error(e); } }); }

  // ---------------------------------------------------------------------
  // Contexto que se envía al modelo (compacto para ahorrar tokens)
  // ---------------------------------------------------------------------
  AI.buildContext = function buildContext(focusId) {
    const s = App.store.state;
    const today = U.today();
    const me = M.me();
    const L = [];
    L.push(`HOY: ${today} (${U.fmtDate(today, 'long')})`);
    L.push(`IGLESIA: ${s.settings.churchName} · ${s.settings.ministryName}`);
    L.push(`USUARIO ACTUAL: ${me.name} (${me.id})${M.isLeader(me) ? ' · líder' : ''}`);
    L.push(`PUESTOS: ${App.config.positions.map((p) => `${p.id}=${p.label}`).join(', ')}`);
    L.push(`EQUIPOS: ${s.teams.map((t) => `${t.id}=${t.name}`).join(', ')}`);
    L.push('');
    L.push('CANCIONES (id | título | tono | bpm | ritmo | temas | última vez usada):');
    s.songs.forEach((x) => L.push(`${x.id} | ${x.title} | ${x.key} | ${x.bpm} | ${x.tempo} | ${(x.tags || []).join(', ')} | ${M.songLastUsed(x.id) || 'nunca'}`));
    L.push('');
    L.push('MIEMBROS (id | nombre | puestos | equipos | fechas no disponibles | servicios últimos 60 días):');
    s.members.forEach((m) => L.push(`${m.id} | ${m.name} | ${m.roles.join(', ')} | ${(m.teams || []).join(', ')} | ${(m.unavailable || []).filter((d) => d >= today).join(', ') || '-'} | ${M.servedCount(m.id)}`));
    L.push('');
    L.push('EVENTOS PRÓXIMOS:');
    const evs = M.upcoming({ days: 45 }).slice(0, 7);
    const focus = focusId ? M.event(focusId) : null;
    if (focus && !evs.includes(focus)) evs.unshift(focus);
    evs.forEach((e) => {
      L.push(`${e.id} | ${e.date} ${e.time} | ${e.title} | tipo ${e.type} | equipo ${e.teamId || '-'} | lugar ${e.place || '-'}${e.notes ? ' | notas: ' + e.notes.replace(/\n/g, ' ') : ''}`);
      L.push(`   setlist: ${e.setlist.length ? e.setlist.map((it) => `${(M.song(it.songId) || {}).title} (${it.key}${it.leaderId ? ', dirige ' + (M.member(it.leaderId) || {}).name : ''})`).join('; ') : '(vacío)'}`);
      L.push(`   puestos: ${e.assignments.map((a) => `${a.slot}=${a.memberId ? (M.member(a.memberId) || {}).name + '[' + a.status + ']' : '(vacío)'}`).join('; ')}`);
    });
    if (focus) L.push(`\nEVENTO EN FOCO: ${focus.id} (${focus.title}, ${focus.date})`);
    return L.join('\n');
  };

  AI.systemPrompt = function systemPrompt() {
    const s = App.store.state.settings;
    return `Eres el asistente del ${s.ministryName} de ${s.churchName}, dentro de la app ${App.config.appName}.
Ayudas a líderes y músicos a planificar la alabanza: setlists, rotación justa del equipo, tonalidades, ensayos y palabras de transición entre canciones.

Reglas:
- Responde en español, breve y práctico, con markdown simple (negritas, listas). Sin emojis.
- Usa SOLO las canciones, personas y eventos de los DATOS. No inventes canciones ni personas.
- Setlists: buen flujo (abre con canciones rápidas de celebración, luego medias, cierra con lentas de adoración), tonalidades cercanas entre canciones seguidas, relación con el tema o las notas del evento, y evita repetir lo cantado la semana anterior si hay alternativas.
- Asignaciones: la persona debe tener ese puesto, no tener la fecha como no disponible, no estar en otro puesto del mismo evento, y reparte de forma justa (prioriza a quien tiene menos servicios en 60 días). Prefiere miembros del equipo del evento.
- Si citas la Biblia, da solo la referencia (por ejemplo, Salmo 95:6), sin copiar el texto.
- Cuando propongas un cambio que la app pueda aplicar, termina tu respuesta con UN bloque así (JSON válido, ids exactos de los DATOS):
\`\`\`accion
{"tipo":"setlist","evento":"<id evento>","canciones":[{"id":"<id canción>","tono":"G"}]}
\`\`\`
Otros formatos válidos:
{"tipo":"asignar","evento":"<id>","asignaciones":[{"slot":"<slot>","puesto":"<id puesto>","miembro":"<id miembro>"}]}
{"tipo":"evento","titulo":"Ensayo general","fecha":"AAAA-MM-DD","hora":"19:30","tipoEvento":"ensayo|servicio|jovenes|especial","lugar":"...","equipo":"<id equipo o vacío>"}
{"tipo":"tono","cancion":"<id canción>","tono":"D","evento":"<id evento opcional>"}
- La app muestra un botón "Aplicar"; no digas que ya hiciste el cambio.`;
  };

  // ---------------------------------------------------------------------
  // Acciones propuestas por la IA
  // ---------------------------------------------------------------------
  const ACTION_RE = /```\s*(?:accion|acción|action|json)\s*\n?([\s\S]*?)```/gi;

  function normalizeAction(o) {
    if (!o || typeof o !== 'object') return null;
    const tipo = U.normalize(o.tipo || o.type || '');
    const ev = M.event(o.evento || o.eventId || o.event);
    if (tipo === 'setlist' && ev) {
      const items = (o.canciones || o.songs || []).map((c) => {
        const id = typeof c === 'string' ? c : (c.id || c.cancion || c.songId);
        const song = M.song(id);
        if (!song) return null;
        const key = C.readKey(c.tono || c.key) || song.key;
        return { songId: song.id, key };
      }).filter(Boolean);
      return items.length ? { type: 'setlist', eventId: ev.id, items } : null;
    }
    if ((tipo === 'asignar' || tipo === 'assign') && ev) {
      const items = (o.asignaciones || o.assignments || []).map((a) => {
        const m = M.member(a.miembro || a.memberId || a.member);
        const pos = a.puesto || a.position || (a.slot ? String(a.slot).replace(/-\d+$/, '') : null);
        if (!m || !pos || !App.config.positions.some((p) => p.id === pos)) return null;
        return { slot: a.slot || null, position: pos, memberId: m.id };
      }).filter(Boolean);
      return items.length ? { type: 'assign', eventId: ev.id, items } : null;
    }
    if (tipo === 'evento' || tipo === 'event') {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(o.fecha || o.date || '') ? (o.fecha || o.date) : null;
      if (!date) return null;
      const type = App.config.eventTypes[o.tipoEvento || o.eventType] ? (o.tipoEvento || o.eventType) : 'servicio';
      return { type: 'event', data: { title: o.titulo || o.title || M.typeLabel(type), date, time: /^\d{1,2}:\d{2}$/.test(o.hora || o.time || '') ? (o.hora || o.time).padStart(5, '0') : '19:00', type, place: o.lugar || o.place || '', teamId: M.team(o.equipo || o.teamId) ? (o.equipo || o.teamId) : null, notes: o.notas || '' } };
    }
    if (tipo === 'tono' || tipo === 'key') {
      const song = M.song(o.cancion || o.songId);
      const key = C.readKey(o.tono || o.key);
      if (!song || !key) return null;
      return { type: 'key', songId: song.id, key, eventId: ev ? ev.id : null };
    }
    return null;
  }

  AI.parse = function parse(raw) {
    const actions = [];
    const clean = String(raw || '').replace(ACTION_RE, (m, body) => {
      try {
        const json = JSON.parse(body.trim());
        (Array.isArray(json) ? json : [json]).forEach((o) => { const a = normalizeAction(o); if (a) actions.push(a); });
        return '';
      } catch (e) { return m; }
    }).trim();
    return { clean, actions };
  };

  /** Mientras llega el texto, oculta el bloque de acción a medio escribir. */
  const visiblePart = (t) => { const i = t.search(/```\s*(accion|acción|action|json)/i); return (i >= 0 ? t.slice(0, i) : t).trim(); };

  AI.describe = function describe(a) {
    const nota = App.store.state.prefs.notation;
    if (a.type === 'setlist') {
      const ev = M.event(a.eventId);
      return { title: `Setlist para ${ev ? ev.title : 'el evento'}`, sub: ev ? U.fmtDate(ev.date, 'long') : '', lines: a.items.map((it, i) => `${i + 1}. ${M.song(it.songId).title} · ${C.formatKey(it.key, nota)}`), cta: 'Usar este setlist' };
    }
    if (a.type === 'assign') {
      const ev = M.event(a.eventId);
      return { title: `Equipo para ${ev ? ev.title : 'el evento'}`, sub: ev ? U.fmtDate(ev.date, 'long') : '', lines: a.items.map((it) => `${M.posLabel(it.position)}: ${M.member(it.memberId).name}`), cta: `Asignar ${U.plural(a.items.length, 'persona', 'personas')}` };
    }
    if (a.type === 'event') {
      return { title: `Nuevo evento: ${a.data.title}`, sub: `${U.fmtDate(a.data.date, 'long')} · ${U.fmtTime(a.data.time)}`, lines: [`Tipo: ${M.typeLabel(a.data.type)}`, a.data.place ? `Lugar: ${a.data.place}` : null].filter(Boolean), cta: 'Crear evento' };
    }
    if (a.type === 'key') {
      const s = M.song(a.songId);
      const ev = a.eventId ? M.event(a.eventId) : null;
      return { title: `${s.title} en ${C.formatKey(a.key, nota)}`, sub: ev ? `En ${ev.title}` : 'Abrir la hoja transpuesta', lines: [], cta: ev ? 'Cambiar tono en el evento' : 'Abrir en ese tono' };
    }
    return { title: 'Acción', lines: [], cta: 'Aplicar' };
  };

  AI.apply = async function apply(msgId, index) {
    const msg = AI.history.find((h) => h.id === msgId);
    const a = msg && msg.actions[index];
    if (!a) return;
    if (a.type !== 'key' && !M.isLeader()) { App.ui.toast('Solo un líder puede aplicar cambios al evento.', { kind: 'warn' }); return; }
    if (a.type === 'setlist') {
      const ev = M.event(a.eventId);
      if (ev.setlist.length) {
        const ok = await App.ui.confirm({ title: 'Reemplazar setlist', message: `"${ev.title}" ya tiene ${U.plural(ev.setlist.length, 'canción', 'canciones')}. ¿Reemplazarlas por la sugerencia?`, confirmLabel: 'Reemplazar' });
        if (!ok) return;
      }
      App.actions.setSetlist(a.eventId, a.items);
      App.ui.toast('Setlist aplicado.', { action: { label: 'Ver evento', onClick: () => { App.viewState.event.tab = 'setlist'; App.router.go('evento', a.eventId); } } });
    } else if (a.type === 'assign') {
      const n = App.rotation.apply(a.eventId, a.items);
      App.ui.toast(`${U.plural(n, 'persona asignada', 'personas asignadas')}.`, { action: { label: 'Ver equipo', onClick: () => { App.viewState.event.tab = 'equipo'; App.router.go('evento', a.eventId); } } });
    } else if (a.type === 'event') {
      const ev = App.actions.createEvent(a.data);
      App.ui.toast('Evento creado.', { action: { label: 'Abrir', onClick: () => App.router.go('evento', ev.id) } });
    } else if (a.type === 'key') {
      if (a.eventId) {
        const ev = M.event(a.eventId);
        const idx = ev.setlist.findIndex((it) => it.songId === a.songId);
        if (idx >= 0) App.actions.updateSetItem(a.eventId, idx, { key: a.key });
      }
      App.viewState.song.keys[a.songId] = a.key;
      App.router.go('cancion', a.songId);
    }
    msg.applied = msg.applied || {};
    msg.applied[index] = true;
    emit('change');
  };

  // ---------------------------------------------------------------------
  // Conversación
  // ---------------------------------------------------------------------
  /** Une turnos seguidos del mismo rol y empieza siempre con el usuario. */
  function cleanTurns(list) {
    const out = [];
    list.forEach((t) => {
      if (!t.content) return;
      const last = out[out.length - 1];
      if (last && last.role === t.role) last.content += '\n\n' + t.content;
      else out.push({ role: t.role, content: t.content });
    });
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }

  AI.send = async function send(text, { eventId } = {}) {
    text = String(text || '').trim();
    if (!text || AI.busy) return;
    if (eventId) AI.focusEventId = eventId;
    const focus = AI.focusEventId && M.event(AI.focusEventId) ? AI.focusEventId : null;

    AI.history.push({ id: U.uid('q'), role: 'user', content: text });
    const msg = { id: U.uid('r'), role: 'assistant', content: '', actions: [], status: 'streaming', applied: {} };
    AI.history.push(msg);
    AI.busy = true;
    emit('change');

    const settings = AI.settings();
    const provider = await AI.resolve();
    msg.provider = provider.label;
    controller = new AbortController();

    const turns = cleanTurns(AI.history.filter((h) => h !== msg && h.status !== 'error').slice(-9).map((h) => ({ role: h.role, content: h.role === 'assistant' ? (h.raw || h.content) : h.content })));
    const req = {
      system: AI.systemPrompt(), context: AI.buildContext(focus), messages: turns, text, focusEventId: focus, settings,
      signal: controller.signal,
      onText: (t) => { msg.content = visiblePart(t); emit('stream'); }
    };

    try {
      const raw = await provider.ask(req);
      finish(msg, raw);
    } catch (err) {
      if (err && err.name === 'AbortError') {
        msg.status = 'done';
        msg.content = (msg.content || '') + '\n\n*(Respuesta detenida)*';
      } else if (provider.id !== 'local') {
        try {
          const raw = await AI.providers.local.ask(Object.assign({}, req, { onText: req.onText }));
          finish(msg, raw);
          msg.provider = AI.providers.local.label;
          msg.note = `${provider.label} no respondió (${(err && err.message) || 'error'}). Respondió el motor local.`;
        } catch (e2) {
          msg.status = 'error';
          msg.content = 'No pude responder. ' + ((e2 && e2.message) || '');
        }
      } else {
        msg.status = 'error';
        msg.content = 'No pude responder. ' + ((err && err.message) || '');
      }
    }
    controller = null;
    AI.busy = false;
    emit('change');
  };

  function finish(msg, raw) {
    const { clean, actions } = AI.parse(raw);
    msg.raw = raw;
    msg.content = clean || (actions.length ? 'Aquí está mi propuesta:' : '');
    msg.actions = actions;
    msg.status = 'done';
  }

  AI.stop = () => { if (controller) controller.abort(); };
  AI.clear = () => { if (AI.busy) return; AI.history = []; emit('change'); };

  /** Abre el asistente con una pregunta sobre un evento. */
  AI.askAbout = (text, eventId) => {
    AI.focusEventId = eventId || null;
    App.router.go('asistente');
    setTimeout(() => AI.send(text, { eventId }), 60);
  };

  /** Prueba un proveedor concreto (desde Ajustes). */
  AI.test = async (id) => {
    const p = AI.providers[id];
    const settings = AI.settings();
    if (!p) throw new Error('Proveedor desconocido');
    if (!(await p.available(settings))) throw new Error('Falta configurarlo (clave o dirección).');
    const out = await p.ask({ system: 'Responde únicamente con la palabra: listo', context: '', messages: [{ role: 'user', content: 'Prueba de conexión' }], text: 'Prueba de conexión', settings, onText: null });
    return out;
  };
})();
