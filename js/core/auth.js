/* =========================================================================
   SELAH · Acceso (versión demo, sin base de datos)
   - El líder principal está definido en config.js (App.config.auth.users).
   - El líder puede crear cuentas para cada persona desde Equipo.
   - Las contraseñas se guardan como huella SHA-256, nunca en texto.

   IMPORTANTE: esto es una puerta de demostración, no seguridad real.
   Sin servidor, todo se verifica en el navegador y las cuentas creadas
   viven solo en el navegador donde se crearon. El paso siguiente es
   conectar una base de datos con inicio de sesión real (por ejemplo,
   Supabase Auth) y reemplazar este archivo.
   ========================================================================= */
(function () {
  const SESSION_KEY = 'selah-session-v1';
  const MAX_AGE = 30 * 24 * 3600 * 1000; // 30 días

  // ---- SHA-256 (usa crypto.subtle; si no existe, una versión en JS) ----
  function sha256Fallback(ascii) {
    const rrot = (v, a) => (v >>> a) | (v << (32 - a));
    const maxWord = 2 ** 32;
    const words = [];
    const bitLen = ascii.length * 8;
    const hash = [];
    const k = [];
    const composite = {};
    for (let c = 2, n = 0; n < 64; c++) {
      if (!composite[c]) {
        for (let i = 0; i < 313; i += c) composite[i] = c;
        hash[n] = (Math.pow(c, 0.5) * maxWord) | 0;
        k[n++] = (Math.pow(c, 1 / 3) * maxWord) | 0;
      }
    }
    let str = ascii + '\x80';
    while ((str.length % 64) - 56) str += '\x00';
    for (let i = 0; i < str.length; i++) words[i >> 2] |= str.charCodeAt(i) << (((3 - i) % 4) * 8);
    words[words.length] = (bitLen / maxWord) | 0;
    words[words.length] = bitLen;
    let H = hash.slice(0, 8);
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, (j += 16));
      const old = H;
      H = H.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = H[0], e = H[4];
        const t1 = H[7] + (rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25)) + ((e & H[5]) ^ (~e & H[6])) + k[i] +
          (w[i] = i < 16 ? w[i] : (w[i - 16] + (rrot(w15, 7) ^ rrot(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rrot(w2, 17) ^ rrot(w2, 19) ^ (w2 >>> 10))) | 0);
        const t2 = (rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22)) + ((a & H[1]) ^ (a & H[2]) ^ (H[1] & H[2]));
        H = [(t1 + t2) | 0].concat(H);
        H[4] = (H[4] + t1) | 0;
        H.length = 8;
      }
      for (let i = 0; i < 8; i++) H[i] = (H[i] + old[i]) | 0;
    }
    let out = '';
    for (let i = 0; i < 8; i++) for (let j = 3; j + 1; j--) { const b = (H[i] >> (j * 8)) & 255; out += (b < 16 ? '0' : '') + b.toString(16); }
    return out;
  }

  async function sha256(text) {
    const utf8 = unescape(encodeURIComponent(text));
    try {
      if (window.crypto && crypto.subtle && window.isSecureContext) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) { /* usa la versión en JS */ }
    return sha256Fallback(utf8);
  }

  const normUser = (u) => App.utils.normalize(u).replace(/\s+/g, '');
  const normFixedPass = (p) => String(p || '').toLowerCase().replace(/\s+/g, '');

  /** Huella para cuentas creadas por el líder (distingue mayúsculas). */
  const accountHash = (username, password) => sha256(`selah:${normUser(username)}:${password}`);

  function readSession() {
    const s = App.storage.load(SESSION_KEY);
    if (!s || !s.memberId || Date.now() - (s.at || 0) > MAX_AGE) return null;
    return s;
  }

  const auth = {
    sha256,
    accountHash,
    normUser,

    current() {
      const s = readSession();
      if (!s) return null;
      if (!App.store.state.members.some((m) => m.id === s.memberId)) return null;
      return s;
    },

    /** Devuelve el miembro si las credenciales son correctas; si no, null. */
    async login(username, password) {
      const u = normUser(username);
      if (!u || !password) return null;
      let memberId = null;

      const fixed = (App.config.auth.users || []).find((x) => x.username === u);
      if (fixed && (await sha256(`selah:${normFixedPass(password)}`)) === fixed.passwordHash) memberId = fixed.memberId;

      if (!memberId) {
        const m = App.store.state.members.find((x) => x.account && x.account.username === u);
        if (m && (await accountHash(u, password)) === m.account.passwordHash) memberId = m.id;
      }

      const member = memberId && App.store.state.members.find((x) => x.id === memberId);
      if (!member) return null;
      App.storage.save(SESSION_KEY, { memberId: member.id, username: u, at: Date.now() });
      App.store.update((s) => { s.session.userId = member.id; }, { silent: true });
      return member;
    },

    logout() {
      App.storage.remove(SESSION_KEY);
      location.hash = '';
      location.reload();
    },

    /** ¿El usuario ya está en uso? (por otra persona o por un líder fijo) */
    usernameTaken(username, exceptMemberId) {
      const u = normUser(username);
      if ((App.config.auth.users || []).some((x) => x.username === u && x.memberId !== exceptMemberId)) return true;
      return App.store.state.members.some((m) => m.id !== exceptMemberId && m.account && m.account.username === u);
    },

    /** ¿Esta persona tiene una cuenta fija definida en config.js? */
    fixedAccount(memberId) {
      return (App.config.auth.users || []).find((x) => x.memberId === memberId) || null;
    }
  };

  App.auth = auth;
})();
