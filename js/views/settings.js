/* =========================================================================
   SELAH · Vista: Ajustes
   (La ruta se llama "ajustes" porque claude.ai reserva "settings".)
   ========================================================================= */
(function () {
  const U = App.utils, M = App.model, ui = App.ui, I = App.icon, esc = U.esc;
  const AI = App.ai;

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#F6F4F4' : '#060507');
  }
  App.applyTheme = applyTheme;

  App.views.ajustes = {
    title: 'Ajustes',
    render(root) {
      const s = App.store.state;
      const ai = AI.settings();
      const leader = M.isLeader();
      const provs = [
        ['auto', 'Automático', 'Usa el mejor disponible: Claude en claude.ai, luego tus claves, y si no hay ninguna, el motor local.'],
        ['claude', AI.providers.claude.label, AI.providers.claude.description],
        ['gemini', AI.providers.gemini.label, AI.providers.gemini.description],
        ['openai', AI.providers.openai.label, AI.providers.openai.description],
        ['local', AI.providers.local.label, AI.providers.local.description]
      ];

      root.innerHTML = `
        <div class="view view--settings">
          <header class="view-head">
            <div class="titles">
              <span class="eyebrow">${esc(App.config.appName)} ${esc(App.config.version)}</span>
              <h1 class="view-title">Ajustes</h1>
            </div>
          </header>

          <div class="settings-grid">
            <section class="panel">
              <h2 class="panel-title">${I('home', 16)} Iglesia</h2>
              <div class="field"><label class="field-label" for="set-church">Nombre de la iglesia</label><input class="input" id="set-church" value="${esc(s.settings.churchName)}" ${leader ? '' : 'disabled'}></div>
              <div class="field"><label class="field-label" for="set-ministry">Nombre del ministerio</label><input class="input" id="set-ministry" value="${esc(s.settings.ministryName)}" ${leader ? '' : 'disabled'}></div>
              ${leader ? '' : '<p class="field-hint">Solo los líderes pueden cambiar estos datos.</p>'}
            </section>

            <section class="panel">
              <h2 class="panel-title">${I('sun', 16)} Apariencia</h2>
              <div class="field"><span class="field-label">Tema</span>
                <div class="seg" role="group" aria-label="Tema">
                  ${[['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => `<button class="${s.prefs.theme === v ? 'is-on' : ''}" data-pref="theme" data-val="${v}">${l}</button>`).join('')}
                </div></div>
              <div class="field"><span class="field-label">Notación de acordes</span>
                <div class="seg" role="group" aria-label="Notación">
                  ${[['letras', 'C D E'], ['latino', 'Do Re Mi'], ['numeros', '1 2 3']].map(([v, l]) => `<button class="${s.prefs.notation === v ? 'is-on' : ''}" data-pref="notation" data-val="${v}">${l}</button>`).join('')}
                </div></div>
              <div class="field"><span class="field-label">Formato de hora</span>
                <div class="seg" role="group" aria-label="Formato de hora">
                  ${[['12h', '7:30 p. m.'], ['24h', '19:30']].map(([v, l]) => `<button class="${s.prefs.timeFormat === v ? 'is-on' : ''}" data-pref="timeFormat" data-val="${v}">${l}</button>`).join('')}
                </div></div>
            </section>

            <section class="panel settings-ai">
              <h2 class="panel-title">${I('sparkle', 16)} Asistente de IA</h2>
              <p class="small muted">Todas las opciones son gratuitas. Las claves se guardan solo en este navegador y no se incluyen al exportar los datos.</p>
              <div class="prov-list" role="radiogroup" aria-label="Proveedor de IA">
                ${provs.map(([id, label, desc]) => `
                  <label class="prov ${ai.provider === id ? 'is-on' : ''}">
                    <input type="radio" name="ai-provider" value="${id}" ${ai.provider === id ? 'checked' : ''}>
                    <span class="grow"><span class="strong">${esc(label)}</span><span class="xsmall muted" style="display:block">${esc(desc)}</span></span>
                    ${['claude', 'gemini', 'openai', 'local'].includes(id) ? `<button type="button" class="btn btn--plain btn--sm" data-test="${id}">Probar</button>` : ''}
                  </label>`).join('')}
              </div>

              <details class="prov-config" ${ai.gemini.key ? 'open' : ''}>
                <summary>Configurar Gemini</summary>
                <div class="field-row">
                  <div class="field"><label class="field-label" for="g-key">Clave de API</label><input class="input mono" id="g-key" type="password" autocomplete="off" placeholder="AIza…" value="${esc(ai.gemini.key)}"></div>
                  <div class="field"><label class="field-label" for="g-model">Modelo</label><input class="input mono" id="g-model" value="${esc(ai.gemini.model)}"></div>
                </div>
                <p class="field-hint">Crea una clave gratis en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>. Si el modelo cambia de nombre, actualízalo aquí.</p>
              </details>

              <details class="prov-config" ${ai.openai.key ? 'open' : ''}>
                <summary>Configurar Groq, OpenRouter u Ollama</summary>
                <div class="field"><label class="field-label" for="o-base">Dirección base</label><input class="input mono" id="o-base" value="${esc(ai.openai.baseUrl)}"></div>
                <div class="field-row">
                  <div class="field"><label class="field-label" for="o-key">Clave de API</label><input class="input mono" id="o-key" type="password" autocomplete="off" placeholder="gsk_… (vacío para Ollama)" value="${esc(ai.openai.key)}"></div>
                  <div class="field"><label class="field-label" for="o-model">Modelo</label><input class="input mono" id="o-model" value="${esc(ai.openai.model)}"></div>
                </div>
                <div class="chip-row">
                  <button type="button" class="chip" data-preset="groq">Groq</button>
                  <button type="button" class="chip" data-preset="openrouter">OpenRouter</button>
                  <button type="button" class="chip" data-preset="ollama">Ollama local</button>
                </div>
                <p class="field-hint">Groq: clave gratis en <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a>. Ollama corre en tu computadora sin clave.</p>
              </details>
              <div class="row"><button class="btn btn--primary btn--sm" data-act="save-ai">${I('check', 14)} Guardar configuración de IA</button><span class="xsmall faint" id="ai-test-out"></span></div>
              <div class="notice">${I('bell', 16)}<span>Sin clave, el asistente usa el motor local (gratis y sin internet). Con una clave gratuita de Gemini o Groq puede conversar con libertad. Cada persona configura su clave en su propio navegador.</span></div>
            </section>

            <section class="panel">
              <h2 class="panel-title">${I('key', 16)} Sesión</h2>
              <p class="small muted">Entraste como <strong>${esc((M.member((App.auth.current() || {}).memberId) || M.me()).name)}</strong>${App.auth.current() ? ` con el usuario <span class="mono">${esc(App.auth.current().username)}</span>` : ''}.</p>
              ${leader ? '<p class="small muted">Para crear el usuario y la contraseña de cada persona, ve a <a href="#equipo">Equipo</a>, abre a la persona y pulsa Editar.</p>' : ''}
              <div class="row"><button class="btn btn--danger btn--sm" data-act="logout">${I('arrow-right', 14)} Cerrar sesión</button></div>
            </section>

            <section class="panel">
              <h2 class="panel-title">${I('copy', 16)} Datos</h2>
              <p class="small muted">En esta demo los datos viven en este navegador. Para compartirlos con todo el equipo en tiempo real, conecta un servidor (ver README).</p>
              <div class="row">
                <button class="btn btn--ghost btn--sm" data-act="export">${I('copy', 14)} Copiar respaldo</button>
                <button class="btn btn--ghost btn--sm" data-act="import">${I('arrow-down', 14)} Restaurar respaldo</button>
                <button class="btn btn--danger btn--sm" data-act="reset">${I('refresh', 14)} Restablecer demo</button>
              </div>
              <dl class="dl small">
                <dt>Personas</dt><dd class="mono">${s.members.length}</dd>
                <dt>Canciones</dt><dd class="mono">${s.songs.length}</dd>
                <dt>Eventos</dt><dd class="mono">${s.events.length}</dd>
                <dt>Mensajes</dt><dd class="mono">${s.messages.length}</dd>
              </dl>
            </section>
          </div>
        </div>`;

      const saveSettings = U.debounce(() => {
        App.store.update((st) => {
          st.settings.churchName = root.querySelector('#set-church').value.trim() || App.config.churchName;
          st.settings.ministryName = root.querySelector('#set-ministry').value.trim() || App.config.ministryName;
        }, { silent: true });
        App.app.renderShell();
      }, 400);
      root.querySelector('#set-church').addEventListener('input', saveSettings);
      root.querySelector('#set-ministry').addEventListener('input', saveSettings);

      const readAI = () => ({
        provider: (root.querySelector('input[name="ai-provider"]:checked') || {}).value || 'auto',
        gemini: { key: root.querySelector('#g-key').value.trim(), model: root.querySelector('#g-model').value.trim() || App.config.ai.gemini.model },
        openai: { baseUrl: root.querySelector('#o-base').value.trim(), key: root.querySelector('#o-key').value.trim(), model: root.querySelector('#o-model').value.trim() }
      });

      root.addEventListener('change', (e) => {
        if (e.target.name === 'ai-provider') {
          root.querySelectorAll('.prov').forEach((l) => l.classList.toggle('is-on', l.contains(e.target)));
          AI.saveSettings(readAI());
        }
      });

      root.addEventListener('click', async (e) => {
        const pref = e.target.closest('[data-pref]');
        if (pref) {
          App.store.setPref(pref.dataset.pref, pref.dataset.val);
          if (pref.dataset.pref === 'theme') applyTheme(pref.dataset.val);
          return;
        }
        const preset = e.target.closest('[data-preset]');
        if (preset) {
          const P = {
            groq: ['https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile'],
            openrouter: ['https://openrouter.ai/api/v1', 'meta-llama/llama-3.3-70b-instruct:free'],
            ollama: ['http://localhost:11434/v1', 'llama3.2']
          }[preset.dataset.preset];
          root.querySelector('#o-base').value = P[0];
          root.querySelector('#o-model').value = P[1];
          return;
        }
        const test = e.target.closest('[data-test]');
        if (test) {
          e.preventDefault();
          AI.saveSettings(readAI());
          const out = root.querySelector('#ai-test-out');
          out.textContent = `Probando ${AI.providers[test.dataset.test].label}…`;
          try {
            await AI.test(test.dataset.test);
            out.textContent = `${AI.providers[test.dataset.test].label} responde correctamente.`;
            ui.toast('Conexión correcta.');
          } catch (err) {
            out.textContent = `${AI.providers[test.dataset.test].label}: ${err.message}`;
            ui.toast('No se pudo conectar. Revisa la clave o el modelo.', { kind: 'warn' });
          }
          return;
        }
        const act = e.target.closest('[data-act]');
        if (!act) return;
        switch (act.dataset.act) {
          case 'logout':
            App.auth.logout();
            break;
          case 'save-ai':
            AI.saveSettings(readAI());
            ui.toast('Configuración de IA guardada.');
            break;
          case 'export': {
            const json = App.store.export();
            const ok = await U.copy(json);
            if (ok) ui.toast('Respaldo copiado. Pégalo en un archivo de texto para guardarlo.');
            else ui.modal({ title: 'Respaldo de datos', size: 'lg', body: `<p class="small muted">Selecciona todo el texto y cópialo.</p><textarea class="textarea textarea--code" readonly>${esc(json)}</textarea>`, actions: [{ label: 'Cerrar', kind: 'ghost' }] });
            break;
          }
          case 'import':
            ui.modal({
              title: 'Restaurar respaldo',
              size: 'lg',
              body: '<p class="small muted">Pega aquí el texto de un respaldo. Reemplazará todos los datos de este navegador.</p><label class="sr-only" for="imp-json">Respaldo</label><textarea class="textarea textarea--code" id="imp-json" placeholder="{ &quot;version&quot;: 1, … }"></textarea>',
              actions: [
                { label: 'Cancelar', kind: 'ghost' },
                {
                  label: 'Restaurar', kind: 'primary', onClick: (m) => {
                    try { App.store.replace(JSON.parse(m.body.querySelector('#imp-json').value)); ui.toast('Datos restaurados.'); }
                    catch (err) { ui.toast(err.message.startsWith('El archivo') ? err.message : 'El texto no es un respaldo válido.', { kind: 'warn' }); return false; }
                  }
                }
              ]
            });
            break;
          case 'reset': {
            const ok = await ui.confirm({ title: 'Restablecer la demo', message: 'Se borrarán los cambios hechos en este navegador y volverán los datos de ejemplo.', confirmLabel: 'Restablecer', danger: true });
            if (ok) { App.store.reset(); applyTheme('system'); ui.toast('Demo restablecida.'); App.router.go('inicio'); }
            break;
          }
        }
      });
    }
  };
})();
