/* =========================================================================
   SELAH · Datos de demostración
   Las fechas se calculan a partir de hoy, así la demo siempre se ve viva.
   Las canciones son de ejemplo, escritas para esta demo, más un himno de
   dominio público. Reemplázalas por el repertorio real del ministerio.
   ========================================================================= */
(function () {
  const U = App.utils;

  const SONGS = [
    {
      id: 's1', title: 'Luz de la Mañana', artist: 'Canción de ejemplo', key: 'G', bpm: 128, time: '4/4', tempo: 'rapida', duration: 270,
      tags: ['alegría', 'celebración', 'apertura'],
      arrangement: ['Intro', 'Verso 1', 'Coro', 'Verso 2', 'Coro', 'Puente', 'Puente', 'Coro'],
      notes: 'Abrir con batería y guitarra eléctrica. El puente sube de intensidad la segunda vez.',
      chart: `{Intro}
[G] [D/F#] [Em] [C]

{Verso 1}
[G]Despierta el alma, [D]canta al Señor,
[Em]nueva es Su gracia, [C]nuevo Su amor.
[G]Todo lo que respira [D]levante la voz,
[Em]hoy celebramos la [C]fe en nuestro Dios.

{Coro}
[C]Luz de la ma[G]ñana, [D]brillas en mí,
[Em]cada amane[C]cer yo [D]vivo por Ti.
[C]Luz de la ma[G]ñana, [D]canto a Tu nombre,
[C]Tú eres mi [D]Rey, Jesús, mi [G]Dios.

{Verso 2}
[G]Por los caminos [D]Tú vas delante,
[Em]Tu fidelidad [C]es constante.
[G]No hay oscuridad que [D]pueda quedarse
[Em]donde Tu presencia [C]llega a brillar.

{Puente}
[Em]Brilla, [D]brilla, [C]llena este lugar,
[Em]brilla, [D]brilla, [C]nadie lo podrá a[D]pagar.`
    },
    {
      id: 's2', title: 'Gracia Sin Final', artist: 'Canción de ejemplo', key: 'D', bpm: 72, time: '4/4', tempo: 'lenta', duration: 330,
      tags: ['gracia', 'cruz', 'adoración'],
      arrangement: ['Verso 1', 'Pre-coro', 'Coro', 'Verso 2', 'Pre-coro', 'Coro', 'Coro'],
      notes: 'Piano solo en el verso 1. Entra la banda en el pre-coro.',
      chart: `{Verso 1}
[D]Vine a Ti con las [G]manos vacías,
[Bm]nada tenía [A]para ofrecer,
[D]y en la cruz Tu a[G]mor me encontraba,
[Bm]gracia que no [A]puedo merecer.

{Pre-coro}
[G]Y ahora [A]sé que soy [Bm]Tuyo,
[G]por Tu [A]sangre soy [D]libre.

{Coro}
[D]Gracia sin fi[A]nal, [Bm]río que no ce[G]sa,
[D]fluye desde el [A]Calvario a mi cora[G]zón.
[D]Gracia sin fi[A]nal, [Bm]todo lo re[G]nuevas,
[Em]canto para [A]siempre Tu per[D]dón.

{Verso 2}
[D]Donde hubo cul[G]pa, hoy hay alabanza,
[Bm]donde hubo llan[A]to, canción,
[D]Tu misericor[G]dia es mi esperanza,
[Bm]nueva cada [A]día en mi interior.`
    },
    {
      id: 's3', title: 'Fiel en Todo Tiempo', artist: 'Canción de ejemplo', key: 'A', bpm: 96, time: '4/4', tempo: 'media', duration: 285,
      tags: ['fidelidad', 'esperanza'],
      arrangement: ['Verso 1', 'Coro', 'Coro', 'Puente', 'Puente', 'Coro'],
      notes: '',
      chart: `{Verso 1}
[A]En la tormenta, [E]en la calma,
[F#m]Tú no cambias, [D]Señor.
[A]Cuando me falta [E]la esperanza,
[F#m]Tu palabra es [D]mi canción.

{Coro}
[D]Fiel, fiel en todo [A]tiempo,
[E]fiel, nunca me has de[F#m]jado.
[D]Aunque todo pase, [A]Tú permaneces,
[E]Dios fiel, mi [A]salvación.

{Puente}
[D]Lo has hecho antes, lo ha[A]rás otra vez,
[E]Tus promesas son [F#m]sí y amén.`
    },
    {
      id: 's4', title: 'Abre los Cielos', artist: 'Canción de ejemplo', key: 'E', bpm: 120, time: '4/4', tempo: 'rapida', duration: 300,
      tags: ['espíritu', 'avivamiento'],
      arrangement: ['Intro', 'Verso', 'Coro', 'Verso', 'Coro', 'Coro'],
      notes: 'Pad del teclado constante durante toda la canción.',
      chart: `{Intro}
[E] [B] [C#m] [A]

{Verso}
[E]Abre los cielos, [B]ven a este lugar,
[C#m]Santo Espíritu, [A]queremos más.
[E]Viento que sopla, [B]fuego que arde,
[C#m]llena Tu casa, [A]Señor.

{Coro}
[A]Llueve, llueve [E]sobre nosotros,
[B]que se encienda [C#m]nuestro corazón,
[A]llueve, llueve, [E]nada es igual
[B]cuando llega Tu [E]presencia.`
    },
    {
      id: 's5', title: 'Ante Tu Trono', artist: 'Canción de ejemplo', key: 'C', bpm: 68, time: '4/4', tempo: 'lenta', duration: 315,
      tags: ['adoración', 'santidad'],
      arrangement: ['Verso', 'Coro', 'Verso', 'Coro', 'Coro'],
      notes: 'Terminar con el coro a capela la última vez.',
      chart: `{Verso}
[C]Me postro ante Tu [G/B]trono,
[Am]rindo todo lo que [F]soy,
[C]los ancianos y los [G/B]ángeles
[Am]cantan santo al [F]Dios de amor.

{Coro}
[F]Santo, [G]santo, [Am]digno es el Cor[C]dero,
[F]toda la gloria [G]sea para [C]Ti.
[F]Santo, [G]santo, [Am]en cielo y [C]tierra,
[F]reina por los [G]siglos, a[C]mén.`
    },
    {
      id: 's6', title: 'Mesa de Gracia', artist: 'Canción de ejemplo', key: 'F', bpm: 76, time: '4/4', tempo: 'lenta', duration: 290,
      tags: ['santa cena', 'cruz', 'gracia'],
      arrangement: ['Verso 1', 'Coro', 'Verso 1', 'Coro'],
      notes: 'Para la distribución de la Santa Cena. Instrumental suave entre coros.',
      chart: `{Verso 1}
[F]Partido fue Tu [Bb]cuerpo,
[Dm]derramada Tu [C]sangre,
[F]en esta mesa [Bb]recordamos
[Dm]el precio de Tu a[C]mor.

{Coro}
[Bb]Venimos a la [F]mesa,
[C]hambrientos de Tu [Dm]gracia,
[Bb]hasta que vuelvas, Se[F]ñor,
[Gm]anunciamos Tu [C]muerte y Tu vic[F]toria.`
    },
    {
      id: 's7', title: 'Canta, Pueblo', artist: 'Canción de ejemplo', key: 'Bb', bpm: 132, time: '4/4', tempo: 'rapida', duration: 240,
      tags: ['celebración', 'alegría'],
      arrangement: ['Intro', 'Verso', 'Coro', 'Verso', 'Coro', 'Coro'],
      notes: '',
      chart: `{Intro}
[Bb] [Eb] [Bb] [F]

{Verso}
[Bb]Canta, pueblo, [Eb]canta con fuerza,
[Gm]que se escuche [F]hasta el final,
[Bb]las naciones [Eb]verán Su gloria,
[Gm]nuestro Dios por [F]siempre reinará.

{Coro}
[Eb]Alza tus [F]manos, [Gm]danza ante el Rey,
[Eb]todo lo que [F]tiene a[Gm]liento
[Eb]alabe al [F]Señor, a[Bb]mén.`
    },
    {
      id: 's8', title: 'Esperanza Viva', artist: 'Canción de ejemplo', key: 'Eb', bpm: 84, time: '4/4', tempo: 'media', duration: 300,
      tags: ['esperanza', 'resurrección'],
      arrangement: ['Verso', 'Coro', 'Verso', 'Coro', 'Coro'],
      notes: '',
      chart: `{Verso}
[Eb]La tumba está va[Ab]cía,
[Cm]la piedra remo[Bb]vida,
[Eb]la muerte ya no [Ab]tiene
[Cm]la última pala[Bb]bra.

{Coro}
[Ab]Esperanza [Eb]viva,
[Bb]Cristo resuci[Cm]tó,
[Ab]ancla de mi [Eb]alma,
[Bb]vive mi Reden[Eb]tor.`
    },
    {
      id: 's9', title: '¡Santo! ¡Santo! ¡Santo!', artist: 'R. Heber · trad. J. B. Cabrera (dominio público)', key: 'D', bpm: 76, time: '4/4', tempo: 'media', duration: 210,
      tags: ['himno', 'santidad', 'adoración'],
      arrangement: ['Estrofa 1'],
      notes: 'Himno clásico. Ideal para abrir un servicio de Santa Cena.',
      chart: `{Estrofa 1}
[D]¡Santo! ¡Santo! [Bm]¡Santo! [G]Señor omni[D]potente,
[D]siempre el labio [G]mío lo[A]ores te da[D]rá;
[D]¡Santo! ¡Santo! [Bm]¡Santo! [G]te adoro [D]reverente,
[G]Dios en tres per[D]sonas, [A]bendita Trini[D]dad.`
    }
  ];

  const MEMBERS = [
    ['m1', 'Byron David', ['director', 'voz', 'acustica'], ['t1', 't2'], { admin: true, leader: true }],
    ['m2', 'Samuel Ortega', ['director', 'voz', 'acustica'], ['t2', 't3'], { leader: true }],
    ['m3', 'Valeria Méndez', ['voz', 'coro'], ['t1']],
    ['m4', 'Andrés Castillo', ['voz', 'coro'], ['t2']],
    ['m5', 'Camila Herrera', ['coro'], ['t1', 't3']],
    ['m6', 'Lucía Paredes', ['coro', 'voz'], ['t2']],
    ['m7', 'Mateo Vargas', ['coro'], ['t3', 't1']],
    ['m8', 'Sofía Navarro', ['coro', 'teclado'], ['t1']],
    ['m9', 'Joel Romero', ['acustica', 'electrica'], ['t1']],
    ['m10', 'Gabriel Torres', ['electrica'], ['t2', 't3']],
    ['m11', 'Isaac Molina', ['acustica', 'voz'], ['t2']],
    ['m12', 'Nicolás Jiménez', ['bajo'], ['t1']],
    ['m13', 'Ariel Salazar', ['bajo', 'electrica'], ['t2', 't3']],
    ['m14', 'Rebeca Flores', ['piano', 'teclado'], ['t1'], { leader: true }],
    ['m15', 'Esteban León', ['piano'], ['t2']],
    ['m16', 'Marta Aguilar', ['teclado', 'piano'], ['t3']],
    ['m17', 'David Cárdenas', ['bateria'], ['t1']],
    ['m18', 'Josué Peña', ['bateria', 'bajo'], ['t2', 't3']],
    ['m19', 'Emanuel Rojas', ['sonido'], ['t1', 't2']],
    ['m20', 'Paola Vega', ['proyeccion'], ['t1', 't2']],
    ['m21', 'Kevin Soto', ['sonido', 'proyeccion'], ['t3']]
  ];

  /** Datos de inicio: solo el líder. El resto lo agrega él desde la app. */
  function cleanSeed() {
    return {
      version: App.store.SCHEMA,
      settings: { churchName: App.config.churchName, ministryName: App.config.ministryName },
      session: { userId: 'm1' },
      prefs: { notation: 'letras', timeFormat: '12h', theme: 'dark' },
      teams: [],
      members: [{ id: 'm1', name: 'Byron David', roles: ['director', 'voz'], teams: [], phone: '', email: '', unavailable: [], leader: true, admin: true }],
      songs: [],
      events: [],
      messages: []
    };
  }

  /** seed() = inicio limpio · seed({ demo: true }) = datos de ejemplo para probar */
  App.seed = function seed({ demo = false } = {}) {
    if (!demo) return cleanSeed();
    const today = U.parseYmd(U.today());
    const sunday = U.addDays(today, (7 - today.getDay()) % 7); // próximo domingo (o hoy)
    const d = (n) => U.ymd(U.addDays(sunday, n));

    const members = MEMBERS.map(([id, name, roles, teams, flags], i) => Object.assign({
      id, name, roles, teams,
      phone: `0991 234 ${String(500 + i).padStart(3, '0')}`,
      email: `${U.normalize(name).replace(/\s+/g, '.')}@example.org`,
      unavailable: [],
      leader: false,
      admin: false
    }, flags || {}));

    const byId = Object.fromEntries(members.map((m) => [m.id, m]));
    byId.m9.unavailable = [d(0)];
    byId.m17.unavailable = [d(14)];
    byId.m3.unavailable = [d(7)];

    // Crea los puestos de un evento y rellena los indicados: { 'coro-2': ['m8', 'pending'] }
    const slots = (type, fill = {}) => App.actions.slotsFor(type).map((a) => {
      const f = fill[a.slot];
      return f ? Object.assign(a, { memberId: f[0], status: f[1] || 'confirmed' }) : a;
    });
    const set = (...items) => items.map(([songId, key, leaderId]) => ({ songId, key, leaderId: leaderId || null, notes: '' }));

    const events = [
      {
        id: 'e1', title: 'Servicio Dominical', type: 'servicio', date: d(-14), time: '10:00', place: 'Auditorio principal', teamId: 't1', notes: '',
        setlist: set(['s1', 'G', 'm3'], ['s3', 'A', 'm1'], ['s2', 'D', 'm1'], ['s5', 'C', 'm3']),
        assignments: slots('servicio', { 'director-1': ['m1'], 'voz-1': ['m3'], 'coro-1': ['m5'], 'coro-2': ['m7'], 'coro-3': ['m8'], 'acustica-1': ['m9'], 'electrica-1': ['m10'], 'bajo-1': ['m12'], 'piano-1': ['m14'], 'teclado-1': ['m16'], 'bateria-1': ['m17'], 'sonido-1': ['m19'], 'proyeccion-1': ['m20'] })
      },
      {
        id: 'e2', title: 'Servicio Dominical', type: 'servicio', date: d(-7), time: '10:00', place: 'Auditorio principal', teamId: 't2', notes: '',
        setlist: set(['s7', 'Bb', 'm4'], ['s4', 'E', 'm2'], ['s6', 'F', 'm2'], ['s5', 'D', 'm6']),
        assignments: slots('servicio', { 'director-1': ['m2'], 'voz-1': ['m4'], 'coro-1': ['m6'], 'coro-2': ['m5'], 'coro-3': ['m7'], 'acustica-1': ['m11'], 'electrica-1': ['m10'], 'bajo-1': ['m13'], 'piano-1': ['m15'], 'teclado-1': ['m16'], 'bateria-1': ['m18'], 'sonido-1': ['m19'], 'proyeccion-1': ['m20'] })
      },
      {
        id: 'e3', title: 'Ensayo general', type: 'ensayo', date: d(-3), time: '19:30', place: 'Salón de ensayo', teamId: 't1', notes: 'Repaso del setlist del domingo.',
        setlist: set(['s1', 'G', 'm3'], ['s3', 'A', 'm1'], ['s2', 'D', 'm1'], ['s5', 'D', 'm3']),
        assignments: slots('ensayo', { 'director-1': ['m1'], 'voz-1': ['m3'], 'coro-1': ['m5'], 'coro-2': ['m8'], 'acustica-1': ['m2'], 'electrica-1': ['m10'], 'bajo-1': ['m12'], 'piano-1': ['m14'], 'bateria-1': ['m17'] })
      },
      {
        id: 'e4', title: 'Servicio Dominical AM', type: 'servicio', date: d(0), time: '09:00', place: 'Auditorio principal', teamId: 't1',
        notes: 'Llegada 7:30 a. m. para prueba de sonido. Bautismos después de la prédica: canción de cierre suave.',
        setlist: set(['s1', 'G', 'm3'], ['s3', 'A', 'm1'], ['s2', 'D', 'm1'], ['s5', 'D', 'm3']),
        assignments: slots('servicio', { 'director-1': ['m1'], 'voz-1': ['m3'], 'coro-1': ['m5'], 'coro-2': ['m8', 'pending'], 'coro-3': ['m7', 'pending'], 'acustica-1': ['m9', 'declined'], 'electrica-1': ['m10'], 'bajo-1': ['m12'], 'piano-1': ['m14'], 'bateria-1': ['m17'], 'sonido-1': ['m19'], 'proyeccion-1': ['m20', 'pending'] })
      },
      {
        id: 'e5', title: 'Servicio Dominical PM', type: 'servicio', date: d(0), time: '18:00', place: 'Auditorio principal', teamId: 't2', notes: '',
        setlist: set(['s7', 'Bb', 'm4'], ['s4', 'E', 'm2'], ['s8', 'Eb', 'm6']),
        assignments: slots('servicio', { 'director-1': ['m2'], 'voz-1': ['m4', 'pending'], 'coro-1': ['m6'], 'acustica-1': ['m11'], 'electrica-1': ['m13', 'pending'], 'bajo-1': ['m18'], 'piano-1': ['m15'], 'sonido-1': ['m19', 'pending'], 'proyeccion-1': ['m20', 'pending'] })
      },
      {
        id: 'e6', title: 'Ensayo general', type: 'ensayo', date: d(4), time: '19:30', place: 'Salón de ensayo', teamId: 't1', notes: 'Repasar el setlist del próximo domingo.',
        setlist: [],
        assignments: slots('ensayo', { 'director-1': ['m1'] })
      },
      {
        id: 'e7', title: 'Noche de Jóvenes', type: 'jovenes', date: d(6), time: '19:00', place: 'Salón juvenil', teamId: 't3', notes: 'Tema de la noche: esperanza.',
        setlist: [],
        assignments: slots('jovenes')
      },
      {
        id: 'e8', title: 'Servicio Dominical AM', type: 'servicio', date: d(7), time: '09:00', place: 'Auditorio principal', teamId: 't1', notes: '',
        setlist: set(['s4', 'E', null], ['s3', 'A', 'm1'], ['s8', 'Eb', null], ['s2', 'D', 'm1']),
        assignments: slots('servicio', { 'director-1': ['m1', 'pending'] })
      },
      {
        id: 'e9', title: 'Servicio de Santa Cena', type: 'especial', date: d(14), time: '10:00', place: 'Auditorio principal', teamId: 't1',
        notes: 'Santa Cena: coordinar con pastores. Una canción suave durante la distribución.',
        setlist: [],
        assignments: slots('especial')
      }
    ];

    const now = Date.now();
    const H = 3600 * 1000;
    const messages = [
      { id: 'c1', channel: 'general', memberId: 'm1', text: '¡Bendiciones, equipo! Ya está el setlist del domingo. Por favor confirmen su asistencia desde Inicio.', ts: now - 30 * H },
      { id: 'c2', channel: 'general', memberId: 'm14', text: 'Bajé "Ante Tu Trono" a D para que Valeria esté más cómoda.', ts: now - 26 * H },
      { id: 'c3', channel: 'general', memberId: 'm9', text: 'Este domingo no podré, viajo con mi familia. Perdón por el aviso tarde.', ts: now - 20 * H },
      { id: 'c4', channel: 'general', memberId: 'm2', text: 'Gracias por avisar, Joel. Buscamos reemplazo para la acústica.', ts: now - 19 * H },
      { id: 'c5', channel: 'e4', memberId: 'm1', text: 'Llegada 7:30 para prueba de sonido.', ts: now - 28 * H },
      { id: 'c6', channel: 'e4', memberId: 'm19', text: 'Listo, monitores revisados el jueves.', ts: now - 27 * H },
      { id: 'c7', channel: 'e4', memberId: 'm3', text: '¿Hacemos el puente de Luz de la Mañana dos veces?', ts: now - 6 * H },
      { id: 'c8', channel: 'e4', memberId: 'm1', text: 'Sí, dos veces y luego coro final.', ts: now - 5 * H },
      { id: 'c9', channel: 'lideres', memberId: 'm2', text: 'Para la Noche de Jóvenes podemos usar al equipo 3 completo. ¿Alguien arma el setlist?', ts: now - 3 * H }
    ];

    return {
      version: App.store.SCHEMA,
      settings: { churchName: App.config.churchName, ministryName: App.config.ministryName },
      session: { userId: 'm1' },
      prefs: { notation: 'letras', timeFormat: '12h', theme: 'dark' },
      teams: [
        { id: 't1', name: 'Domingo AM' },
        { id: 't2', name: 'Domingo PM' },
        { id: 't3', name: 'Jóvenes' }
      ],
      members,
      songs: U.clone(SONGS),
      events,
      messages
    };
  };
})();
