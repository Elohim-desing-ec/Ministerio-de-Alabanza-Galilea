/* =========================================================================
   SELAH · Configuración
   Aquí se definen los puestos del equipo, los tipos de evento y los
   valores por defecto. Agregar un instrumento nuevo = agregar una línea.
   ========================================================================= */
App.config = {
  appName: 'Selah',
  appTagline: 'Planificación de alabanza',
  siteTitle: 'Alabanza Galilea',
  version: '0.3',

  // Valores iniciales (se pueden cambiar desde Ajustes)
  churchName: 'Galilea',
  ministryName: 'Ministerio de Alabanza',

  // Clave de guardado local. Cambiarla reinicia los datos de demo.
  storageKey: 'selah-galilea-v2',
  aiStorageKey: 'selah-ai-v1',

  // Base de datos compartida (Supabase). La clave "anon" es pública por diseño:
  // la seguridad la ponen las reglas (RLS) de las tablas galilea_*.
  // Deja url vacío para usar la app solo en el navegador (sin base de datos).
  supabase: {
    url: 'https://kucrypxgjptsdjxsmvce.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1Y3J5cHhnanB0c2RqeHNtdmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3OTk5NTksImV4cCI6MjEwOTM3NTk1OX0.64ZWNzo2ncHF_X31A3kbCC-JMRAJgJN1KXZcmnOm3VE',
    emailDomain: 'galilea.example.com',
    usersFunction: 'galilea-usuarios'
  },

  // Acceso de demostración (solo si no hay base de datos). El líder principal entra con su usuario y
  // contraseña; las demás cuentas las crea el líder desde "Equipo".
  // passwordHash = SHA-256 de "selah:" + contraseña en minúsculas y sin espacios.
  auth: {
    users: [
      { username: 'byron', memberId: 'm1', passwordHash: '53088b6fac4eedba1a7b0265b6e13f49c16190fbc9fe69227cde533f2ee11062' }
    ]
  },

  // Grupos de puestos (para ordenar y filtrar)
  positionGroups: [
    { id: 'voces',   label: 'Voces',             icon: 'mic' },
    { id: 'cuerdas', label: 'Guitarras y bajo',  icon: 'guitar' },
    { id: 'teclas',  label: 'Piano y teclados',  icon: 'keys' },
    { id: 'ritmo',   label: 'Batería',           icon: 'drum' },
    { id: 'tecnica', label: 'Técnica',           icon: 'sliders' }
  ],

  // Puestos del equipo. "voice: true" = puede dirigir una canción.
  positions: [
    { id: 'director',   label: 'Director de alabanza', group: 'voces', voice: true },
    { id: 'voz',        label: 'Voz principal',        group: 'voces', voice: true },
    { id: 'coro',       label: 'Coros',                group: 'voces', voice: true },
    { id: 'acustica',   label: 'Guitarra acústica',    group: 'cuerdas' },
    { id: 'electrica',  label: 'Guitarra eléctrica',   group: 'cuerdas' },
    { id: 'bajo',       label: 'Bajo',                 group: 'cuerdas' },
    { id: 'piano',      label: 'Piano',                group: 'teclas' },
    { id: 'teclado',    label: 'Teclado / Synth',      group: 'teclas' },
    { id: 'bateria',    label: 'Batería',              group: 'ritmo' },
    { id: 'sonido',     label: 'Sonido',               group: 'tecnica' },
    { id: 'proyeccion', label: 'Multimedia',           group: 'tecnica' }
  ],

  // Tipos de evento y los puestos que se crean por defecto en cada uno
  eventTypes: {
    dominical:  { label: 'Culto Dominical',     slots: ['sonido', 'voz', 'piano', 'acustica', 'bateria', 'bajo'] },
    ensenanza:  { label: 'Culto de Enseñanza',  slots: ['sonido', 'voz', 'piano', 'acustica', 'bateria', 'bajo'] },
    jovenes:    { label: 'Culto de Jóvenes',    slots: ['sonido', 'voz', 'piano', 'acustica', 'bateria', 'bajo'] },
    damas:      { label: 'Culto de Damas',      slots: ['sonido', 'voz', 'piano', 'acustica', 'bateria'] },
    caballeros: { label: 'Culto de Caballeros', slots: ['sonido', 'voz', 'piano', 'acustica', 'bateria', 'bajo'] },
    oracion:    { label: 'Culto de Oración',    slots: ['sonido'] },
    servicio:   { label: 'Servicio',            slots: ['director', 'voz', 'coro', 'coro', 'coro', 'acustica', 'electrica', 'bajo', 'piano', 'teclado', 'bateria', 'sonido', 'proyeccion'] },
    ensayo:     { label: 'Ensayo',              slots: ['director', 'voz', 'coro', 'coro', 'acustica', 'electrica', 'bajo', 'piano', 'bateria'] },
    especial:   { label: 'Especial',            slots: ['sonido', 'proyeccion'] }
  },

  // Cronograma: cultos de cada semana (el líder lo cambia al crear el mes).
  // day: 1 = lunes … 7 = domingo · weeks: semanas del mes en que va (vacío = todas)
  scheduleTemplate: [
    { day: 1, type: 'oracion',    title: 'Culto de Oración',    time: '19:00', weeks: [] },
    { day: 2, type: 'damas',      title: 'Culto de Damas',      time: '19:00', weeks: [1, 3, 5] },
    { day: 2, type: 'caballeros', title: 'Culto de Caballeros', time: '19:00', weeks: [2, 4] },
    { day: 3, type: 'ensenanza',  title: 'Culto de Enseñanza',  time: '19:00', weeks: [] },
    { day: 6, type: 'jovenes',    title: 'Culto de Jóvenes',    time: '19:00', weeks: [] },
    { day: 7, type: 'dominical',  title: 'Culto Dominical',     time: '10:00', weeks: [] }
  ],

  // Nombre corto y color de cada puesto en el cronograma
  scheduleRoles: {
    director: { label: 'Dirección', color: '#B45309' }, voz: { label: 'Voz', color: '#7C3AED' }, coro: { label: 'Coros', color: '#9333EA' },
    acustica: { label: 'Guitarra', color: '#B7791F' }, electrica: { label: 'Eléctrica', color: '#C2410C' }, bajo: { label: 'Bajo', color: '#9F1239' },
    piano: { label: 'Piano', color: '#15803D' }, teclado: { label: 'Teclado', color: '#0F766E' }, bateria: { label: 'Batería', color: '#0E7490' },
    sonido: { label: 'Sonido', color: '#1D4ED8' }, proyeccion: { label: 'Multimedia', color: '#059669' }
  },

  tempos: [
    { id: 'rapida', label: 'Rápida' },
    { id: 'media',  label: 'Media' },
    { id: 'lenta',  label: 'Lenta' }
  ],

  // Temas sugeridos para clasificar canciones (se pueden escribir otros)
  songTags: ['adoración', 'alegría', 'apertura', 'avivamiento', 'celebración', 'cruz', 'esperanza', 'espíritu', 'fidelidad', 'gracia', 'himno', 'resurrección', 'santa cena', 'santidad'],

  places: ['Auditorio principal', 'Salón de ensayo', 'Salón juvenil', 'Capilla'],

  // Rotación justa: cuántos días mirar hacia atrás y penalizaciones
  rotation: {
    lookbackDays: 60,
    lookaheadDays: 30,
    otherTeamPenalty: 4,
    sameDayPenalty: 3
  },

  // Asistente de IA. Los proveedores se prueban en este orden en modo "auto".
  ai: {
    order: ['gemini', 'openai', 'claude', 'local'],
    gemini: {
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      model: 'gemini-2.5-flash'
    },
    openai: {
      // Cualquier API compatible con OpenAI: Groq (gratis), OpenRouter, Ollama local…
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile'
    }
  }
};
