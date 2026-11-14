/* =========================================================================
   SELAH · Modelo: consultas sobre los datos
   Solo lee. Para modificar datos usa App.actions.
   ========================================================================= */
(function () {
  const U = App.utils;
  const S = () => App.store.state;

  const M = {};

  // ---- Acceso básico ----
  M.members = () => S().members;
  M.songs = () => S().songs;
  M.events = () => S().events;
  M.teams = () => S().teams;
  M.member = (id) => S().members.find((m) => m.id === id) || null;
  M.song = (id) => S().songs.find((s) => s.id === id) || null;
  M.event = (id) => S().events.find((e) => e.id === id) || null;
  M.team = (id) => S().teams.find((t) => t.id === id) || null;
  M.settings = () => S().settings;

  M.me = () => M.member(S().session.userId) || S().members[0];
  M.isLeader = (m = M.me()) => {
    if (!m) return false;
    if (App.cloud && App.cloud.enabled) {
      const p = App.cloud.profileOf(m.id);
      if (p) return !!p.es_lider;
    }
    return !!(m.leader || m.admin);
  };
  M.can = (action) => {
    const me = M.me();
    if (action === 'edit') return M.isLeader(me);
    return true;
  };

  // ---- Puestos ----
  M.position = (id) => App.config.positions.find((p) => p.id === id) || { id, label: id, group: 'voces' };
  M.posLabel = (id) => M.position(id).label;
  M.group = (id) => App.config.positionGroups.find((g) => g.id === id) || App.config.positionGroups[0];
  M.groupIcon = (posId) => M.group(M.position(posId).group).icon;

  M.slotLabel = (event, a) => {
    const same = event.assignments.filter((x) => x.position === a.position);
    if (same.length < 2) return M.posLabel(a.position);
    return `${M.posLabel(a.position)} ${same.indexOf(a) + 1}`;
  };

  M.typeLabel = (type) => (App.config.eventTypes[type] || { label: type }).label;

  // ---- Eventos ----
  const sortKey = (e) => `${e.date} ${e.time || '00:00'}`;
  M.sortEvents = (list, dir = 1) => list.slice().sort((a, b) => (sortKey(a) < sortKey(b) ? -dir : sortKey(a) > sortKey(b) ? dir : 0));

  M.upcoming = ({ days = 120, teamId = null, from = U.today() } = {}) => {
    const until = U.ymd(U.addDays(U.parseYmd(from), days));
    return M.sortEvents(S().events.filter((e) => e.date >= from && e.date <= until && (!teamId || e.teamId === teamId)));
  };

  M.past = ({ days = 90 } = {}) => {
    const today = U.today();
    const since = U.ymd(U.addDays(new Date(), -days));
    return M.sortEvents(S().events.filter((e) => e.date < today && e.date >= since), -1);
  };

  M.eventsOn = (ymd) => M.sortEvents(S().events.filter((e) => e.date === ymd));

  M.nextEvent = (filter = () => true) => M.upcoming().find(filter) || null;

  M.myUpcoming = (memberId) => {
    const out = [];
    M.upcoming({ days: 90 }).forEach((ev) => {
      ev.assignments.forEach((a) => { if (a.memberId === memberId) out.push({ event: ev, assignment: a }); });
    });
    return out;
  };

  M.eventStats = (ev) => {
    const st = { total: ev.assignments.length, confirmed: 0, pending: 0, declined: 0, empty: 0 };
    ev.assignments.forEach((a) => {
      if (!a.memberId) st.empty++;
      else st[a.status] = (st[a.status] || 0) + 1;
    });
    return st;
  };

  M.setlistDuration = (ev) => ev.setlist.reduce((sum, it) => sum + ((M.song(it.songId) || {}).duration || 0), 0);

  // ---- Personas y disponibilidad ----
  M.isUnavailable = (memberId, ymd) => {
    const m = M.member(memberId);
    return !!(m && (m.unavailable || []).includes(ymd));
  };

  M.bookedElsewhere = (memberId, event) => S().events.filter((e) => e.id !== event.id && e.date === event.date &&
    e.assignments.some((a) => a.memberId === memberId && a.status !== 'declined'));

  /** Lista de avisos para poner a alguien en un puesto. hard = no debería asignarse. */
  M.conflicts = (memberId, event, position) => {
    const m = M.member(memberId);
    if (!m) return [];
    const out = [];
    if (position && !m.roles.includes(position)) out.push({ code: 'puesto', label: 'No tiene este puesto', hard: true });
    if (M.isUnavailable(memberId, event.date)) out.push({ code: 'nodisp', label: 'Marcó este día como no disponible', hard: true });
    M.bookedElsewhere(memberId, event).forEach((e) => out.push({ code: 'doble', label: `También sirve en ${e.title} (${U.fmtTime(e.time)})`, hard: false }));
    return out;
  };

  /** Veces que sirvió en los últimos N días (sin contar rechazos). */
  M.servedCount = (memberId, days = App.config.rotation.lookbackDays) => {
    const today = U.today();
    const since = U.ymd(U.addDays(new Date(), -days));
    let n = 0;
    S().events.forEach((e) => {
      if (e.date < today && e.date >= since && e.assignments.some((a) => a.memberId === memberId && a.status !== 'declined')) n++;
    });
    return n;
  };

  /** Carga total (pasado + ya programado) que usa la rotación para repartir justo. */
  M.load = (memberId, exceptEventId) => {
    const cfg = App.config.rotation;
    const since = U.ymd(U.addDays(new Date(), -cfg.lookbackDays));
    const until = U.ymd(U.addDays(new Date(), cfg.lookaheadDays));
    let n = 0;
    S().events.forEach((e) => {
      if (e.id === exceptEventId || e.date < since || e.date > until) return;
      if (e.assignments.some((a) => a.memberId === memberId && a.status !== 'declined')) n++;
    });
    return n;
  };

  M.lastServed = (memberId) => {
    const today = U.today();
    const ev = M.sortEvents(S().events.filter((e) => e.date < today && e.assignments.some((a) => a.memberId === memberId && a.status !== 'declined')), -1)[0];
    return ev ? ev.date : null;
  };

  M.history = (memberId, limit = 8) => {
    const today = U.today();
    const out = [];
    M.sortEvents(S().events.filter((e) => e.date < today), -1).forEach((e) => {
      e.assignments.forEach((a) => { if (a.memberId === memberId) out.push({ event: e, assignment: a }); });
    });
    return out.slice(0, limit);
  };

  /** Candidatos para un puesto, ordenados por quién debería servir primero. */
  M.candidates = (event, position) => {
    return S().members
      .filter((m) => m.roles.includes(position))
      .map((m) => {
        const conflicts = M.conflicts(m.id, event, position);
        const inEvent = event.assignments.some((a) => a.memberId === m.id && a.position !== position && a.status !== 'declined');
        return { member: m, conflicts, inEvent, load: M.load(m.id, event.id), served: M.servedCount(m.id) };
      })
      .sort((a, b) => (a.conflicts.some((c) => c.hard) - b.conflicts.some((c) => c.hard)) || (a.load - b.load) || a.member.name.localeCompare(b.member.name));
  };

  M.voiceMembers = (event) => {
    const ids = new Set(event.assignments.filter((a) => a.memberId && M.position(a.position).voice).map((a) => a.memberId));
    return S().members.filter((m) => ids.has(m.id));
  };

  M.coverage = () => App.config.positions.map((p) => ({ position: p, count: S().members.filter((m) => m.roles.includes(p.id)).length }));

  // ---- Canciones ----
  M.songLastUsed = (songId) => {
    const today = U.today();
    const ev = M.sortEvents(S().events.filter((e) => e.date < today && e.setlist.some((it) => it.songId === songId)), -1)[0];
    return ev ? ev.date : null;
  };

  M.songUseCount = (songId, days = 120) => {
    const since = U.ymd(U.addDays(new Date(), -days));
    const today = U.today();
    return S().events.filter((e) => e.date >= since && e.date < today && e.setlist.some((it) => it.songId === songId)).length;
  };

  M.songEvents = (songId) => M.sortEvents(S().events.filter((e) => e.setlist.some((it) => it.songId === songId)), -1);

  M.bpm = (s) => (s && s.bpm ? `${s.bpm} BPM` : 'BPM —');

  M.tempoLabel = (id) => (App.config.tempos.find((t) => t.id === id) || { label: id }).label;

  M.allTags = () => {
    const set = new Set(App.config.songTags);
    S().songs.forEach((s) => (s.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  };

  // ---- Pendientes para líderes ----
  M.attention = (days = 21) => {
    const out = [];
    M.upcoming({ days }).forEach((ev) => {
      ev.assignments.forEach((a) => {
        if (!a.memberId) out.push({ event: ev, assignment: a, kind: 'empty' });
        else if (a.status === 'declined') out.push({ event: ev, assignment: a, kind: 'declined' });
      });
    });
    return out;
  };

  M.myPendingCount = () => M.myUpcoming(M.me().id).filter((x) => x.assignment.status === 'pending').length;

  App.model = M;
})();
