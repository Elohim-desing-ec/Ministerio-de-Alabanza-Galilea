/* =========================================================================
   SELAH · Base de datos compartida (Supabase)
   - Inicio de sesión real (Supabase Auth). El usuario "byron" se guarda
     internamente como byron@<emailDomain>; nadie recibe correos.
   - Cada persona, canción, evento y mensaje es una fila en galilea_items.
   - Los cambios se envían solos y llegan en vivo a todos los celulares.
   - Se guarda una copia en el navegador para abrir rápido y sin conexión.
   Si config.supabase no tiene url/key, la app funciona solo en el navegador.
   ========================================================================= */
(function () {
  const U = App.utils;
  const cfg = App.config.supabase || {};
  const TABLE = 'galilea_items';
  const COLS = ['members', 'songs', 'events', 'messages', 'teams'];
  const PROFILE_KEY = 'selah-cloud-profile-v1';
  const SEP = '\u0000';

  let client = null;
  let channel = null;
  const snap = new Map();        // clave → JSON de lo último que sabemos que está en el servidor
  let pushing = false;
  let again = false;
  const listeners = new Set();

  const cloud = {
    enabled: !!(cfg.url && cfg.key && window.supabase && window.supabase.createClient),
    active: false,
    profile: null,
    profiles: [],
    status: 'idle',              // idle · ok · syncing · offline · error
    lastError: null
  };

  function setStatus(s, err) {
    cloud.status = s;
    cloud.lastError = err || null;
    listeners.forEach((fn) => { try { fn(s); } catch (e) { /* nada */ } });
  }
  cloud.onStatus = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

  function getClient() {
    if (!client) {
      client = window.supabase.createClient(cfg.url, cfg.key, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'selah-galilea-auth' }
      });
    }
    return client;
  }

  /** JSON con las claves ordenadas: la base de datos reordena las claves y así no hay falsos cambios. */
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }

  const emailOf = (usuario) => `${App.utils.normalize(usuario).replace(/\s+/g, '')}@${cfg.emailDomain}`;

  async function loadProfile() {
    const c = getClient();
    const { data: { user } } = await c.auth.getUser();
    if (!user) return null;
    const { data, error } = await c.from('galilea_perfiles').select('user_id, usuario, member_id, es_lider');
    if (error) throw error;
    cloud.profiles = data || [];
    const me = cloud.profiles.find((p) => p.user_id === user.id) || null;
    if (me) App.storage.save(PROFILE_KEY, me);
    return me;
  }

  /** Sesión guardada en este celular (si existe). Funciona sin conexión. */
  cloud.restore = async function restore() {
    if (!cloud.enabled) return null;
    const c = getClient();
    const { data: { session } } = await c.auth.getSession();
    if (!session) return null;
    try {
      cloud.profile = await loadProfile();
    } catch (e) {
      cloud.profile = App.storage.load(PROFILE_KEY); // sin conexión: último perfil conocido
      setStatus('offline');
    }
    return cloud.profile;
  };

  cloud.signIn = async function signIn(usuario, password) {
    const c = getClient();
    const { error } = await c.auth.signInWithPassword({ email: emailOf(usuario), password });
    if (error) {
      const offline = !navigator.onLine || /fetch|network/i.test(error.message || '');
      throw new Error(offline ? 'No hay conexión a internet. Conéctate para entrar.' : 'Usuario o contraseña incorrectos.');
    }
    const me = await loadProfile();
    if (!me) {
      await c.auth.signOut();
      throw new Error('Esta cuenta no pertenece al Ministerio de Alabanza Galilea.');
    }
    cloud.profile = me;
    return me;
  };

  cloud.signOut = async function signOut() {
    try { if (channel) await getClient().removeChannel(channel); } catch (e) { /* nada */ }
    try { await getClient().auth.signOut(); } catch (e) { /* nada */ }
    App.storage.remove(PROFILE_KEY);
    cloud.active = false;
  };

  // -------------------------------------------------------------------
  // Datos: estado ↔ filas
  // -------------------------------------------------------------------
  function rowsOf(state) {
    const map = new Map();
    COLS.forEach((col) => (state[col] || []).forEach((o) => { if (o && o.id) map.set(col + SEP + o.id, { coleccion: col, id: o.id, data: o }); }));
    map.set('settings' + SEP + 'main', { coleccion: 'settings', id: 'main', data: state.settings });
    return map;
  }

  /** Descarga todo y reemplaza los datos compartidos del estado. */
  cloud.pull = async function pull() {
    setStatus('syncing');
    const c = getClient();
    const all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await c.from(TABLE).select('coleccion, id, data').range(from, from + 999);
      if (error) { setStatus('error', error.message); throw error; }
      all.push(...data);
      if (data.length < 1000) break;
    }
    snap.clear();
    all.forEach((r) => snap.set(r.coleccion + SEP + r.id, canon(r.data)));

    App.store.update((s) => {
      COLS.forEach((col) => { s[col] = all.filter((r) => r.coleccion === col).map((r) => r.data); });
      const st = all.find((r) => r.coleccion === 'settings');
      if (st) s.settings = Object.assign({}, s.settings, st.data);
    }, { silent: true, remote: true });

    // Primera vez: el líder sube los datos iniciales (él mismo y el nombre del ministerio)
    if (!all.length && cloud.profile && cloud.profile.es_lider) {
      const seed = App.seed();
      App.store.update((s) => {
        s.members = seed.members.filter((m) => m.id === cloud.profile.member_id);
        if (!s.members.length) s.members = [{ id: cloud.profile.member_id, name: 'Líder', roles: ['director'], teams: [], phone: '', email: '', unavailable: [], leader: true, admin: true }];
        s.settings = seed.settings;
      }, { silent: true });
      await cloud.push();
    }
    setStatus('ok');
  };

  /** Envía al servidor solo lo que cambió. */
  cloud.push = async function push() {
    if (!cloud.enabled || !cloud.profile) return;
    if (pushing) { again = true; return; }
    pushing = true;
    try {
      const cur = rowsOf(App.store.state);
      const upserts = {};
      const deletes = {};
      cur.forEach((row, key) => {
        const j = canon(row.data);
        if (snap.get(key) !== j) (upserts[row.coleccion] = upserts[row.coleccion] || []).push({ key, j, row });
      });
      snap.forEach((j, key) => { if (!cur.has(key)) { const [col, id] = key.split(SEP); (deletes[col] = deletes[col] || []).push({ key, id }); } });
      if (!Object.keys(upserts).length && !Object.keys(deletes).length) { setStatus('ok'); return; }

      setStatus('syncing');
      const c = getClient();
      let firstError = null;
      const leader = !!(cloud.profile && cloud.profile.es_lider);
      // Por colección: si una no está permitida (p. ej. un músico), las demás igual se guardan.
      // Lo nuevo se crea (insert) y lo existente se actualiza (update): los músicos pueden
      // actualizar eventos pero no crearlos, y la base revisa un "upsert" como creación.
      for (const col of Object.keys(upserts)) {
        const list = upserts[col];
        const fresh = list.filter((u) => !snap.has(u.key));
        const known = list.filter((u) => snap.has(u.key));
        if (fresh.length) {
          const { error } = leader
            ? await c.from(TABLE).upsert(fresh.map((u) => u.row), { onConflict: 'coleccion,id' })
            : await c.from(TABLE).insert(fresh.map((u) => u.row));
          if (error) firstError = firstError || error; else fresh.forEach((u) => snap.set(u.key, u.j));
        }
        if (known.length && leader) {
          const { error } = await c.from(TABLE).upsert(known.map((u) => u.row), { onConflict: 'coleccion,id' });
          if (error) firstError = firstError || error; else known.forEach((u) => snap.set(u.key, u.j));
        } else {
          for (const u of known) {
            const { error } = await c.from(TABLE).update({ data: u.row.data }).eq('coleccion', u.row.coleccion).eq('id', u.row.id);
            if (error) firstError = firstError || error; else snap.set(u.key, u.j);
          }
        }
      }
      for (const col of Object.keys(deletes)) {
        const { error } = await c.from(TABLE).delete().eq('coleccion', col).in('id', deletes[col].map((d) => d.id));
        if (error) { firstError = firstError || error; continue; }
        deletes[col].forEach((d) => snap.delete(d.key));
      }
      if (firstError) throw firstError;
      setStatus('ok');
    } catch (err) {
      const offline = !navigator.onLine || /fetch|network/i.test((err && err.message) || '');
      setStatus(offline ? 'offline' : 'error', err && err.message);
      if (!offline) {
        App.ui.toast('No se pudo guardar un cambio en la base de datos. Se recargaron los datos del equipo.', { kind: 'warn', timeout: 6000 });
        try { await cloud.pull(); App.store.update(() => {}, { remote: true }); } catch (e) { /* nada */ }
      }
    } finally {
      pushing = false;
      if (again) { again = false; setTimeout(cloud.push, 50); }
    }
  };

  cloud.queuePush = U.debounce(() => cloud.push(), 400);

  /** Cambios de otras personas, en vivo. */
  cloud.startRealtime = function startRealtime() {
    const c = getClient();
    if (channel) c.removeChannel(channel);
    channel = c.channel('galilea-items')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        const row = payload.new && payload.new.coleccion ? payload.new : null;
        const old = payload.old || {};
        if (payload.eventType === 'DELETE') {
          const key = old.coleccion + SEP + old.id;
          if (!old.coleccion || !snap.has(key)) return;
          snap.delete(key);
          App.store.update((s) => { if (s[old.coleccion]) s[old.coleccion] = s[old.coleccion].filter((x) => x.id !== old.id); }, { remote: true });
          return;
        }
        if (!row) return;
        const key = row.coleccion + SEP + row.id;
        const j = canon(row.data);
        if (snap.get(key) === j) return; // es nuestro propio cambio
        snap.set(key, j);
        App.store.update((s) => {
          if (row.coleccion === 'settings') { s.settings = Object.assign({}, s.settings, row.data); return; }
          const list = s[row.coleccion] || (s[row.coleccion] = []);
          const i = list.findIndex((x) => x.id === row.id);
          if (i >= 0) list[i] = row.data; else list.push(row.data);
        }, { remote: true });
      })
      .subscribe((status) => {
        // Al (re)conectarse, ponerse al día con lo que pasó mientras tanto
        if (status === 'SUBSCRIBED') cloud.refresh();
      });
    cloud.active = true;

    if (!cloud._listening) {
      cloud._listening = true;
      window.addEventListener('online', () => cloud.refresh());
      window.addEventListener('offline', () => setStatus('offline'));
      // Los celulares duermen la conexión en segundo plano: al volver a la app, actualizar
      document.addEventListener('visibilitychange', () => { if (!document.hidden) cloud.refresh(); });
    }
  };

  /** Envía lo pendiente y trae lo último del servidor. */
  let refreshing = null;
  cloud.refresh = function refresh() {
    if (!cloud.profile) return Promise.resolve();
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        await cloud.push();
        await cloud.pull();
        App.store.update(() => {}, { remote: true });
      } catch (e) {
        setStatus(navigator.onLine ? 'error' : 'offline', e && e.message);
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  };

  // -------------------------------------------------------------------
  // Cuentas (las crea el líder mediante la función del servidor)
  // -------------------------------------------------------------------
  cloud.users = async function users(action, payload) {
    const c = getClient();
    const { data, error } = await c.functions.invoke(cfg.usersFunction, { body: Object.assign({ action }, payload) });
    if (error) {
      let msg = error.message;
      try { const body = await error.context.json(); if (body && body.error) msg = body.error; } catch (e) { /* nada */ }
      throw new Error(msg || 'No se pudo completar la acción.');
    }
    if (data && data.error) throw new Error(data.error);
    try { await loadProfile(); } catch (e) { /* nada */ }
    return data;
  };

  cloud.profileOf = (memberId) => cloud.profiles.find((p) => p.member_id === memberId) || null;

  App.cloud = cloud;
})();
