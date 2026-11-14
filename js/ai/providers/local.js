/* =========================================================================
   SELAH · Proveedor: motor local (sin internet, gratis, siempre disponible)
   No es un modelo de lenguaje: reconoce intenciones en español y usa los
   datos de la app para armar setlists, completar el equipo, transponer,
   ver disponibilidad, resumir eventos y sugerir transiciones.
   Responde con el mismo formato que los modelos (incluye ```accion```).
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, C = App.chords;

  const THEMES = [
    [/graci/, 'gracia'], [/cruz|calvario|sangre|perdon/, 'cruz'], [/santa cena|\bcena\b|comunion|mesa/, 'santa cena'],
    [/esperanz/, 'esperanza'], [/fiel|fidelidad/, 'fidelidad'], [/celebr|fiesta|jubilo|alegr|gozo|danza/, 'celebración'],
    [/alegr|gozo/, 'alegría'], [/adora|intim|presencia|rendi/, 'adoración'], [/espiritu|avivamiento|fuego|lluvia/, 'espíritu'],
    [/avivamiento/, 'avivamiento'], [/santidad|\bsanto\b/, 'santidad'], [/resurrec|pascua|tumba/, 'resurrección'], [/himno|clasic|tradicional/, 'himno']
  ];

  const VERSES = {
    gracia: 'Efesios 2:8', cruz: 'Gálatas 6:14', 'santa cena': '1 Corintios 11:26', esperanza: 'Romanos 15:13',
    fidelidad: 'Lamentaciones 3:22-23', 'celebración': 'Salmo 100:1-2', 'alegría': 'Filipenses 4:4', 'adoración': 'Salmo 95:6',
    'espíritu': 'Hechos 2:4', avivamiento: 'Habacuc 3:2', santidad: 'Isaías 6:3', 'resurrección': '1 Pedro 1:3', apertura: 'Salmo 118:24', himno: 'Apocalipsis 4:8'
  };

  const LINES = {
    gracia: 'Nada de lo que traemos hoy nos gana Su amor; todo es gracia. Cantemos desde ese lugar.',
    cruz: 'Miremos a la cruz un momento. Ahí se pagó lo que nosotros no podíamos pagar.',
    'santa cena': 'Mientras se reparten los elementos, recordemos el precio de nuestra libertad y démosle gracias.',
    esperanza: 'Si llegaste cansado hoy, esta canción es para ti: nuestra esperanza está viva.',
    fidelidad: 'Piensa en una vez en que Dios fue fiel contigo. Él no ha cambiado, y lo sigue siendo hoy.',
    'celebración': '¡Pónganse de pie! Tenemos razones de sobra para celebrar lo que Dios ha hecho.',
    'alegría': 'La alegría del Señor es nuestra fuerza. Cantemos con todo el corazón.',
    'adoración': 'Bajemos el ritmo. Ya no cantamos sobre Dios, ahora le cantamos a Él.',
    'espíritu': 'Abramos espacio para el Espíritu Santo. No hay prisa; Él es bienvenido aquí.',
    avivamiento: 'Pidamos juntos que Dios haga otra vez lo que solo Él puede hacer.',
    santidad: 'Estamos delante de un Dios santo. Respondamos con reverencia y gratitud.',
    'resurrección': 'La tumba está vacía. Cantemos como gente que sabe que Cristo vive.',
    apertura: 'Este es el día que hizo el Señor. Comencemos dándole la gloria.',
    himno: 'Cantemos las mismas palabras que la iglesia ha cantado por generaciones.'
  };

  const POS_WORDS = [
    [/bater/, ['bateria']], [/\bbajo\b|bajista/, ['bajo']], [/piano|pianista/, ['piano']], [/teclad|synth|sinte/, ['teclado']],
    [/electric/, ['electrica']], [/acustic/, ['acustica']], [/guitarr/, ['acustica', 'electrica']], [/coro|coros|corista/, ['coro']],
    [/voz|cantante|vocal/, ['voz']], [/director|dirig|lider de alabanza/, ['director']], [/sonido|audio|consola/, ['sonido']], [/proyecc|pantalla|diapositiva/, ['proyeccion']]
  ];

  const nota = () => App.store.state.prefs.notation;
  const fk = (k) => C.formatKey(k, nota());
  const block = (obj) => '\n\n```accion\n' + JSON.stringify(obj) + '\n```';

  // ---------------------------------------------------------------------
  // Qué evento se menciona
  // ---------------------------------------------------------------------
  function findEvent(t, focusId) {
    const up = M.upcoming({ days: 90 });
    const focus = focusId ? M.event(focusId) : null;
    if (focus && t.includes(U.normalize(focus.title))) return focus;
    const byWord = () => {
      if (/joven/.test(t)) return up.find((e) => e.type === 'jovenes');
      if (/santa cena|\bcena\b/.test(t)) return up.find((e) => U.normalize(e.title).includes('cena')) || up.find((e) => e.type === 'especial');
      if (/ensayo/.test(t)) return up.find((e) => e.type === 'ensayo');
      if (/especial|vigilia|conferencia/.test(t)) return up.find((e) => e.type === 'especial');
      if (/(domingo|servicio|culto).*(pm|noche|tarde)|(pm|noche|tarde).*(domingo|servicio|culto)/.test(t)) return up.find((e) => e.type === 'servicio' && e.time >= '15:00');
      if (/domingo|servicio|culto/.test(t)) return up.find((e) => e.type === 'servicio');
      return null;
    };
    return byWord() || (focusId && M.event(focusId)) || up[0] || null;
  }

  function findSong(t) {
    let best = null, bestLen = 0;
    M.songs().forEach((s) => {
      const title = U.normalize(s.title).replace(/[¡!¿?,.]/g, '').trim();
      if (title && t.includes(title) && title.length > bestLen) { best = s; bestLen = title.length; }
    });
    if (best) return best;
    // Coincidencia parcial: la mayoría de palabras del título
    M.songs().forEach((s) => {
      const words = U.normalize(s.title).replace(/[¡!¿?,.]/g, '').split(/\s+/).filter((w) => w.length > 3);
      const hits = words.filter((w) => t.includes(w)).length;
      if (words.length && hits / words.length >= 0.6 && hits > bestLen) { best = s; bestLen = hits; }
    });
    return best;
  }

  function themesIn(text) {
    const out = [];
    THEMES.forEach(([re, tag]) => { if (re.test(text) && !out.includes(tag)) out.push(tag); });
    return out;
  }

  const evLine = (ev) => `**${ev.title}** · ${U.fmtDate(ev.date, 'long')} · ${U.fmtTime(ev.time)}`;

  // ---------------------------------------------------------------------
  // Intenciones
  // ---------------------------------------------------------------------
  function setlist(t, ev) {
    if (!M.songs().length) return 'Todavía no hay canciones en el repertorio. Ve a **Canciones → Importar PDF** y sube tus PDF de LaCuerda.net; después te armo el setlist.';
    if (!ev) return 'No encontré eventos próximos. Crea uno en la Agenda y vuelve a pedírmelo.';
    const themeText = `${t} ${U.normalize(ev.title)} ${U.normalize(ev.notes || '')}`;
    const themes = themesIn(themeText);
    const nMatch = /\b([3-8])\s*(canciones|cantos|temas|alabanzas)?\b/.exec(t);
    const n = nMatch ? Number(nMatch[1]) : ev.type === 'especial' ? 5 : 4;
    const quotas = { 3: [1, 1, 1], 4: [1, 1, 2], 5: [2, 1, 2], 6: [2, 2, 2], 7: [3, 2, 2], 8: [3, 2, 3] }[n];

    const recent = new Set();
    M.past({ days: 14 }).forEach((e) => e.setlist.forEach((it) => recent.add(it.songId)));

    const scored = M.songs().map((s) => {
      let score = 0;
      const hits = (s.tags || []).filter((tg) => themes.includes(tg));
      score += hits.length * 3;
      if (recent.has(s.id)) score -= 2;
      score += (U.hue(s.id + ev.id) % 10) / 100; // desempate estable
      return { s, score, hits };
    }).sort((a, b) => b.score - a.score);

    const picked = [];
    ['rapida', 'media', 'lenta'].forEach((tempo, i) => {
      scored.filter((x) => x.s.tempo === tempo && !picked.includes(x)).slice(0, quotas[i]).forEach((x) => picked.push(x));
    });
    scored.forEach((x) => { if (picked.length < n && !picked.includes(x)) picked.push(x); });

    const order = { rapida: 0, media: 1, lenta: 2 };
    picked.sort((a, b) => order[a.s.tempo] - order[b.s.tempo] || b.s.bpm - a.s.bpm);
    // La canción de Santa Cena siempre al final
    const cena = picked.findIndex((x) => (x.s.tags || []).includes('santa cena'));
    if (themes.includes('santa cena') && cena >= 0) picked.push(picked.splice(cena, 1)[0]);

    const why = (x, i) => {
      if (i === 0) return 'para abrir con energía';
      if (i === picked.length - 1) return x.s.tempo === 'lenta' ? 'para cerrar en adoración' : 'para cerrar';
      if (x.hits.length) return `conecta con ${x.hits.join(' y ')}`;
      return x.s.tempo === 'media' ? 'transición a un momento más reflexivo' : 'mantiene el flujo';
    };

    const keys = picked.map((x) => x.s.key);
    const jumps = [];
    for (let i = 1; i < keys.length; i++) {
      const d = Math.abs(C.semitones(keys[i - 1], keys[i]));
      if (d >= 4) jumps.push(`entre «${picked[i - 1].s.title}» (${fk(keys[i - 1])}) y «${picked[i].s.title}» (${fk(keys[i])})`);
    }
    const total = picked.reduce((sum, x) => sum + (x.s.duration || 0), 0);
    const recentUsed = picked.filter((x) => recent.has(x.s.id));

    let out = `**Setlist sugerido** para ${evLine(ev)}\n`;
    out += themes.length ? `Temas que tomé en cuenta: ${themes.join(', ')}.\n\n` : 'No detecté un tema específico, así que priorizo el flujo y la variedad.\n\n';
    out += picked.map((x, i) => `${i + 1}. **${x.s.title}** · ${fk(x.s.key)} · ${M.bpm(x.s)}, ${M.tempoLabel(x.s.tempo).toLowerCase()}: ${why(x, i)}.`).join('\n');
    out += `\n\n**Tonalidades:** ${keys.map(fk).join(' → ')}. Duración aproximada: ${U.fmtMinutes(total)}.`;
    if (jumps.length) out += `\n\nHay un salto grande de tono ${jumps.join(' y ')}. Un pad del teclado o un pequeño interludio ayuda a la transición.`;
    if (recentUsed.length) out += `\n\nNota: ${recentUsed.map((x) => `«${x.s.title}»`).join(', ')} se cantó en las últimas dos semanas; la incluí porque encaja mejor con el tema.`;
    out += block({ tipo: 'setlist', evento: ev.id, canciones: picked.map((x) => ({ id: x.s.id, tono: x.s.key })) });
    return out;
  }

  function assign(ev) {
    if (!ev) return 'No encontré eventos próximos para asignar.';
    const plan = App.rotation.plan(ev);
    if (!plan.length) return `Todos los puestos de ${evLine(ev)} ya tienen a alguien asignado. Si alguien no puede, márcalo como "No puede" y vuelvo a sugerir un reemplazo.`;
    const ok = plan.filter((p) => p.memberId);
    const none = plan.filter((p) => !p.memberId);
    let out = `**Propuesta de equipo** para ${evLine(ev)}\nUsé la rotación justa: primero quien menos ha servido, respetando fechas no disponibles y evitando cruces el mismo día.\n\n`;
    out += ok.map((p) => `- **${M.posLabel(p.position)}:** ${M.member(p.memberId).name} (${p.reason}${p.replaces ? `, reemplaza a ${M.member(p.replaces).name}` : ''})`).join('\n');
    if (none.length) out += `\n\nSin candidato disponible: ${none.map((p) => M.posLabel(p.position)).join(', ')}. Conviene invitar a alguien de otro equipo o formar a más personas en ese puesto.`;
    out += '\n\nAl aplicar, quedan como **pendientes** hasta que cada persona confirme desde su Inicio.';
    if (ok.length) out += block({ tipo: 'asignar', evento: ev.id, asignaciones: ok.map((p) => ({ slot: p.slot, puesto: p.position, miembro: p.memberId })) });
    return out;
  }

  function transpose(raw, t, ev) {
    const song = findSong(t);
    if (!song) return `¿Qué canción quieres transponer? Por ejemplo: *Transpón «${M.songs()[0].title}» a D* o *a Re*.`;
    const m = /(?:\ba\b|\ben\b|\bal\b|tono de|tonalidad de)\s+(do|re|mi|fa|sol|la|si|[A-G])\s*(#|b|sostenido|bemol)?\s*(m\b|menor)?/i.exec(raw);
    let target = m ? C.readKey(`${m[1]}${m[2] ? (/^(#|sostenido)$/i.test(m[2]) ? '#' : 'b') : ''}${m[3] ? 'm' : ''}`) : null;
    if (target && C.parseKey(song.key).minor !== C.parseKey(target).minor) target = C.transposeKey(song.key, C.semitones(song.key, target));
    const inEvent = ev && ev.setlist.some((it) => it.songId === song.id) ? ev : null;

    if (!target) {
      const opts = [-2, -1, 1, 2].map((d) => `${fk(C.transposeKey(song.key, d))} (${d > 0 ? '+' : ''}${d})`).join(', ');
      return `**${song.title}** está en ${fk(song.key)}. Opciones cercanas: ${opts}.\n\nDime a qué tono la quieres, por ejemplo: *pásala a ${fk(C.transposeKey(song.key, 2))}*.`;
    }
    const n = C.semitones(song.key, target);
    const prog = (k) => C.progression(song.chart, { n: C.semitones(song.key, k), key: song.key, mode: nota() }).slice(0, 8).join('  ');
    const friendly = ['G', 'C', 'D', 'E', 'A', 'Em', 'Am'];
    let capo = null;
    for (let c = 1; c <= 7; c++) { const shape = C.transposeKey(target, -c); if (friendly.includes(shape)) { capo = { c, shape }; break; } }

    let out = `**${song.title}**: de ${fk(song.key)} a ${fk(target)} (${n > 0 ? 'sube' : 'baja'} ${Math.abs(n)} ${Math.abs(n) === 1 ? 'semitono' : 'semitonos'}).\n\n`;
    out += `- Original: \`${prog(song.key)}\`\n- En ${fk(target)}: \`${prog(target)}\``;
    if (capo && !friendly.includes(target)) out += `\n\nPara la guitarra: capo en el traste ${capo.c} y formas de ${fk(capo.shape)}.`;
    out += block({ tipo: 'tono', cancion: song.id, tono: target, evento: inEvent ? inEvent.id : undefined });
    return out;
  }

  function positionsIn(t) {
    const out = [];
    POS_WORDS.forEach(([re, ids]) => { if (re.test(t)) ids.forEach((id) => { if (!out.includes(id)) out.push(id); }); });
    return out;
  }

  function stats(t) {
    const pos = positionsIn(t);
    const list = M.members().filter((m) => !pos.length || m.roles.some((r) => pos.includes(r)))
      .map((m) => ({ m, n: M.servedCount(m.id), last: M.lastServed(m.id) }))
      .sort((a, b) => a.n - b.n || a.m.name.localeCompare(b.m.name));
    const zero = list.filter((x) => x.n === 0);
    const top = list.slice().sort((a, b) => b.n - a.n).slice(0, 4);
    let out = `**Servicio en los últimos 60 días**${pos.length ? ` (${pos.map(M.posLabel).join(', ')})` : ''}\n\n`;
    out += zero.length ? `No han servido: ${zero.map((x) => `**${x.m.name}** (${x.m.roles.map(M.posLabel).join(', ')})`).join('; ')}.\n\n` : 'Todos han servido al menos una vez.\n\n';
    out += `Quienes más han servido:\n${top.map((x) => `- ${x.m.name}: ${x.n} ${x.n === 1 ? 'vez' : 'veces'}`).join('\n')}`;
    out += '\n\nLa función "Completar por rotación" de cada evento ya prioriza a quienes menos han servido.';
    return out;
  }

  function availability(t, ev) {
    if (!ev) return 'No encontré un evento próximo para revisar disponibilidad.';
    const pos = positionsIn(t);
    const positions = pos.length ? pos : Array.from(new Set(ev.assignments.filter((a) => !a.memberId || a.status === 'declined').map((a) => a.position)));
    if (!positions.length) return `Todos los puestos de ${evLine(ev)} están cubiertos. Pregúntame por un instrumento: *¿quién puede tocar bajo ese día?*`;
    let out = `**Disponibilidad** para ${evLine(ev)}\n\n`;
    positions.forEach((p) => {
      const c = M.candidates(ev, p).filter((x) => !x.conflicts.some((k) => k.hard));
      out += `**${M.posLabel(p)}:** ${c.length ? c.map((x) => `${x.member.name}${x.conflicts.length ? ' (sirve en otro evento ese día)' : ''}${x.inEvent ? ' (ya tiene otro puesto)' : ''}`).join(', ') : 'nadie disponible'}\n`;
    });
    const blocked = M.members().filter((m) => M.isUnavailable(m.id, ev.date));
    if (blocked.length) out += `\nMarcaron ese día como no disponible: ${blocked.map((m) => m.name).join(', ')}.`;
    return out;
  }

  function transition(t, ev) {
    if (!ev || !ev.setlist.length) return 'Para sugerir transiciones necesito un evento con setlist. Abre un evento, agrega canciones y vuelve a pedírmelo.';
    const songs = ev.setlist.map((it) => ({ s: M.song(it.songId), key: it.key })).filter((x) => x.s);
    const tagOf = (s) => (s.tags || []).find((tg) => LINES[tg]) || 'adoración';
    let out = `**Palabras de transición** para ${evLine(ev)}\nIdeas breves para quien dirige; adáptalas a tu voz.\n\n`;
    out += `**Antes de «${songs[0].s.title}»:** ${LINES.apertura} *(${VERSES.apertura})*\n\n`;
    for (let i = 1; i < songs.length; i++) {
      const tag = tagOf(songs[i].s);
      out += `**De «${songs[i - 1].s.title}» a «${songs[i].s.title}»** (${fk(songs[i - 1].key)} → ${fk(songs[i].key)}): ${LINES[tag]} *(${VERSES[tag]})*\n\n`;
    }
    out += 'Lee el pasaje completo en tu Biblia antes del servicio para citarlo con precisión.';
    return out;
  }

  function createEvent(raw, t) {
    const type = /ensayo/.test(t) ? 'ensayo' : /joven/.test(t) ? 'jovenes' : /vigilia|especial|conferencia|santa cena/.test(t) ? 'especial' : 'servicio';
    let date = null;
    const today = U.parseYmd(U.today());
    if (/pasado manana/.test(t)) date = U.addDays(today, 2);
    else if (/manana/.test(t) && !/de la manana/.test(t)) date = U.addDays(today, 1);
    else {
      const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const di = dias.findIndex((d) => new RegExp(`\\b${d}\\b`).test(t));
      if (di >= 0) { let add = (di - today.getDay() + 7) % 7; if (add === 0) add = 7; date = U.addDays(today, add); }
      const dm = /\b(\d{1,2})\s*(?:\/|-|de\s+)(\d{1,2}|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/.exec(t);
      if (dm) {
        const month = /^\d+$/.test(dm[2]) ? Number(dm[2]) - 1 : U.MESES.indexOf(dm[2]);
        let d = new Date(today.getFullYear(), month, Number(dm[1]));
        if (d < today) d = new Date(today.getFullYear() + 1, month, Number(dm[1]));
        date = d;
      }
    }
    if (!date) return 'Puedo crear el evento si me dices el día. Por ejemplo: *Crea un ensayo el jueves a las 7:30 pm*.';
    let time = type === 'ensayo' ? '19:30' : type === 'servicio' ? '10:00' : '19:00';
    const tm = /(?:a las|a la|\bal?s?\b)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?\s?m\.?|p\.?\s?m\.?|de la manana|de la tarde|de la noche)?/.exec(t);
    if (tm) {
      let h = Number(tm[1]);
      const mm = tm[2] || '00';
      const suf = tm[3] || '';
      if (/p|tarde|noche/.test(suf) && h < 12) h += 12;
      if (!suf && h >= 1 && h <= 7) h += 12; // "a las 7" en la iglesia suele ser de la noche
      time = `${String(h).padStart(2, '0')}:${mm}`;
    }
    const title = { ensayo: 'Ensayo general', jovenes: 'Noche de Jóvenes', especial: 'Servicio especial', servicio: 'Servicio' }[type];
    const place = type === 'ensayo' ? 'Salón de ensayo' : type === 'jovenes' ? 'Salón juvenil' : 'Auditorio principal';
    const ymd = U.ymd(date);
    return `Te propongo crear este evento:\n\n- **${title}**\n- ${U.fmtDate(ymd, 'long')} · ${U.fmtTime(time)}\n- ${place}\n\nSe crearán los puestos del equipo de un ${M.typeLabel(type).toLowerCase()}. Después puedo armar el setlist o completar el equipo.` +
      block({ tipo: 'evento', titulo: title, fecha: ymd, hora: time, tipoEvento: type, lugar: place });
  }

  function summary(ev) {
    if (!ev) return 'No hay eventos próximos en la agenda.';
    const st = M.eventStats(ev);
    const pend = ev.assignments.filter((a) => a.memberId && a.status === 'pending').map((a) => M.member(a.memberId).name);
    const decl = ev.assignments.filter((a) => a.status === 'declined' && a.memberId).map((a) => `${M.member(a.memberId).name} (${M.posLabel(a.position)})`);
    const empty = ev.assignments.filter((a) => !a.memberId).map((a) => M.slotLabel(ev, a));
    let out = `**Resumen:** ${evLine(ev)}${ev.place ? ` · ${ev.place}` : ''}\n\n`;
    out += ev.setlist.length ? `**Setlist** (${U.fmtMinutes(M.setlistDuration(ev))}):\n${ev.setlist.map((it, i) => { const s = M.song(it.songId); const l = M.member(it.leaderId); return `${i + 1}. ${s ? s.title : '?'} · ${fk(it.key)}${l ? ` · dirige ${l.name}` : ''}`; }).join('\n')}\n\n` : '**Setlist:** todavía vacío. Puedo sugerirte uno.\n\n';
    out += `**Equipo:** ${st.confirmed} de ${st.total} confirmados.`;
    if (pend.length) out += `\n- Pendientes de confirmar: ${pend.join(', ')}.`;
    if (decl.length) out += `\n- No pueden: ${decl.join(', ')}.`;
    if (empty.length) out += `\n- Sin asignar: ${empty.join(', ')}.`;
    if (ev.notes) out += `\n\n**Notas:** ${ev.notes}`;
    if (empty.length || decl.length) {
      const plan = App.rotation.plan(ev).filter((p) => p.memberId);
      if (plan.length) {
        out += `\n\nPuedo cubrir ${U.plural(plan.length, 'puesto', 'puestos')} con la rotación: ${plan.map((p) => `${M.posLabel(p.position)} → ${M.member(p.memberId).name}`).join(', ')}.`;
        out += block({ tipo: 'asignar', evento: ev.id, asignaciones: plan.map((p) => ({ slot: p.slot, puesto: p.position, miembro: p.memberId })) });
      }
    }
    return out;
  }

  function help() {
    return `Estoy en **modo local**: funciono sin internet con los datos de la app. Puedo ayudarte con:

- **Setlists:** *Arma un setlist para la Noche de Jóvenes sobre la esperanza*
- **Equipo:** *Completa el equipo del próximo domingo por rotación*
- **Disponibilidad:** *¿Quién puede tocar batería el domingo?*
- **Tonalidades:** *Transpón «Gracia Sin Final» a E*
- **Estadísticas:** *¿Quién no ha servido en el último mes?*
- **Transiciones:** *Sugiere palabras de transición para el servicio del domingo*
- **Eventos:** *Crea un ensayo el jueves a las 7:30 pm*
- **Resumen:** *¿Cómo va el servicio del domingo?*

Para conversar con libertad (preguntas abiertas, redactar mensajes, ideas creativas), agrega una clave gratuita de Gemini o Groq en Ajustes → Asistente de IA.`;
  }

  function respond(text, focusId) {
    const t = U.normalize(text);
    const ev = findEvent(t, focusId);
    if (/no ha servido|menos ha servido|mas ha servido|cuantas veces|quien ha servido|quienes han servido|descans|estadistic/.test(t)) return stats(t);
    if (/transp|cambia.*tono|pasa.*\ba\b|baja.*tono|sube.*tono|en que tono|que tono|capo/.test(t)) return transpose(text, t, ev);
    if (/transici|exhortaci|devocional|palabras? (de|para)|que digo|que decir|introducc/.test(t)) return transition(t, ev);
    if (/asign|rotaci|completa|quien(es)? toca|programa.*equipo|arma.*equipo|equipo para/.test(t)) return assign(ev);
    if (/setlist|repertorio|lista de canciones|que cantamos|que canciones|canciones para|sugier|arma/.test(t)) return setlist(t, ev);
    if (/disponib|quien puede|quienes pueden|libre/.test(t)) return availability(t, ev);
    if (/\b(crea|crear|agenda|agendar|programa|programar|nuevo|nueva)\b/.test(t) && /ensayo|servicio|evento|culto|vigilia|reunion|joven/.test(t)) return createEvent(text, t);
    if (/resumen|proximo|que toca|como va|estado|pendiente|quien falta/.test(t)) return summary(ev);
    return help();
  }

  App.ai.register({
    id: 'local',
    label: 'Motor local',
    description: 'Siempre disponible y sin internet. Reconoce pedidos frecuentes y usa los datos de la app.',
    async available() { return true; },
    async ask({ text, focusEventId, onText, signal }) {
      const out = respond(text, focusEventId);
      if (onText) {
        const parts = out.split(/(\s+)/);
        let acc = '';
        for (let i = 0; i < parts.length; i += 8) {
          if (signal && signal.aborted) { const e = new Error('Detenido'); e.name = 'AbortError'; throw e; }
          acc += parts.slice(i, i + 8).join('');
          onText(acc);
          await U.sleep(12);
        }
      }
      return out;
    }
  });
})();
