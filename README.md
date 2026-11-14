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
| **Evento** | Setlist (ordenar arrastrando, tono por canción, quién dirige), equipo por puesto con avisos de conflictos, *Completar por rotación*, chat del evento, notas y modo escenario. |
| **Canciones** | Repertorio con búsqueda y filtros. **Importar PDF**: sube los PDF de LaCuerda.net (o pega el texto) y la app lee título, artista, tono, secciones, letra y acordes. Si la página trae varias versiones, eliges cuál guardar. |
| **Canción** | Transponer, capo, notación C D E / Do Re Mi / números, solo letra para cantantes, dos columnas, arreglo editable, auto-scroll y editor con vista previa. Convierte canciones pegadas con los acordes encima de la letra. |
| **Equipo** | Personas, puestos, sub-equipos, cobertura por instrumento, fechas no disponibles e historial. |
| **Chat** | Canal general, de líderes y uno por evento. |
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
    auth.js             inicio de sesión
    importer.js         lectura de canciones (LaCuerda.net y similares)
    model.js            consultas (conflictos, carga de servicio…)
    actions.js          todos los cambios de datos
    chords.js           motor de acordes
    rotation.js         rotación justa del equipo
  data/seed.js          datos de demostración
  ui/                   íconos, componentes, modo escenario, importar PDF, app instalable
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
