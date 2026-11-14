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
          <section class="login-card" aria-labelledby="login-title">
            <span class="login-mark">${I('logo', 30)}</span>
            <div class="login-head">
              <span class="eyebrow">${esc(s.ministryName)}</span>
              <h1 class="login-title" id="login-title">${esc(s.churchName)}</h1>
              <p class="muted">Agenda, equipo, setlists y acordes del ministerio en un solo lugar.</p>
            </div>
            <form class="login-form" id="login-form" autocomplete="on" novalidate>
              <div class="field">
                <label class="field-label" for="lg-user">Usuario</label>
                <input class="input" id="lg-user" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required>
              </div>
              <div class="field">
                <label class="field-label" for="lg-pass">Contraseña</label>
                <div class="pw">
                  <input class="input" id="lg-pass" name="password" type="password" autocomplete="current-password" required>
                  <button class="pw-toggle" type="button" data-act="toggle" aria-controls="lg-pass">Mostrar</button>
                </div>
              </div>
              <p class="login-error" id="lg-error" role="alert" hidden></p>
              <button class="btn btn--primary login-btn" type="submit"><span class="lbl">Entrar</span> ${I('arrow-right', 16)}</button>
            </form>
            <p class="xsmall faint login-foot">${esc(App.config.appName)} · versión demo. ¿No tienes usuario? Pídeselo al líder de alabanza.</p>
          </section>
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
