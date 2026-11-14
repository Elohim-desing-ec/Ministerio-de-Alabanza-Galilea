# Ministerio de Alabanza Galilea · Selah (demo)

App web para organizar un ministerio de alabanza grande: agenda, equipo con varios cantantes, guitarristas y pianistas, rotación justa, setlists, hojas de acordes que se transponen, chat del equipo y un asistente de IA gratuito.

Está hecha con HTML, CSS y JavaScript puros. No hay que instalar ni compilar nada.

## Cómo abrirla

- **En la web:** https://elohim-desing-ec.github.io/Ministerio-de-Alabanza-Galilea/
- **Como app:** en Ajustes → *Instalar app* (o el menú del navegador → *Instalar app* / *Agregar a inicio*). Queda con su ícono, a pantalla completa y abre sin internet. No necesita Play Store ni App Store.
- **En tu computadora:** doble clic en `index.html`.
- **Con servidor local** (recomendado para probar Gemini, Groq u Ollama):
  ```bash
  cd "MINISTERIO DE ALABANZA"
  python3 -m http.server 8000
  ```
  Luego abre http://localhost:8000

## Qué incluye

| Pantalla | Qué hace |
| --- | --- |
| **Inicio** | Tus servicios con botón Confirmar / No puedo, la semana, el estado de los próximos eventos y lo que necesita atención (para líderes). |
| **Agenda** | Calendario mensual y lista, filtro por equipo, y el modo *Mis fechas no disponibles* para que cada persona bloquee días. |
| **Cronograma** | Pantalla propia en el menú (y también en la Agenda, modo *Cronograma*): el mes como póster (cada día con sus cultos y quién está en sonido, voz, piano, guitarra, batería, bajo…). El líder crea el mes de una vez con la plantilla semanal (Oración los lunes, Damas/Caballeros los martes alternados, Enseñanza los miércoles, Jóvenes los sábados, Dominical los domingos), lo completa con la rotación y toca un puesto para asignar. *Compartir imagen* arma el PNG para WhatsApp. |
| **Avisos** | Campana con lo pendiente: al asignarte un servicio aparece una ventana para *Aceptar* o decir *No puedo*; un día antes (y el mismo día) te recuerda qué te toca; te avisa cuando llega el listado; al líder le avisa quién no puede. Con *Activar avisos* también llegan como notificación del celular mientras la app está abierta o en segundo plano. |
| **Listado** | Quien canta en el culto (voz principal, segunda voz, coros o director) y el líder arman el listado con tono y link de referencia y lo envían al culto: todos lo reciben en avisos y en el chat del evento. Los instrumentistas solo lo reciben y ensayan. Se pueden incluir canciones que aún no están en el repertorio. |
| **Evento** | Setlist (ordenar arrastrando, tono por canción, quién dirige), equipo por puesto con avisos de conflictos, *Completar por rotación*, pestaña **Escuchar** (cada persona envía el link de cada alabanza y se escucha ahí mismo), chat del evento, notas y modo escenario. |
| **Modo escenario + ensayo** | Letra grande canción por canción. Abajo: metrónomo con BPM (−/+ y *Tap*), compás, pulsos que se iluminan y cuenta inicial. **Pistas**: batería, bajo, piano, guitarra, pad y click generados con los acordes de la hoja, cada una con volumen, silenciar (M) y dejar sola (S), y atajos como *Solo batería* o *Sin batería*. **Instrumentos**: el acorde que suena se ilumina en la letra y se ve qué teclas toca el piano, la posición de guitarra y su rasgueo, la nota del bajo y el ritmo de la batería. Teclas: espacio = pistas, S = auto-scroll, ← → = canción. |
| **Intro y entrada** | Al abrir: logo animado y el nombre del ministerio (se salta con un toque). Luego la pantalla de entrada: dos columnas en computadora, una en el celular. |
| **Escuchar** | Grabaciones del repertorio y links que comparte el equipo (YouTube, YouTube Music, Spotify, SoundCloud, Deezer, Apple Music, Google Drive, Dropbox o archivos MP3). Suenan dentro de la app en un reproductor flotante que sigue sonando aunque cambies de pantalla. *Escuchar el setlist* los pone en fila. |
| **Canciones** | Repertorio con búsqueda y filtros. **Importar PDF**: sube los PDF de LaCuerda.net (o pega el texto) y la app lee título, artista, tono, secciones, letra y acordes. Si la página trae varias versiones, eliges cuál guardar. |
| **Canción** | Transponer, capo, notación C D E / Do Re Mi / números, solo letra para cantantes, dos columnas, arreglo editable, auto-scroll y editor con vista previa. Convierte canciones pegadas con los acordes encima de la letra. |
| **Ensayar con la música** | En el modo escenario, pestaña *Música*: eliges el MP3 de la alabanza (o un link directo de audio) y la app detecta el tempo y cada pulso. El click va pegado a la banda, la letra avanza sola con la música (si se desfasa, tocas la línea que se está cantando y queda ajustada), puedes bajar la velocidad sin cambiar el tono y repetir una parte (A–B). Con el micrófono detecta el tempo de lo que suena en la sala (YouTube, Spotify o la banda en vivo) y arranca el metrónomo a tiempo. El audio se guarda solo en ese celular. |
| **La letra sigue a la canción** | **Automático:** al cargar el MP3 la app reconoce los acordes de la grabación, detecta su tono, dónde termina la intro y si repiten partes, y acomoda la letra sola (línea por línea). Con YouTube, *Sincronizar sola* escucha el video una vez (sonido de la pestaña en Chrome de computadora, o el micrófono) y hace lo mismo. Desde ahí los acordes y la letra cambian solos en el momento justo, como karaoke; *Ver los acordes en el tono de la grabación* los pone como suenan. Si algo queda corrido, se toca la línea que se está cantando, o se ajusta a mano. Si el líder la comparte, sirve para todo el equipo; también funciona en la página de la canción al darle *Escuchar*. |
| **Rachas** | Al terminar un culto, el líder lo verifica en el evento: marca quién cumplió hasta el final. Cada servicio cumplido suma 1 a la racha de esa persona; uno no cumplido la reinicia (avisar antes que no puede no la rompe). Hay niveles con insignias (1, 3, 5, 10, 20 y 40 seguidos), la tarjeta *Tu racha* en Inicio y la tabla *Rachas del equipo*. |
| **Equipo** | Personas, puestos, sub-equipos, cobertura por instrumento, fechas no disponibles e historial. |
| **Chat** | Canal general, de líderes y uno por evento. Vista previa del último mensaje y contador de no leídos, links de música que se escuchan dentro, reacciones con emoji, copiar y borrar. |
| **Asistente** | Arma setlists, completa el equipo, transpone, revisa disponibilidad, crea eventos y sugiere palabras de transición. Todo cambio se aplica con un botón. |
| **Ajustes** | Nombre de la iglesia, tema claro/oscuro, notación, IA, respaldo y restablecer demo. |

