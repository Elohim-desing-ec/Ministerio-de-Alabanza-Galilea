/* =========================================================================
   SELAH · Service worker: permite abrir la app sin internet.
   Estrategia: primero la red (siempre lo más nuevo) y, si no hay conexión,
   lo guardado. Las tipografías y el lector de PDF se guardan al usarse.
   ========================================================================= */
const CACHE = 'selah-galilea-v3';
const SHELL = [
  "./",
  "assets/icon-180.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon.svg",
  "css/animations.css",
  "css/base.css",
  "css/chart.css",
  "css/components.css",
  "css/glass.css",
  "css/layout.css",
  "css/tokens.css",
  "css/views/assistant.css",
  "css/views/calendar.css",
  "css/views/chat.css",
  "css/views/event.css",
  "css/views/home.css",
  "css/views/login.css",
  "css/views/settings.css",
  "css/views/songs.css",
  "css/views/stage.css",
  "css/views/team.css",
  "index.html",
  "js/ai/assistant.js",
  "js/ai/providers/claude.js",
  "js/ai/providers/gemini.js",
  "js/ai/providers/local.js",
  "js/ai/providers/openai.js",
  "js/app.js",
  "js/config.js",
  "js/core/actions.js",
  "js/core/auth.js",
  "js/core/chords.js",
  "js/core/importer.js",
  "js/core/model.js",
  "js/core/namespace.js",
  "js/core/rotation.js",
  "js/core/store.js",
  "js/core/utils.js",
  "js/data/seed.js",
  "js/ui/components.js",
  "js/ui/icons.js",
  "js/ui/import.js",
  "js/ui/login.js",
  "js/ui/markdown.js",
  "js/ui/pwa.js",
  "js/ui/stage.js",
  "js/views/assistant.js",
  "js/views/calendar.js",
  "js/views/chat.js",
  "js/views/event.js",
  "js/views/home.js",
  "js/views/settings.js",
  "js/views/song.js",
  "js/views/songs.js",
  "js/views/team.js",
  "manifest.webmanifest"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const allowed = sameOrigin || /fonts\.(googleapis|gstatic)\.com$|cdnjs\.cloudflare\.com$/.test(url.hostname);
  if (!allowed) return; // APIs de IA y otros servicios: siempre por red

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
