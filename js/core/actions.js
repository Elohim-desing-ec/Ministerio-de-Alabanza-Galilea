/* =========================================================================
   SELAH · Acciones: todo cambio de datos pasa por aquí.
   Las vistas y el asistente de IA llaman a estas funciones; así la lógica
   vive en un solo lugar y es fácil conectarla a un backend más adelante.
   ========================================================================= */
(function () {
  const U = App.utils;
  const store = App.store;
  const findEvent = (s, id) => s.events.find((e) => e.id === id);

  const A = {};

  A.nextSlotId = (ev, position) => {
    let i = 1;
    while (ev.assignments.some((a) => a.slot === `${position}-${i}`)) i++;
    return `${position}-${i}`;
  };

  A.slotsFor = (type) => {
    const counts = {};
    return (App.config.eventTypes[type] || App.config.eventTypes.servicio).slots.map((p) => {
      counts[p] = (counts[p] || 0) + 1;
      return { slot: `${p}-${counts[p]}`, position: p, memberId: null, status: 'pending' };
    });
  };

  // ---- Eventos ----
  A.createEvent = (data) => {
    const ev = {
      id: U.uid('e'),
      title: data.title || 'Nuevo evento',
      type: data.type || 'servicio',
      date: data.date || U.today(),
      time: data.time || '10:00',
      place: data.place || '',
      teamId: data.teamId || null,
      notes: data.notes || '',
      setlist: [],
      assignments: A.slotsFor(data.type || 'servicio')
    };
    store.update((s) => { s.events.push(ev); });
    return ev;
  };

  A.updateEvent = (id, patch) => store.update((s) => { Object.assign(findEvent(s, id), patch); });

  A.deleteEvent = (id) => store.update((s) => {
    s.events = s.events.filter((e) => e.id !== id);
    s.messages = s.messages.filter((m) => m.channel !== id);
  });

  A.duplicateEvent = (id, date) => {
    const src = App.model.event(id);
    if (!src) return null;
    const ev = U.clone(src);
    ev.id = U.uid('e');
    ev.date = date || U.ymd(U.addDays(U.parseYmd(src.date), 7));
    ev.assignments.forEach((a) => { a.memberId = null; a.status = 'pending'; });
    store.update((s) => { s.events.push(ev); });
    return ev;
  };

  // ---- Equipo del evento ----
  A.assign = (eventId, slot, memberId) => store.update((s) => {
    const a = findEvent(s, eventId).assignments.find((x) => x.slot === slot);
    a.memberId = memberId || null;
    a.status = 'pending';
  });

  A.setStatus = (eventId, slot, status) => store.update((s) => {
    const a = findEvent(s, eventId).assignments.find((x) => x.slot === slot);
    if (a) a.status = status;
  });

  /** La persona toca otro de sus instrumentos ese día (ej.: bajo en vez de batería). */
  A.changePosition = (eventId, slot, position) => store.update((s) => {
    const ev = findEvent(s, eventId);
    const a = ev.assignments.find((x) => x.slot === slot);
    if (!a || !a.memberId || a.position === position) return;
    const { memberId, status } = a;
    a.memberId = null;
    a.status = 'pending';
    let target = ev.assignments.find((x) => x.position === position && (!x.memberId || x.status === 'declined'));
    if (!target) {
      target = { slot: A.nextSlotId(ev, position), position, memberId: null, status: 'pending' };
      ev.assignments.push(target);
    }
    target.memberId = memberId;
    target.status = status;
  });

  A.addSlot = (eventId, position) => store.update((s) => {
    const ev = findEvent(s, eventId);
    ev.assignments.push({ slot: A.nextSlotId(ev, position), position, memberId: null, status: 'pending' });
  });

  A.removeSlot = (eventId, slot) => store.update((s) => {
    const ev = findEvent(s, eventId);
    ev.assignments = ev.assignments.filter((a) => a.slot !== slot);
  });

  // ---- Setlist ----
  A.addSong = (eventId, songId, key) => store.update((s) => {
    const song = s.songs.find((x) => x.id === songId);
    findEvent(s, eventId).setlist.push({ songId, key: key || (song && song.key) || 'C', leaderId: null, notes: '' });
  });

  A.removeSong = (eventId, index) => store.update((s) => { findEvent(s, eventId).setlist.splice(index, 1); });

  A.moveSong = (eventId, from, to) => store.update((s) => {
    const list = findEvent(s, eventId).setlist;
    if (to < 0 || to >= list.length) return;
    const [it] = list.splice(from, 1);
    list.splice(to, 0, it);
  });

  A.updateSetItem = (eventId, index, patch) => store.update((s) => {
    Object.assign(findEvent(s, eventId).setlist[index], patch);
  });

  A.setSetlist = (eventId, items) => store.update((s) => {
    findEvent(s, eventId).setlist = items
      .filter((it) => s.songs.some((x) => x.id === it.songId))
      .map((it) => ({ songId: it.songId, key: it.key || s.songs.find((x) => x.id === it.songId).key, leaderId: it.leaderId || null, notes: it.notes || '' }));
  });

  // ---- Canciones ----
  A.saveSong = (song) => {
    if (!song.id) song.id = U.uid('s');
    store.upsert('songs', song);
    return song;
  };

  A.deleteSong = (id) => store.update((s) => {
    s.songs = s.songs.filter((x) => x.id !== id);
    s.events.forEach((e) => { e.setlist = e.setlist.filter((it) => it.songId !== id); });
  });

  // ---- Personas ----
  A.saveMember = (m) => {
    if (!m.id) m.id = U.uid('m');
    store.upsert('members', m);
    return m;
  };

  A.deleteMember = (id) => store.update((s) => {
    s.members = s.members.filter((m) => m.id !== id);
    s.events.forEach((e) => {
      e.assignments.forEach((a) => { if (a.memberId === id) { a.memberId = null; a.status = 'pending'; } });
      e.setlist.forEach((it) => { if (it.leaderId === id) it.leaderId = null; });
    });
    if (s.session.userId === id) s.session.userId = s.members[0] && s.members[0].id;
  });

  A.toggleUnavailable = (memberId, ymd) => {
    let nowBlocked = false;
    store.update((s) => {
      const m = s.members.find((x) => x.id === memberId);
      m.unavailable = m.unavailable || [];
      const i = m.unavailable.indexOf(ymd);
      if (i >= 0) m.unavailable.splice(i, 1); else { m.unavailable.push(ymd); m.unavailable.sort(); nowBlocked = true; }
    });
    return nowBlocked;
  };

  A.saveTeam = (team) => {
    if (!team.id) team.id = U.uid('t');
    store.upsert('teams', team);
    return team;
  };

  A.switchUser = (id) => store.update((s) => { s.session.userId = id; });

  // ---- Mensajes ----
  A.sendMessage = (channel, text, memberId = App.model.me().id) => {
    const msg = { id: U.uid('c'), channel, memberId, text: String(text).trim(), ts: Date.now() };
    if (!msg.text) return null;
    store.update((s) => { s.messages.push(msg); });
    return msg;
  };

  /** Reacción con emoji: la misma persona la pone o la quita. */
  A.react = (messageId, emoji, memberId = App.model.me().id) => store.update((s) => {
    const msg = s.messages.find((m) => m.id === messageId);
    if (!msg) return;
    const r = msg.reactions = Object.assign({}, msg.reactions);
    const list = (r[emoji] || []).slice();
    const i = list.indexOf(memberId);
    if (i >= 0) list.splice(i, 1); else list.push(memberId);
    if (list.length) r[emoji] = list; else delete r[emoji];
  });

  A.deleteMessage = (id) => store.update((s) => { s.messages = s.messages.filter((m) => m.id !== id); });

  // ---- Links de música ----
  const cleanLink = (data, memberId) => ({
    id: U.uid('l'),
    url: String(data.url || '').trim(),
    title: String(data.title || '').trim().slice(0, 140),
    songId: data.songId || null,
    memberId: memberId || null,
    ts: Date.now()
  });

  /** Cualquier persona del equipo puede compartir un link en un evento. */
  A.addEventLink = (eventId, data, memberId = App.model.me().id) => {
    const link = cleanLink(data, memberId);
    if (!link.url) return null;
    store.update((s) => {
      const ev = findEvent(s, eventId);
      if (ev) ev.links = (ev.links || []).concat(link);
    });
    return link;
  };

  A.removeEventLink = (eventId, linkId) => store.update((s) => {
    const ev = findEvent(s, eventId);
    if (ev) ev.links = (ev.links || []).filter((l) => l.id !== linkId);
  });

  /** Grabaciones de referencia de una canción (solo líderes). */
  A.addSongLink = (songId, data) => {
    const link = cleanLink(data, App.model.me().id);
    if (!link.url) return null;
    store.update((s) => {
      const song = s.songs.find((x) => x.id === songId);
      if (song) song.links = (song.links || []).concat(link);
    });
    return link;
  };

  A.removeSongLink = (songId, linkId) => store.update((s) => {
    const song = s.songs.find((x) => x.id === songId);
    if (song) song.links = (song.links || []).filter((l) => l.id !== linkId);
  });

  // ---- Rachas: verificar que el servicio se cumplió ----
  A.verifyEvent = (eventId, { done = [], missed = [] }) => store.update((s) => {
    const ev = findEvent(s, eventId);
    if (ev) ev.verified = { at: Date.now(), by: App.model.me().id, done: done.slice(), missed: missed.slice() };
  });

  A.unverifyEvent = (eventId) => store.update((s) => {
    const ev = findEvent(s, eventId);
    if (ev) delete ev.verified;
  });

  A.updateSettings = (patch) => store.update((s) => { Object.assign(s.settings, patch); });

  App.actions = A;
})();
