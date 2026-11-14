/* =========================================================================
   SELAH · Rotación justa del equipo
   Para cada puesto vacío (o rechazado) elige a quien:
     1. tenga ese puesto,
     2. esté disponible ese día,
     3. no tenga ya otro puesto en el mismo evento,
     4. haya servido MENOS en los últimos 60 días + próximos 30,
     5. de preferencia sea del equipo asignado al evento.
   No modifica nada: devuelve un plan que luego se aplica con apply().
   ========================================================================= */
(function () {
  const M = App.model;

  function reasonFor(c, event) {
    const parts = [`${c.load === 0 ? 'Sin servicios' : c.load === 1 ? '1 servicio' : c.load + ' servicios'} en el periodo`];
    if (event.teamId && !(c.member.teams || []).includes(event.teamId)) parts.push('de otro equipo');
    if (c.conflicts.some((x) => x.code === 'doble')) parts.push('sirve en otro evento ese día');
    return parts.join(' · ');
  }

  function plan(event, { replaceDeclined = true } = {}) {
    const cfg = App.config.rotation;
    const declined = new Set(event.assignments.filter((a) => a.status === 'declined').map((a) => a.memberId));
    const taken = new Set(event.assignments.filter((a) => a.memberId && a.status !== 'declined').map((a) => a.memberId));
    const extra = {};
    const out = [];

    event.assignments.forEach((a) => {
      const needs = !a.memberId || (replaceDeclined && a.status === 'declined');
      if (!needs) return;

      const ranked = M.members()
        .filter((m) => m.roles.includes(a.position) && !taken.has(m.id) && !declined.has(m.id))
        .map((m) => {
          const conflicts = M.conflicts(m.id, event, a.position);
          const load = M.load(m.id, event.id) + (extra[m.id] || 0);
          let score = load * 10;
          if (event.teamId && !(m.teams || []).includes(event.teamId)) score += cfg.otherTeamPenalty * 10;
          if (conflicts.some((c) => c.code === 'doble')) score += cfg.sameDayPenalty * 10;
          if (m.roles[0] !== a.position) score += 3; // prefiere a quien tiene ese puesto como principal
          return { member: m, conflicts, load, score, hard: conflicts.some((c) => c.hard) };
        })
        .filter((c) => !c.hard)
        .sort((x, y) => x.score - y.score || x.member.name.localeCompare(y.member.name));

      const pick = ranked[0];
      if (pick) {
        taken.add(pick.member.id);
        extra[pick.member.id] = (extra[pick.member.id] || 0) + 1;
        out.push({ slot: a.slot, position: a.position, memberId: pick.member.id, reason: reasonFor(pick, event), replaces: a.status === 'declined' ? a.memberId : null });
      } else {
        out.push({ slot: a.slot, position: a.position, memberId: null, reason: 'Nadie disponible con este puesto' });
      }
    });
    return out;
  }

  function apply(eventId, items) {
    let n = 0;
    App.store.update((s) => {
      const ev = s.events.find((e) => e.id === eventId);
      if (!ev) return;
      items.forEach((p) => {
        if (!p.memberId || !s.members.some((m) => m.id === p.memberId)) return;
        let a = p.slot ? ev.assignments.find((x) => x.slot === p.slot) : null;
        if (!a) a = ev.assignments.find((x) => x.position === p.position && (!x.memberId || x.status === 'declined'));
        if (!a) {
          a = { slot: App.actions.nextSlotId(ev, p.position), position: p.position, memberId: null, status: 'pending' };
          ev.assignments.push(a);
        }
        a.memberId = p.memberId;
        a.status = 'pending';
        n++;
      });
    });
    return n;
  }

  App.rotation = { plan, apply };
})();
