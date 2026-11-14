/* =========================================================================
   SELAH · Links de música
   Reconoce links de YouTube, YouTube Music, Spotify, SoundCloud, Deezer,
   Apple Music, Google Drive, Dropbox y archivos de audio/video, y arma
   el reproductor que se usa dentro de la app (App.player).
   No se descarga ni se guarda audio: solo se guarda el link.
   ========================================================================= */
(function () {
  const PLATFORMS = {
    youtube:    { label: 'YouTube',     color: '#FF3B3B' },
    spotify:    { label: 'Spotify',     color: '#1ED760' },
    soundcloud: { label: 'SoundCloud',  color: '#FF7A1A' },
    deezer:     { label: 'Deezer',      color: '#A238FF' },
    apple:      { label: 'Apple Music', color: '#FA4E6E' },
    drive:      { label: 'Google Drive', color: '#4C8BF5' },
    audio:      { label: 'Audio',       color: '#5EE7F0' },
    video:      { label: 'Video',       color: '#8B8CFF' },
    link:       { label: 'Link',        color: '#A1A7B8' }
  };

  const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|wav|flac|opus)(\?|#|$)/i;
  const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

  function toUrl(raw) {
    let s = String(raw || '').trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) {
      if (/^(www\.|m\.|music\.|open\.|youtu|soundcloud|deezer|drive\.)/i.test(s)) s = 'https://' + s;
      else return null;
    }
    try { return new URL(s); } catch (e) { return null; }
  }

  /** Devuelve la información del link o null si no es un link. */
  function parse(raw) {
    const u = toUrl(raw);
    if (!u) return null;
    const host = u.hostname.replace(/^(www|m)\./, '');
    const path = u.pathname;
    const href = u.href;
    let m;

    // ---- YouTube / YouTube Music ----
    if (/(^|\.)youtube\.com$|^youtube-nocookie\.com$|^youtu\.be$/.test(host)) {
      let id = null;
      if (host === 'youtu.be') id = path.slice(1).split('/')[0];
      else if ((m = /^\/(?:shorts|live|embed|v)\/([\w-]{6,})/.exec(path))) id = m[1];
      else id = u.searchParams.get('v');
      const list = u.searchParams.get('list');
      if (id && /^[\w-]{6,20}$/.test(id)) {
        const start = parseInt(u.searchParams.get('t') || u.searchParams.get('start') || '0', 10) || 0;
        return { url: href, kind: 'youtube', id, start, thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` };
      }
      if (list) return { url: href, kind: 'youtube', list, embed: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}&autoplay=1&playsinline=1` };
    }

    // ---- Spotify ----
    if (host === 'open.spotify.com' && (m = /^\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/.exec(path))) {
      return { url: href, kind: 'spotify', id: m[2], type: m[1], embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0`, height: m[1] === 'track' || m[1] === 'episode' ? 152 : 352 };
    }

    // ---- SoundCloud ----
    if (/(^|\.)soundcloud\.com$/.test(host) && path.length > 1) {
      return { url: href, kind: 'soundcloud', embed: `https://w.soundcloud.com/player/?url=${encodeURIComponent(href)}&color=%235b5bf7&auto_play=true&hide_related=true&show_comments=false&show_reposts=false&visual=false`, height: 166 };
    }

    // ---- Deezer ----
    if (/(^|\.)deezer\.com$/.test(host) && (m = /\/(track|album|playlist)\/(\d+)/.exec(path))) {
      return { url: href, kind: 'deezer', id: m[2], embed: `https://widget.deezer.com/widget/dark/${m[1]}/${m[2]}?autoplay=true`, height: m[1] === 'track' ? 150 : 300 };
    }

    // ---- Apple Music ----
    if (host === 'music.apple.com') {
      return { url: href, kind: 'apple', embed: href.replace('://music.apple.com', '://embed.music.apple.com'), height: u.searchParams.get('i') ? 175 : 450 };
    }

    // ---- Google Drive (archivo compartido) ----
    if (host === 'drive.google.com') {
      const id = ((m = /\/file\/d\/([\w-]+)/.exec(path)) && m[1]) || u.searchParams.get('id');
      if (id) return { url: href, kind: 'drive', id, embed: `https://drive.google.com/file/d/${id}/preview`, height: 120 };
    }

    // ---- Dropbox: enlace directo al archivo ----
    if (/(^|\.)dropbox\.com$/.test(host) && (AUDIO_EXT.test(path) || VIDEO_EXT.test(path))) {
      const direct = new URL(href);
      direct.searchParams.delete('dl');
      direct.searchParams.set('raw', '1');
      return { url: href, kind: AUDIO_EXT.test(path) ? 'audio' : 'video', src: direct.href };
    }

    // ---- Archivos de audio o video ----
    if (AUDIO_EXT.test(path)) return { url: href, kind: 'audio', src: href };
    if (VIDEO_EXT.test(path)) return { url: href, kind: 'video', src: href };

    return { url: href, kind: 'link' };
  }

  /** ¿Se puede escuchar dentro de la app? */
  const playable = (info) => !!info && info.kind !== 'link';

  const platform = (kind) => PLATFORMS[kind] || PLATFORMS.link;

  /** Links dentro de un texto (para el chat). */
  function findLinks(text) {
    const out = [];
    const re = /\bhttps?:\/\/[^\s<>"']+|\b(?:www\.|youtu\.be\/|open\.spotify\.com\/|soundcloud\.com\/)[^\s<>"']+/gi;
    let m;
    while ((m = re.exec(String(text || '')))) out.push(m[0].replace(/[),.;!?]+$/, ''));
    return out;
  }

  // ---- Título automático (oEmbed oficial de cada plataforma) ----
  const TITLE_KEY = 'selah-media-titles-v1';
  let titles = null;
  const pending = new Map();
  const loadTitles = () => { if (!titles) titles = App.storage.load(TITLE_KEY) || {}; return titles; };
  const cachedTitle = (url) => loadTitles()[url] || null;

  function title(info) {
    if (!info) return Promise.resolve(null);
    const cached = cachedTitle(info.url);
    if (cached) return Promise.resolve(cached);
    if (pending.has(info.url)) return pending.get(info.url);
    const ep = info.kind === 'youtube' ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(info.url)}`
      : info.kind === 'spotify' ? `https://open.spotify.com/oembed?url=${encodeURIComponent(info.url)}`
      : info.kind === 'soundcloud' ? `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(info.url)}`
      : null;
    if (!ep) return Promise.resolve(null);
    const p = fetch(ep).then((r) => (r.ok ? r.json() : null)).then((d) => {
      const t = d && d.title ? String(d.title).slice(0, 140) : null;
      if (t) {
        const all = loadTitles();
        all[info.url] = t;
        const keys = Object.keys(all);
        if (keys.length > 300) keys.slice(0, keys.length - 300).forEach((k) => delete all[k]);
        App.storage.save(TITLE_KEY, all);
      }
      return t;
    }).catch(() => null).finally(() => pending.delete(info.url));
    pending.set(info.url, p);
    return p;
  }

  /** Nombre corto para mostrar cuando todavía no hay título. */
  function fallbackTitle(info) {
    if (!info) return 'Link';
    if (info.kind === 'audio' || info.kind === 'video') {
      const name = decodeURIComponent(info.url.split('?')[0].split('/').pop() || '');
      return name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ') || platform(info.kind).label;
    }
    return platform(info.kind).label;
  }

  /** Miniatura: imagen de YouTube o un bloque de color con la plataforma. */
  function thumb(info, size = 'md') {
    const esc = App.utils.esc;
    const p = platform(info && info.kind);
    if (info && info.thumb) return `<span class="m-thumb m-thumb--${size}" style="--pc:${p.color}"><img src="${esc(info.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`;
    return `<span class="m-thumb m-thumb--${size} m-thumb--plain" style="--pc:${p.color}">${App.icon(info && info.kind === 'link' ? 'link' : 'headphones', size === 'sm' ? 14 : 18)}</span>`;
  }

  const badge = (info) => {
    const p = platform(info && info.kind);
    return `<span class="m-badge" style="--pc:${p.color}">${App.utils.esc(p.label)}</span>`;
  };

  App.media = { parse, playable, platform, findLinks, title, cachedTitle, fallbackTitle, thumb, badge, PLATFORMS };
})();