## Acceso y base de datos

La app guarda todo en una base de datos compartida (Supabase), así cada persona entra desde su propio celular y todos ven lo mismo, en vivo.

- El líder de alabanza entra con el usuario **byron** y la contraseña que se le entregó.
- Solo el líder agrega o modifica personas, canciones y eventos, y crea el **usuario y la contraseña** de cada persona en **Equipo → (persona) → Editar → Acceso a la app**.
- Los músicos confirman su asistencia, eligen qué instrumento tocan ese día, marcan sus fechas no disponibles y usan el chat.
- El líder puede **ver la app como otra persona** (menú con su nombre) para revisar lo que ve cada músico.
- Cada celular guarda una copia para abrir sin conexión; al volver la señal, se pone al día solo. El punto junto al nombre indica si está *Sincronizado*, *Guardando…* o *Sin conexión*.

### Cómo está armada la base

- Proyecto de Supabase **elohim-inventario**, en tablas propias que empiezan con `galilea_` (no toca las tablas del inventario).
- `galilea_items`: personas, canciones, eventos, mensajes, equipos y ajustes (una fila por cada uno).
- `galilea_perfiles`: quién puede entrar y quién es líder.
- Reglas de seguridad (RLS): solo quien tiene perfil en Galilea puede ver los datos; solo los líderes cambian personas, canciones y eventos; los músicos solo pueden actualizar eventos (confirmar), su propia ficha y el chat.
- Función del servidor `galilea-usuarios`: crea, cambia y borra cuentas. Solo responde a líderes.
- Las cuentas usan correos internos `usuario@galilea.example.com`; nadie recibe correos.

Si se borra la sección `supabase` de `js/config.js`, la app vuelve a funcionar solo en el navegador (modo demo).

## Asistente de IA (gratis)

El asistente elige solo el mejor proveedor disponible:

