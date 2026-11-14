# Ministerio de Alabanza Galilea · Selah (demo)

App web para organizar un ministerio de alabanza grande: agenda, equipo con varios cantantes, guitarristas y pianistas, rotación justa, setlists, hojas de acordes que se transponen, chat del equipo y un asistente de IA gratuito.

Está hecha con HTML, CSS y JavaScript puros. No hay que instalar ni compilar nada.

## Cómo abrirla

- **En la web:** https://elohim-desing-ec.github.io/Ministerio-de-Alabanza-Galilea/
- **En el celular:** abre ese enlace y elige "Agregar a pantalla de inicio" para usarla como una app.
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
| **Canciones** | Repertorio con búsqueda y filtros por ritmo y tema. |
| **Canción** | Transponer, capo, notación C D E / Do Re Mi / números, solo letra para cantantes, dos columnas, arreglo editable, auto-scroll y editor con vista previa. Convierte canciones pegadas con los acordes encima de la letra. |
| **Equipo** | Personas, puestos, sub-equipos, cobertura por instrumento, fechas no disponibles e historial. |
| **Chat** | Canal general, de líderes y uno por evento. |
| **Asistente** | Arma setlists, completa el equipo, transpone, revisa disponibilidad, crea eventos y sugiere palabras de transición. Todo cambio se aplica con un botón. |
| **Ajustes** | Nombre de la iglesia, tema claro/oscuro, notación, IA, respaldo y restablecer demo. |

## Acceso

- El líder de alabanza entra con el usuario **byron** y la contraseña que se le entregó.
- El líder crea el usuario y la contraseña de cada persona en **Equipo → (persona) → Editar → Acceso a la app**.
- Quien toca varios instrumentos elige cuál toca cada día desde su tarjeta en **Inicio** o desde el evento.
- El líder puede **ver la app como otra persona** (menú con su nombre) para revisar lo que ve cada músico.

> Esta es una puerta de demostración: sin base de datos, todo se verifica en el navegador y las cuentas que crea el líder funcionan solo en el navegador donde se crearon. Para cuentas reales en todos los celulares hay que conectar una base de datos con inicio de sesión (por ejemplo, Supabase).

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
  glass.css             estilo "Cristal": vidrio, grano y brillo vino
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
    store.js            estado y guardado (App.storage)
    auth.js             inicio de sesión de demostración
    model.js            consultas (conflictos, carga de servicio…)
    actions.js          todos los cambios de datos
    chords.js           motor de acordes
    rotation.js         rotación justa del equipo
  data/seed.js          datos de demostración
  ui/                   íconos, componentes, markdown, modo escenario
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

### Próximo paso: datos compartidos para todo el equipo

En la demo cada navegador guarda su propia copia. Para que todo el ministerio vea lo mismo en tiempo real, con inicio de sesión y notificaciones, hay que conectar un servidor. Todo el guardado pasa por `App.storage` en `js/core/store.js`, así que se puede cambiar por Supabase, Firebase o una API propia sin tocar las pantallas.

## Canciones de ejemplo

Las canciones de la demo se escribieron para esta demo, salvo "¡Santo! ¡Santo! ¡Santo!", que es de dominio público. Reemplázalas por el repertorio del ministerio, respetando las licencias de cada canción (por ejemplo, con CCLI).
