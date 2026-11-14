/* =========================================================================
   SELAH · Reproductor dentro de la app
   Una barra flotante que sigue sonando aunque cambies de pantalla.
   Reproduce YouTube, Spotify, SoundCloud, Deezer, Apple Music, Drive y
   archivos de audio. Con una lista (setlist) pasa sola a la siguiente
   en YouTube y en archivos de audio.
   Uso: App.player.play([{ url, title, sub }], índice)
   ========================================================================= */
(function () {
  const U = App.utils, I = App.icon, esc = U.esc, ui = App.ui;

  let el = null;
  let queue = [];
  let index = 0;
  let mini = false;
  let yt = null;          // reproductor de YouTube (API oficial)
  let ytApi = null;       // promesa de carga de la API

  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (ytApi) return ytApi;
    ytApi = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) try { prev(); } catch (e) { /* nada */ } resolve(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = () => { ytApi = null; reject(new Error('sin API')); };
      document.head.appendChild(s);
      setTimeout(() => reject(new Error('lento')), 6000);
    });
    return ytApi;
  }

  function ensure() {
    if (el) return el;
    el = document.createElement('section');
    el.className = 'player';
    el.setAttribute('aria-label', 'Reproductor');
    el.innerHTML = `
      <div class="pl-media" id="pl-media"></div>
      <div class="pl-bar">
        <span class="pl-art" id="pl-art"></span>
        <div class="pl-info">
          <span class="pl-title truncate" id="pl-title"></span>
          <span class="pl-sub truncate" id="pl-sub"></span>
        </div>
        <div class="pl-ctrl">
          <button class="pl-btn" data-pl="prev" aria-label="Anterior">${I('prev', 16)}</button>
          <button class="pl-btn" data-pl="next" aria-label="Siguiente">${I('next', 16)}</button>
          <button class="pl-btn" data-pl="size" aria-label="Minimizar" id="pl-size">${I('chevron-down', 18)}</button>
          <button class="pl-btn" data-pl="close" aria-label="Cerrar reproductor">${I('x', 16)}</button>
        </div>
      </div>
      <div class="pl-queue" id="pl-queue"></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', onClick);
    return el;
  }

  function onClick(e) {
    const q = e.target.closest('[data-pl-i]');
    if (q) { go(Number(q.dataset.plI)); return; }
    const b = e.target.closest('[data-pl]');
    if (!b) return;
    switch (b.dataset.pl) {
      case 'prev': go(index - 1); break;
      case 'next': go(index + 1); break;
      case 'size': setMini(!mini); break;
      case 'close': close(); break;
      case 'open': window.open(queue[index].url, '_blank', 'noopener'); break;
    }
  }

  function setMini(on) {
    mini = on;
    if (!el) return;
    el.classList.toggle('is-mini', mini);
    const b = el.querySelector('#pl-size');
    b.innerHTML = I(mini ? 'chevron-up' : 'chevron-down', 18);
    b.setAttribute('aria-label', mini ? 'Mostrar reproductor' : 'Minimizar');
  }

  function destroyMedia() {
    if (yt) { try { yt.destroy(); } catch (e) { /* nada */ } yt = null; }
    if (el) el.querySelector('#pl-media').innerHTML = '';
  }

  function iframe(src, h, cls = '') {
    return `<iframe class="pl-frame ${cls}" src="${esc(src)}" ${h ? `style="height:${h}px"` : ''} allow="autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture" allowfullscreen loading="eager" referrerpolicy="strict-origin-when-cross-origin" title="Reproductor"></iframe>`;
  }

  function mountYouTube(media, info) {
    media.innerHTML = '<div class="pl-video"><div id="pl-yt"></div></div>';
    const plain = () => {
      media.innerHTML = `<div class="pl-video">${iframe(`https://www.youtube-nocookie.com/embed/${info.id}?autoplay=1&playsinline=1&rel=0${info.start ? '&start=' + info.start : ''}`, 0, 'pl-frame--video')}</div>`;
    };
    loadYouTubeApi().then((YT) => {
      if (!media.querySelector('#pl-yt')) return; // ya cambió de canción
      yt = new YT.Player('pl-yt', {
        host: 'https://www.youtube-nocookie.com',
        videoId: info.id,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, start: info.start || 0 },
        events: {
          onStateChange: (ev) => { if (ev.data === 0 && index < queue.length - 1) go(index + 1); },
          onError: () => ui.toast('Este video no deja reproducirse fuera de YouTube.', { kind: 'warn', action: { label: 'Abrir', onClick: () => window.open(info.url, '_blank', 'noopener') } })
        }
      });
    }).catch(plain);
  }

  function mountMedia() {
    const item = queue[index];
    const info = App.media.parse(item.url);
    const media = el.querySelector('#pl-media');
    destroyMedia();
    media.dataset.kind = info ? info.kind : 'link';

    if (!info || !App.media.playable(info)) {
      media.innerHTML = `<div class="pl-ext"><p class="small muted">Este link no se puede reproducir dentro de la app.</p><button class="btn btn--ghost btn--sm" data-pl="open">${I('external', 14)} Abrir link</button></div>`;
      return;
    }
    if (info.kind === 'youtube' && info.id) { mountYouTube(media, info); return; }
    if (info.kind === 'audio') {
      media.innerHTML = `<div class="pl-audio"><audio controls autoplay preload="auto" src="${esc(info.src)}"></audio></div>`;
      const a = media.querySelector('audio');
      a.addEventListener('ended', () => { if (index < queue.length - 1) go(index + 1); });
      a.addEventListener('error', () => ui.toast('No se pudo abrir este audio. Revisa que el link sea público.', { kind: 'warn' }));
      return;
    }
    if (info.kind === 'video') {
      media.innerHTML = `<div class="pl-video"><video controls autoplay playsinline src="${esc(info.src)}"></video></div>`;
      media.querySelector('video').addEventListener('ended', () => { if (index < queue.length - 1) go(index + 1); });
      return;
    }
    const isVideo = info.kind === 'youtube';
    media.innerHTML = isVideo ? `<div class="pl-video">${iframe(info.embed, 0, 'pl-frame--video')}</div>` : iframe(info.embed, info.height || 152);
  }

  function paintInfo() {
    const item = queue[index];
    const info = App.media.parse(item.url);
    const t = item.title || App.media.cachedTitle(item.url) || App.media.fallbackTitle(info);
    el.querySelector('#pl-art').innerHTML = App.media.thumb(info, 'sm');
    el.querySelector('#pl-title').textContent = t;
    el.querySelector('#pl-sub').innerHTML = `${App.media.badge(info)}${item.sub ? ` <span>${esc(item.sub)}</span>` : ''}${queue.length > 1 ? ` <span class="mono">${index + 1}/${queue.length}</span>` : ''}`;
    el.querySelector('[data-pl="prev"]').disabled = index === 0;
    el.querySelector('[data-pl="next"]').disabled = index >= queue.length - 1;
    el.classList.toggle('has-queue', queue.length > 1);
    el.querySelector('#pl-queue').innerHTML = queue.length > 1 ? queue.map((q, i) => {
      const qi = App.media.parse(q.url);
      return `<button class="pl-q ${i === index ? 'is-on' : ''}" data-pl-i="${i}"><span class="mono xsmall faint">${i + 1}</span>${App.media.thumb(qi, 'sm')}<span class="grow truncate">${esc(q.title || App.media.cachedTitle(q.url) || App.media.fallbackTitle(qi))}</span>${i === index ? I('wave', 14) : ''}</button>`;
    }).join('') : '';
    if (!item.title && info) App.media.title(info).then((tt) => { if (tt && queue[index] === item) el.querySelector('#pl-title').textContent = tt; });
  }

  function go(i) {
    if (!queue.length) return;
    index = Math.max(0, Math.min(queue.length - 1, i));
    paintInfo();
    mountMedia();
  }

  function play(items, start = 0) {
    queue = (items || []).filter((x) => x && x.url);
    if (!queue.length) { ui.toast('No hay links para escuchar todavía.', { kind: 'info' }); return; }
    ensure();
    document.body.classList.add('has-player');
    el.classList.remove('is-leaving');
    setMini(false);
    go(start);
  }

  function close() {
    if (!el) return;
    destroyMedia();
    document.body.classList.remove('has-player');
    el.remove();
    el = null;
    queue = [];
  }

  /** Convierte un link guardado en un elemento de la lista. */
  function itemOf(link, extra = {}) {
    const song = link.songId ? App.model.song(link.songId) : null;
    const who = link.memberId ? App.model.member(link.memberId) : null;
    return Object.assign({
      url: link.url,
      title: link.title || (song ? song.title : ''),
      sub: [song && link.title ? song.title : '', who ? `de ${U.firstName(who.name)}` : ''].filter(Boolean).join(' · ')
    }, extra);
  }

  /** Abre una ventana para pegar un link (con título automático). */
  function askLink({ title = 'Compartir alabanza', songs = null, songId = null, notifyLabel = null, onSave }) {
    const m = ui.modal({
      title,
      body: `
        <form class="stack" autocomplete="off">
          <div class="field">
            <label class="field-label" for="lk-url">Link</label>
            <input class="input" id="lk-url" name="url" inputmode="url" placeholder="Pega el link de YouTube, Spotify, SoundCloud, Drive…" required>
            <span class="field-hint" id="lk-hint">Se escucha aquí mismo, sin salir de la app.</span>
          </div>
          <div class="lk-preview" id="lk-preview" hidden></div>
          <div class="field">
            <label class="field-label" for="lk-title">Título (opcional)</label>
            <input class="input" id="lk-title" name="title" placeholder="Se completa solo con YouTube, Spotify y SoundCloud">
          </div>
          ${songs ? `<div class="field">
            <label class="field-label" for="lk-song">¿De qué canción es?</label>
            <select class="select" id="lk-song" name="songId"><option value="">Otra / general</option>${songs.map((s) => `<option value="${esc(s.id)}" ${s.id === songId ? 'selected' : ''}>${esc(s.title)}</option>`).join('')}</select>
          </div>` : ''}
          ${notifyLabel ? `<label class="check"><input type="checkbox" name="notify" checked> <span>${esc(notifyLabel)}</span></label>` : ''}
        </form>`,
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        {
          label: 'Guardar', kind: 'primary', icon: 'check',
          onClick: (api) => {
            const f = api.body.querySelector('form');
            const d = Object.fromEntries(new FormData(f).entries());
            const info = App.media.parse(d.url);
            if (!info) { api.body.querySelector('#lk-hint').textContent = 'Eso no parece un link. Cópialo completo desde la app o el navegador.'; api.body.querySelector('#lk-hint').classList.add('bad-text'); return false; }
            onSave({ url: info.url, title: d.title.trim(), songId: songs ? (d.songId || null) : songId, notify: !!d.notify }, info);
          }
        }
      ]
    });
    const url = m.body.querySelector('#lk-url');
    const tt = m.body.querySelector('#lk-title');
    const prev = m.body.querySelector('#lk-preview');
    let touched = false;
    tt.addEventListener('input', () => { touched = true; });
    url.addEventListener('input', U.debounce(() => {
      const info = App.media.parse(url.value);
      if (!info) { prev.hidden = true; return; }
      prev.hidden = false;
      prev.innerHTML = `${App.media.thumb(info)}<span class="grow stack-sm"><span class="strong small truncate">${esc(App.media.cachedTitle(info.url) || App.media.fallbackTitle(info))}</span>${App.media.badge(info)}${App.media.playable(info) ? '' : '<span class="xsmall faint">Se abrirá en otra pestaña</span>'}</span>`;
      App.media.title(info).then((t) => {
        if (!t) return;
        if (!touched) tt.value = t;
        const s = prev.querySelector('.strong');
        if (s) s.textContent = t;
      });
    }, 250));
    return m;
  }

  App.player = { play, close, itemOf, askLink, get active() { return !!el; } };
})();
