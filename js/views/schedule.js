/* =========================================================================
   SELAH · Cronograma del mes
   Vista tipo póster (como el cronograma impreso del ministerio): cada día
   con sus cultos y quién está en cada puesto. Es la misma información de
   la Agenda, así que todo queda sincronizado.
   - El líder crea el mes con una plantilla semanal (qué culto va cada día)
     y puede completarlo con la rotación justa.
   - Tocar un puesto (líder) permite asignar a alguien.
   - "Compartir imagen" arma un PNG para enviarlo por WhatsApp.
   Se usa desde la Agenda (modo "Cronograma").
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc, A = App.actions;
  const DOW = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const PRINT = { dominical: '#DC2626', ensenanza: '#1D4ED8', jovenes: '#C2410C', damas: '#DB2777', caballeros: '#0F766E', oracion: '#6D28D9', servicio: '#4338CA', ensayo: '#334155', especial: '#9333EA' };

  const role = (p) => App.config.scheduleRoles[p] || { label: M.posLabel(p), color: '#6B7280' };

  function shortName(m) {
    if (!m) return '';
    const first = U.firstName(m.name);
    const dup = M.members().filter((x) => U.firstName(x.name) === first).length > 1;
    return dup ? m.name.split(/\s+/).slice(0, 2).join(' ') : first;
  }

  function layout(month) {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const days = new Date(y, m, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    const rows = Math.ceil((offset + days) / 7);
    return { y, m, rows, start: U.addDays(first, -offset) };
  }

  const eventsIn = (month) => M.sortEvents(M.events().filter((e) => e.date.slice(0, 7) === month));

  // ---------------------------------------------------------------------
  // Vista
  // ---------------------------------------------------------------------
  function view(month) {
    const leader = M.isLeader();
    const me = M.me();
    const { y, rows, start } = layout(month);
    const today = U.today();
    const count = eventsIn(month).length;
    let cells = '';
    for (let i = 0; i < rows * 7; i++) {
      const day = U.ymd(U.addDays(start, i));
      const out = day.slice(0, 7) !== month;
      const evs = out ? [] : M.eventsOn(day);
      cells += `
        <div class="cr-cell ${out ? 'is-out' : ''} ${!evs.length ? 'is-empty' : ''} ${day === today ? 'is-today' : ''} ${day < today ? 'is-past' : ''}">
          <div class="cr-day"><span class="cr-dname">${esc(DOW[i % 7])}</span> ${out ? '' : U.fmtDate(day, 'day')}</div>
          ${evs.map((ev) => `
            <div class="cr-ev" style="--tc: var(--t-${esc(ev.type)})">
              <a class="cr-title" href="#evento-${esc(ev.id)}">${esc(ev.title)}</a>
              <span class="cr-time">${U.fmtTime(ev.time)}</span>
              ${ev.assignments.map((a) => {
                const p = M.member(a.memberId);
                const r = role(a.position);
                const st = !p ? '' : a.status === 'confirmed' ? `<span class="cr-st cr-st--ok" title="Confirmó">${I('check', 11)}</span>` : a.status === 'declined' ? `<span class="cr-st cr-st--bad" title="No puede">${I('x', 11)}</span>` : '';
                return `<button class="cr-role ${p && p.id === me.id ? 'is-me' : ''} ${!p ? 'is-open' : ''}" ${leader ? `data-cr-ev="${esc(ev.id)}" data-cr-slot="${esc(a.slot)}"` : 'tabindex="-1"'}><span class="cr-lbl" style="--rc:${r.color}">${esc(r.label)}:</span> <span class="cr-name">${p ? esc(shortName(p)) : '—'}</span>${st}</button>`;
              }).join('')}
            </div>`).join('')}
        </div>`;
    }
    return `
      <div class="cr-tools">
        ${leader ? `<button class="btn btn--primary btn--sm" data-cr="create">${I('calendar', 14)} ${count ? 'Agregar cultos al mes' : 'Crear cronograma del mes'}</button>
          <button class="btn btn--soft btn--sm" data-cr="fill" ${count ? '' : 'disabled'}>${I('sparkle', 14)} Completar con la rotación</button>` : ''}
        <button class="btn btn--ghost btn--sm" data-cr="share" ${count ? '' : 'disabled'}>${I('arrow-up', 14)} Compartir imagen</button>
        <span class="xsmall faint grow cr-hint">${leader ? 'Toca un puesto para asignar a alguien.' : 'Tus turnos aparecen resaltados.'}</span>
      </div>
      <section class="cr" aria-label="Cronograma de ${esc(U.fmtDate(month + '-01', 'month'))}">
        <header class="cr-head">
          <span class="cr-year mono">${y}</span>
          <h2 class="cr-month">${esc(U.cap(U.MESES[Number(month.slice(5)) - 1]))}</h2>
          <span class="cr-church">${esc(M.settings().ministryName)} · ${esc(M.settings().churchName)}</span>
        </header>
        <div class="cr-dow">${DOW.map((d) => `<span>${d}</span>`).join('')}</div>
        <div class="cr-grid">${cells}</div>
        ${count ? '' : `<div class="cr-empty">${ui.empty({ icon: 'calendar', title: 'Todavía no hay cultos este mes', text: leader ? 'Crea el cronograma del mes con la plantilla de cada semana.' : 'Cuando el líder publique el cronograma aparecerá aquí.' })}</div>`}
      </section>`;
  }

  // ---------------------------------------------------------------------
  // Asignar un puesto desde el cronograma
  // ---------------------------------------------------------------------
  function assign(evId, slot) {
    const ev = M.event(evId);
    if (!ev) return;
    const a = ev.assignments.find((x) => x.slot === slot);
    if (!a) return;
    const cands = M.candidates(ev, a.position);
    const others = M.members().filter((m) => !cands.some((c) => c.member.id === m.id));
    const m = ui.sheet({
      title: `${role(a.position).label} · ${ev.title}`,
      body: `
        <p class="small muted">${U.fmtDate(ev.date, 'long')} · ${U.fmtTime(ev.time)}. Primero quien menos ha servido.</p>
        <div class="menu-list">
          <button class="menu-item ${!a.memberId ? 'is-on' : ''}" data-pick="">${ui.avatar(null, 'sm')}<span class="grow"><span class="strong small">Sin asignar</span></span></button>
          ${cands.map((c) => {
            const hard = c.conflicts.find((x) => x.hard);
            const note = hard ? hard.label : c.conflicts.length ? c.conflicts[0].label : c.inEvent ? 'Ya tiene otro puesto ese día' : `${c.load} ${c.load === 1 ? 'servicio' : 'servicios'} cerca de esta fecha`;
            return `<button class="menu-item ${c.member.id === a.memberId ? 'is-on' : ''}" data-pick="${esc(c.member.id)}">${ui.avatar(c.member, 'sm')}<span class="grow"><span class="strong small">${esc(c.member.name)}</span><span class="xsmall ${hard ? 'bad-text' : 'faint'}">${esc(note)}</span></span>${c.member.id === a.memberId ? I('check', 16) : ''}</button>`;
          }).join('')}
          ${others.length ? `<p class="xsmall faint" style="padding:10px 4px 2px">No tienen este puesto en su ficha</p>${others.map((o) => `<button class="menu-item" data-pick="${esc(o.id)}">${ui.avatar(o, 'sm')}<span class="grow"><span class="strong small">${esc(o.name)}</span><span class="xsmall faint">${esc(o.roles.map(M.posLabel).join(', '))}</span></span></button>`).join('')}` : ''}
        </div>
        <a class="btn btn--ghost btn--sm" href="#evento-${esc(ev.id)}" data-close>${I('calendar', 14)} Abrir el evento</a>`
    });
    m.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      A.assign(ev.id, slot, b.dataset.pick || null);
      const p = M.member(b.dataset.pick);
      ui.toast(p ? `${p.name} queda en ${role(a.position).label.toLowerCase()}. Le llegará el aviso para aceptar.` : 'Puesto sin asignar.');
      m.close();
    });
  }

  // ---------------------------------------------------------------------
  // Crear el mes con la plantilla semanal
  // ---------------------------------------------------------------------
  function datesFor(month, entry) {
    const [y, m] = month.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const out = [];
    for (let d = 1; d <= days; d++) {
      const date = new Date(y, m - 1, d);
      const dow = ((date.getDay() + 6) % 7) + 1;
      if (dow !== Number(entry.day)) continue;
      const nth = Math.ceil(d / 7);
      if (entry.weeks && entry.weeks.length && !entry.weeks.includes(nth)) continue;
      out.push(U.ymd(date));
    }
    return out;
  }

  function planMonth(month, tpl) {
    const list = [];
    tpl.forEach((t) => datesFor(month, t).forEach((date) => {
      const exists = M.eventsOn(date).some((e) => e.type === t.type);
      list.push({ t, date, exists });
    }));
    return list.sort((a, b) => (a.date + a.t.time < b.date + b.t.time ? -1 : 1));
  }

  function create(month) {
    const types = Object.entries(App.config.eventTypes);
    const tpl = U.clone(M.settings().scheduleTemplate || App.config.scheduleTemplate);
    const monthName = U.fmtDate(month + '-01', 'month');
    const m = ui.modal({
      title: `Cronograma de ${monthName}`,
      size: 'lg',
      body: `
        <p class="small muted">Estos son los cultos de cada semana. Cámbialos si este mes es distinto: se crean todos de una vez y luego puedes asignar a cada persona.</p>
        <div class="card cg-list" id="cg-list"></div>
        <button type="button" class="btn btn--ghost btn--sm" data-cg="add">${I('plus', 14)} Agregar culto</button>
        <label class="check"><input type="checkbox" id="cg-fill" checked> <span>Completar los puestos con la rotación (quien menos ha servido primero)</span></label>
        <label class="check"><input type="checkbox" id="cg-chat" checked> <span>Avisar al equipo en el chat general</span></label>
        <p class="small strong" id="cg-count"></p>`,
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        {
          label: 'Crear cronograma', kind: 'primary', icon: 'check',
          onClick: (api) => {
            const plan = planMonth(month, tpl).filter((x) => !x.exists);
            if (!plan.length) { ui.toast('Esos cultos ya estaban creados.', { kind: 'info' }); return; }
            A.updateSettings({ scheduleTemplate: tpl });
            const today = U.today();
            const created = plan.map(({ t, date }) => A.createEvent({ title: t.title, type: t.type, date, time: t.time, place: App.config.places[0], teamId: null }));
            if (api.body.querySelector('#cg-fill').checked) fill(month, created.filter((e) => e.date >= today).map((e) => e.id), true);
            if (api.body.querySelector('#cg-chat').checked) A.sendMessage('general', `📅 Ya está el cronograma de ${monthName}: ${U.plural(created.length, 'culto', 'cultos')}. Revisa en la Agenda → Cronograma y acepta tus turnos.`);
            ui.toast(`${U.plural(created.length, 'culto creado', 'cultos creados')} en ${monthName}.`);
          }
        }
      ]
    });

    const listEl = m.body.querySelector('#cg-list');
    const paint = () => {
      listEl.innerHTML = tpl.map((t, i) => `
        <div class="cg-row" data-i="${i}">
          <select class="select select--sm" data-f="day" aria-label="Día">${DOW.map((d, k) => `<option value="${k + 1}" ${Number(t.day) === k + 1 ? 'selected' : ''}>${d}</option>`).join('')}</select>
          <select class="select select--sm" data-f="type" aria-label="Tipo">${types.map(([id, x]) => `<option value="${id}" ${t.type === id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
          <input class="input input--sm" data-f="title" value="${esc(t.title)}" aria-label="Nombre">
          <input class="input input--sm mono" type="time" data-f="time" value="${esc(t.time)}" aria-label="Hora">
          <div class="cg-weeks" title="Semanas del mes (ninguna marcada = todas)">${[1, 2, 3, 4, 5].map((w) => `<button type="button" class="${(t.weeks || []).includes(w) ? 'is-on' : ''}" data-week="${w}">${w}ª</button>`).join('')}</div>
          <button type="button" class="btn btn--plain btn--icon btn--sm" data-cg="del" aria-label="Quitar">${I('x', 14)}</button>
        </div>`).join('') || '<p class="small muted" style="padding:12px">Agrega al menos un culto.</p>';
      const plan = planMonth(month, tpl);
      const fresh = plan.filter((x) => !x.exists).length;
      m.body.querySelector('#cg-count').textContent = `Se crearán ${U.plural(fresh, 'culto', 'cultos')}${plan.length - fresh ? ` (${plan.length - fresh} ya estaban creados)` : ''}.`;
    };
    paint();
    m.body.addEventListener('click', (e) => {
      const row = e.target.closest('[data-i]');
      const wk = e.target.closest('[data-week]');
      if (wk && row) {
        const t = tpl[Number(row.dataset.i)];
        const w = Number(wk.dataset.week);
        t.weeks = (t.weeks || []).includes(w) ? t.weeks.filter((x) => x !== w) : (t.weeks || []).concat(w).sort();
        paint();
        return;
      }
      const b = e.target.closest('[data-cg]');
      if (!b) return;
      if (b.dataset.cg === 'add') tpl.push({ day: 7, type: 'dominical', title: 'Culto Dominical', time: '10:00', weeks: [] });
      if (b.dataset.cg === 'del' && row) tpl.splice(Number(row.dataset.i), 1);
      paint();
    });
    m.body.addEventListener('change', (e) => {
      const row = e.target.closest('[data-i]');
      if (!row || !e.target.dataset.f) return;
      const t = tpl[Number(row.dataset.i)];
      const f = e.target.dataset.f;
      t[f] = f === 'day' ? Number(e.target.value) : e.target.value;
      if (f === 'type') t.title = App.config.eventTypes[t.type].label;
      paint();
    });
  }

  /** Llena los puestos vacíos con la rotación justa. */
  function fill(month, ids = null, silent = false) {
    const today = U.today();
    const list = (ids ? ids.map(M.event).filter(Boolean) : eventsIn(month).filter((e) => e.date >= today));
    let n = 0;
    list.forEach((ev) => {
      const p = App.rotation.plan(M.event(ev.id));
      if (p.length) n += App.rotation.apply(ev.id, p);
    });
    if (!silent) ui.toast(n ? `${U.plural(n, 'puesto completado', 'puestos completados')}. A cada persona le llega el aviso para aceptar.` : 'No había puestos para completar (o falta gente con esos instrumentos).', { kind: n ? 'ok' : 'info' });
    return n;
  }

  // ---------------------------------------------------------------------
  // Imagen para compartir
  // ---------------------------------------------------------------------
  function fitText(ctx, text, max, size, weight, family) {
    let s = size;
    ctx.font = `${weight} ${s}px ${family}`;
    while (ctx.measureText(text).width > max && s > 10) { s -= 1; ctx.font = `${weight} ${s}px ${family}`; }
    return s;
  }

  async function poster(month) {
    try { await document.fonts.ready; } catch (e) { /* sin fuentes */ }
    const { y, m, rows, start } = layout(month);
    const W = 1600, colW = W / 7, headH = 120, dowH = 44, dayH = 30, lineH = 27, titleH = 32, gap = 14;
    const FONT = '"Inter Tight", "Inter", system-ui, sans-serif';
    const week = [];
    for (let r = 0; r < rows; r++) {
      const cells = [];
      let h = 0;
      for (let c = 0; c < 7; c++) {
        const day = U.ymd(U.addDays(start, r * 7 + c));
        const out = day.slice(0, 7) !== month;
        const evs = out ? [] : M.eventsOn(day);
        const ch = evs.reduce((s, e) => s + titleH + e.assignments.length * lineH + gap, 16);
        h = Math.max(h, ch);
        cells.push({ day, out, evs });
      }
      week.push({ cells, h: Math.max(130, h) });
    }
    const H = headH + dowH + week.reduce((s, w) => s + dayH + w.h, 0) + 46;
    const cv = document.createElement('canvas');
    const scale = 1.5;
    cv.width = W * scale; cv.height = H * scale;
    const ctx = cv.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);

    // Encabezado
    const g = ctx.createLinearGradient(0, 0, W, headH);
    g.addColorStop(0, '#3B2FD6'); g.addColorStop(0.55, '#5B5BF7'); g.addColorStop(1, '#22B8C4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, headH);
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(0, 0, 260, headH);
    ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.font = `800 52px ${FONT}`; ctx.fillText(String(y), 130, headH / 2);
    ctx.font = `800 64px ${FONT}`; ctx.fillText(U.cap(U.MESES[m - 1]), W / 2 + 60, headH / 2 - 6);
    ctx.font = `600 20px ${FONT}`; ctx.globalAlpha = 0.9;
    ctx.fillText(`${M.settings().ministryName} ${M.settings().churchName}`.toUpperCase(), W / 2 + 60, headH - 22);
    ctx.globalAlpha = 1;

    // Días de la semana
    ctx.fillStyle = '#111827'; ctx.fillRect(0, headH, W, dowH);
    ctx.fillStyle = '#FFFFFF'; ctx.font = `700 19px ${FONT}`;
    DOW.forEach((d, i) => ctx.fillText(d.toUpperCase(), colW * i + colW / 2, headH + dowH / 2));

    let yy = headH + dowH;
    week.forEach((w) => {
      w.cells.forEach((cell, c) => {
        const x = colW * c;
        ctx.fillStyle = '#FDE68A'; ctx.fillRect(x, yy, colW, dayH);
        ctx.fillStyle = '#1F2937'; ctx.font = `700 17px ${FONT}`;
        ctx.fillText(cell.out ? '' : String(Number(cell.day.slice(8))).padStart(2, '0'), x + colW / 2, yy + dayH / 2);
        ctx.fillStyle = cell.out || !cell.evs.length ? '#E5E7EB' : '#FFFFFF';
        ctx.fillRect(x, yy + dayH, colW, w.h);
        let ty = yy + dayH + 18;
        cell.evs.forEach((ev) => {
          ctx.fillStyle = PRINT[ev.type] || '#DC2626';
          fitText(ctx, ev.title.toUpperCase(), colW - 20, 18, 800, FONT);
          ctx.fillText(ev.title.toUpperCase(), x + colW / 2, ty + 8);
          ty += titleH;
          ev.assignments.forEach((a) => {
            const r = role(a.position);
            const p = M.member(a.memberId);
            const name = p ? shortName(p).toUpperCase() : '—';
            const lbl = `${r.label.toUpperCase()}:`;
            const size = fitText(ctx, `${lbl} ${name}`, colW - 18, 17, 700, FONT);
            ctx.font = `700 ${size}px ${FONT}`;
            const wl = ctx.measureText(lbl + ' ').width, wn = ctx.measureText(name).width;
            const sx = x + colW / 2 - (wl + wn) / 2;
            ctx.textAlign = 'left';
            ctx.fillStyle = r.color; ctx.fillText(lbl, sx, ty);
            ctx.fillRect(sx, ty + size / 2 + 1, ctx.measureText(lbl).width, 1.5);
            ctx.fillStyle = p ? '#111827' : '#9CA3AF'; ctx.fillText(name, sx + wl, ty);
            ctx.textAlign = 'center';
            ty += lineH;
          });
          ty += gap;
        });
      });
      // Líneas
      ctx.strokeStyle = '#9CA3AF'; ctx.lineWidth = 1;
      for (let c = 0; c <= 7; c++) { ctx.beginPath(); ctx.moveTo(colW * c, yy); ctx.lineTo(colW * c, yy + dayH + w.h); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0, yy + dayH + w.h); ctx.lineTo(W, yy + dayH + w.h); ctx.stroke();
      yy += dayH + w.h;
    });

    ctx.fillStyle = '#6B7280'; ctx.font = `500 16px ${FONT}`;
    ctx.fillText(`Cronograma de alabanza · ${M.settings().churchName} · hecho con ${App.config.appName}`, W / 2, H - 22);
    return cv;
  }

  async function share(month) {
    const monthName = U.fmtDate(month + '-01', 'month');
    const cv = await poster(month);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const file = new File([blob], `cronograma-${month}.png`, { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const m = ui.modal({
      title: `Cronograma de ${monthName}`,
      size: 'xl',
      body: `<img class="cr-poster" src="${url}" alt="Cronograma de ${esc(monthName)}">`,
      actions: [
        { label: 'Descargar', kind: 'ghost', icon: 'arrow-down', onClick: () => {
          const a = document.createElement('a');
          a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
          return false;
        } },
        ...(navigator.canShare && navigator.canShare({ files: [file] }) ? [{ label: 'Compartir', kind: 'primary', icon: 'arrow-up', onClick: async () => {
          try { await navigator.share({ files: [file], title: `Cronograma de ${monthName}` }); } catch (e) { /* cancelado */ }
          return false;
        } }] : [])
      ],
      onClose: () => setTimeout(() => URL.revokeObjectURL(url), 1000)
    });
    return m;
  }

  /** Clics del cronograma (los conecta la Agenda). */
  function bind(root, month) {
    root.addEventListener('click', (e) => {
      const r = e.target.closest('[data-cr-slot]');
      if (r) { assign(r.dataset.crEv, r.dataset.crSlot); return; }
      const b = e.target.closest('[data-cr]');
      if (!b || b.disabled) return;
      if (b.dataset.cr === 'create') create(month);
      if (b.dataset.cr === 'fill') fill(month);
      if (b.dataset.cr === 'share') share(month).catch(() => ui.toast('No se pudo armar la imagen.', { kind: 'warn' }));
    });
  }

  App.schedule = { view, bind, create, fill, share, poster, datesFor };
})();
