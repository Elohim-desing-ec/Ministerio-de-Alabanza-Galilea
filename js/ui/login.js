/* =========================================================================
   SELAH · Pantalla de inicio de sesión
   ========================================================================= */
(function () {
  const U = App.utils, I = App.icon, esc = U.esc;

  App.login = {
    show(onSuccess) {
      const root = document.getElementById('login-root');
      const s = App.store.state.settings;
      document.body.classList.add('is-locked');
      document.title = `Entrar · ${App.config.siteTitle}`;
      root.innerHTML = `
        <main class="login">
          <div class="login-bg" aria-hidden="true"><span class="login-glow login-glow--a"></span><span class="login-glow login-glow--b"></span></div>
          <div class="login-shell">
            <section class="login-hero" aria-label="${esc(s.ministryName)} ${esc(s.churchName)}">
              <span class="login-logo">${App.intro.MARK}</span>
              <div class="login-hero-text">
                <span class="login-eyebrow">${esc(s.ministryName)}</span>
                <h1 class="login-title">${esc(s.churchName)}</h1>
                <p class="login-lead">Agenda, equipo, setlists, acordes y ensayo del ministerio en un solo lugar.</p>
              </div>
              <ul class="login-feats">
                <li><span class="login-feat-icon">${I('calendar', 16)}</span><span><strong>Agenda y equipo</strong><span>Quién sirve, cuándo y en qué puesto.</span></span></li>
                <li><span class="login-feat-icon">${I('music', 16)}</span><span><strong>Setlists y acordes</strong><span>En el tono de cada servicio.</span></span></li>
                <li><span class="login-feat-icon">${I('headphones', 16)}</span><span><strong>Escuchar y ensayar</strong><span>Grabaciones, metrónomo y pistas.</span></span></li>
              </ul>
              <div class="login-wave" aria-hidden="true">${Array.from({ length: 40 }, (_, i) => `<i style="--i:${i};--h:${(0.25 + 0.75 * Math.abs(Math.sin(i * 0.42 + 0.3))).toFixed(2)}"></i>`).join('')}</div>
            </section>

            <section class="login-card" aria-labelledby="login-form-title">
              <div class="login-card-head">
                <h2 class="login-card-title" id="login-form-title">Bienvenido</h2>
                <p class="small muted">Entra con el usuario que te dio el líder de alabanza.</p>
              </div>
              <form class="login-form" id="login-form" autocomplete="on" novalidate>
                <div class="field">
                  <label class="field-label" for="lg-user">Usuario</label>
                  <div class="login-input">${I('users', 16)}<input class="input" id="lg-user" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required placeholder="tu usuario"></div>
                </div>
                <div class="field">
                  <label class="field-label" for="lg-pass">Contraseña</label>
                  <div class="pw login-input">${I('key', 16)}
                    <input class="input" id="lg-pass" name="password" type="password" autocomplete="current-password" required placeholder="••••••••">
                    <button class="pw-toggle" type="button" data-act="toggle" aria-controls="lg-pass">Mostrar</button>
                  </div>
                </div>
                <p class="login-error" id="lg-error" role="alert" hidden></p>
                <button class="btn btn--primary login-btn" type="submit"><span class="lbl">Entrar</span> ${I('arrow-right', 16)}</button>
              </form>
              <p class="xsmall faint login-foot">¿No tienes usuario? Pídeselo al líder de alabanza.<br>${esc(App.config.appName)} · ${esc(s.ministryName)} ${esc(s.churchName)}</p>
            </section>
          </div>
        </main>`;

      const form = root.querySelector('#login-form');
      const err = root.querySelector('#lg-error');
      const pass = root.querySelector('#lg-pass');
      const btn = form.querySelector('button[type="submit"]');
      setTimeout(() => root.querySelector('#lg-user').focus(), 50);

      root.querySelector('[data-act="toggle"]').addEventListener('click', (e) => {
        const show = pass.type === 'password';
        pass.type = show ? 'text' : 'password';
        e.currentTarget.textContent = show ? 'Ocultar' : 'Mostrar';
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.hidden = true;
        const fd = new FormData(form);
        if (!String(fd.get('username')).trim() || !fd.get('password')) {
          err.textContent = 'Escribe tu usuario y tu contraseña.';
          err.hidden = false;
          return;
        }
        btn.disabled = true;
        btn.querySelector('.lbl').textContent = 'Entrando…';
        let member = null;
        let message = 'Usuario o contraseña incorrectos. Revisa mayúsculas y espacios.';
        try { member = await App.auth.login(fd.get('username'), fd.get('password')); } catch (e2) { message = e2.message || message; }
        btn.disabled = false;
        btn.querySelector('.lbl').textContent = 'Entrar';
        if (!member) {
          err.textContent = message;
          err.hidden = false;
          pass.select();
          return;
        }
        root.innerHTML = '';
        document.body.classList.remove('is-locked');
        onSuccess(member);
      });
    }
  };
})();
