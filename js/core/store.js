/* =========================================================================
   SELAH · Estado y persistencia
   App.storage es el ÚNICO punto que sabe dónde se guardan los datos.
   Hoy usa localStorage (cada navegador tiene su copia). Para que todo el
   equipo comparta los mismos datos, reemplaza load/save por llamadas a un
   backend (Supabase, Firebase, tu propia API) sin tocar el resto de la app.
   ========================================================================= */
(function () {
  const SCHEMA = 1;

  App.storage = {
    load(key) {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
    },
    save(key, data) {
      try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch (e) { return false; }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) { /* sin acceso a almacenamiento */ }
    }
  };

  const listeners = new Set();
  let state = null;

  const persist = () => App.storage.save(App.config.storageKey, state);
  const saveSoon = App.utils.debounce(persist, 250);

  function emit(meta) {
    Array.from(listeners).forEach((fn) => { try { fn(state, meta); } catch (e) { console.error(e); } });
  }

  function valid(data) {
    return data && data.version === SCHEMA && Array.isArray(data.members) && Array.isArray(data.events) && Array.isArray(data.songs);
  }

  const store = {
    SCHEMA,
    get state() { return state; },

    init() {
      const saved = App.storage.load(App.config.storageKey);
      state = valid(saved) ? saved : App.seed();
      state.prefs = Object.assign({ notation: 'letras', timeFormat: '12h', theme: 'dark' }, state.prefs || {});
      persist();
      return state;
    },

    all(col) { return state[col] || []; },
    byId(col, id) { return (state[col] || []).find((x) => x.id === id) || null; },

    /** Cambia el estado con una función y avisa a la interfaz. */
    update(mutator, opts = {}) {
      mutator(state);
      saveSoon();
      if (!opts.silent) emit(opts);
    },

    upsert(col, obj, opts) {
      store.update((s) => {
        const list = s[col] || (s[col] = []);
        const i = list.findIndex((x) => x.id === obj.id);
        if (i >= 0) list[i] = Object.assign({}, list[i], obj); else list.push(obj);
      }, opts);
      return obj;
    },

    remove(col, id) {
      store.update((s) => { s[col] = (s[col] || []).filter((x) => x.id !== id); });
    },

    setPref(key, value) {
      store.update((s) => { s.prefs[key] = value; });
    },

    reset() {
      state = App.seed();
      state.prefs = { notation: 'letras', timeFormat: '12h', theme: 'dark' };
      persist();
      emit({ reset: true });
    },

    loadDemo() {
      state = App.seed({ demo: true });
      persist();
      emit({ reset: true });
    },

    replace(data) {
      if (!valid(data)) throw new Error('El archivo no tiene el formato de Selah (versión, miembros, canciones y eventos).');
      state = data;
      persist();
      emit({ reset: true });
    },

    export() { return JSON.stringify(state, null, 2); },

    on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };

  App.store = store;
})();