1. **Gemini**: clave gratis en https://aistudio.google.com/apikey (Ajustes → Asistente de IA).
2. **Groq / OpenRouter / Ollama**: clave gratis en https://console.groq.com/keys, o Ollama en tu propia computadora sin clave.
3. **Motor local**: funciona siempre, sin internet y sin clave. Reconoce los pedidos más comunes.
4. **Claude**: solo si la app se abre dentro de claude.ai.

Las claves se guardan solo en el navegador. Para Ollama desde el navegador, inicia Ollama con `OLLAMA_ORIGINS=*`.

## Estructura del código

```
index.html              estructura de la app y orden de carga
css/
  tokens.css            colores, tipografías y medidas (la identidad visual)
  glass.css             estilo "Cristal": vidrio oscuro y destello índigo-cian
  base.css              reset y utilidades
  layout.css            barra lateral, contenido, versión móvil
  components.css        botones, tarjetas, modales, formularios…
  chart.css             hoja de acordes
  animations.css        animaciones (se apagan con "reducir movimiento")
  views/*.css           un archivo por pantalla
js/
  config.js             puestos, tipos de evento, temas, opciones de IA
  core/
    namespace.js        objeto global App
    utils.js            fechas, texto
    store.js            estado y copia local (App.storage)
    cloud.js            base de datos compartida (Supabase) y cambios en vivo
    media.js            links de música (YouTube, Spotify, SoundCloud…)
    practice.js         metrónomo y pistas de ensayo (Web Audio)
    beat.js · align.js  detectar el pulso y acomodar la letra sola (reconoce los acordes)
    follow.js · ytsync.js  la letra sigue al MP3 o al video de YouTube
    auth.js             inicio de sesión
    importer.js         lectura de canciones (LaCuerda.net y similares)
    model.js            consultas (conflictos, carga de servicio…)
    actions.js          todos los cambios de datos
    chords.js           motor de acordes
    rotation.js         rotación justa del equipo
  data/seed.js          datos de demostración
  ui/                   íconos, componentes, intro, reproductor, modo escenario, importar PDF, app instalable
sw.js                   funcionamiento sin internet
manifest.webmanifest    datos de la app instalable
  ai/assistant.js       núcleo del asistente
  ai/providers/*.js     Claude, Gemini, OpenAI-compatible, motor local
  views/*.js            una pantalla por archivo
  app.js                rutas y arranque
```

### Cómo extenderla

- **Cambiar colores o tipografía:** edita solo `css/tokens.css`.
- **Agregar un instrumento o puesto:** agrega una línea en `positions` de `js/config.js`.
- **Cambiar los puestos que trae cada tipo de evento:** `eventTypes` en `js/config.js`.
- **Agregar una pantalla:** crea `js/views/mi-pantalla.js` con `App.views.mipantalla = { title, render(root, param) }`, su CSS en `css/views/`, y enlázala en `index.html` y en `NAV` de `js/app.js`.
- **Agregar otro proveedor de IA:** crea un archivo en `js/ai/providers/` que llame a `App.ai.register({ id, label, available, ask })`.

### Sobre las pistas de ensayo

Las pistas no se descargan ni se guardan: el navegador las genera en el momento a partir de los acordes, el tono y el BPM de la canción, así no ocupan espacio en la base de datos. Separar una grabación real en pistas (como hace Moises) necesita un servicio de inteligencia artificial en un servidor; queda como paso futuro.

### Próximos pasos posibles

- Notificaciones al celular cuando te asignan a un servicio.
- Proyecto de Supabase propio para Galilea (hoy comparte proyecto con el inventario por el límite del plan gratis).

## Canciones de ejemplo

Las canciones de la demo se escribieron para esta demo, salvo "¡Santo! ¡Santo! ¡Santo!", que es de dominio público. Reemplázalas por el repertorio del ministerio, respetando las licencias de cada canción (por ejemplo, con CCLI).

## Importar desde LaCuerda.net

1. Abre la canción en LaCuerda.net y guárdala como PDF (Imprimir → Guardar como PDF).
2. En la app: **Canciones → Importar PDF** y elige uno o varios archivos.
3. Revisa título, artista y tono, abre la vista previa y pulsa **Guardar**.

Los PDF deben tener texto (los que genera el navegador lo tienen). Una foto o un escaneo no se puede leer; en ese caso copia la canción de la página y usa *O pega el texto de la canción*.
