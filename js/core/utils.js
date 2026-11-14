/* =========================================================================
   SELAH · Utilidades: texto, fechas y DOM
   Las fechas se guardan como texto 'AAAA-MM-DD' y las horas como 'HH:MM'.
   ========================================================================= */
(function () {
  const U = {};

  U.uid = (prefix = 'x') => prefix + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);

  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  U.normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  U.initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  U.firstName = (name) => String(name || '').split(/\s+/)[0];

  U.hue = (str) => {
    let h = 0;
    for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  };

  U.debounce = (fn, ms = 200) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  U.plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  U.clone = (o) => JSON.parse(JSON.stringify(o));

  // ---- Fechas ----
  const pad = (n) => String(n).padStart(2, '0');
  U.ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
  U.parseYmd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  U.addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  U.today = () => U.ymd(new Date());
  U.diffDays = (a, b) => Math.round((U.parseYmd(b) - U.parseYmd(a)) / 86400000);

  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  U.DIAS = DIAS; U.DIAS_C = DIAS_C; U.MESES = MESES; U.MESES_C = MESES_C;

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  U.cap = cap;

  U.fmtDate = (s, style = 'long') => {
    const d = U.parseYmd(s);
    switch (style) {
      case 'long': return cap(`${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`);
      case 'full': return cap(`${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`);
      case 'short': return `${DIAS_C[d.getDay()]} ${d.getDate()} ${MESES_C[d.getMonth()]}`;
      case 'day': return String(d.getDate());
      case 'mon': return MESES_C[d.getMonth()];
      case 'weekday': return cap(DIAS_C[d.getDay()]);
      case 'month': return cap(`${MESES[d.getMonth()]} ${d.getFullYear()}`);
      default: return s;
    }
  };

  U.relDay = (s) => {
    const n = U.diffDays(U.today(), s);
    if (n === 0) return 'Hoy';
    if (n === 1) return 'Mañana';
    if (n === -1) return 'Ayer';
    if (n > 1 && n < 7) return `En ${n} días`;
    if (n >= 7 && n < 14) return 'La próxima semana';
    if (n >= 14) return `En ${Math.round(n / 7)} semanas`;
    return `Hace ${-n} días`;
  };

  U.fmtTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const fmt = (App.store && App.store.state && App.store.state.prefs && App.store.state.prefs.timeFormat) || '12h';
    if (fmt === '24h') return `${pad(h)}:${pad(m)}`;
    const suf = h >= 12 ? 'p. m.' : 'a. m.';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${pad(m)} ${suf}`;
  };

  U.fmtDuration = (sec) => {
    sec = Math.max(0, Math.round(sec || 0));
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${pad(s)}`;
  };

  U.fmtMinutes = (sec) => `${Math.round((sec || 0) / 60)} min`;

  U.greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  U.timeAgo = (ts) => {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return 'ahora';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    const d = new Date(ts);
    return `${d.getDate()} ${MESES_C[d.getMonth()]}`;
  };

  U.clockTime = (ts) => {
    const d = new Date(ts);
    return U.fmtTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  // ---- DOM ----
  U.copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  };

  U.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  App.utils = U;
})();
