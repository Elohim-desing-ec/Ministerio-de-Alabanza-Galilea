/* =========================================================================
   SELAH · App instalable (PWA)
   La página se instala en el celular o la computadora como una app:
   ícono propio, pantalla completa y funciona sin internet.
   No pasa por Google Play ni App Store.
   ========================================================================= */
(function () {
  const ui = App.ui, I = App.icon;
  let deferred = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    ui.toast('App instalada. Ya la tienes en tu pantalla de inicio.');
  });

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const steps = (list) => `<ol class="install-steps">${list.map((s) => `<li>${s}</li>`).join('')}</ol>`;

  async function install() {
    if (isStandalone()) { ui.toast('Ya estás usando la app instalada.'); return; }
    if (deferred) {
      deferred.prompt();
      const choice = await deferred.userChoice.catch(() => ({}));
      deferred = null;
      if (choice.outcome !== 'accepted') ui.toast('Puedes instalarla cuando quieras desde Ajustes.', { kind: 'info' });
      return;
    }
    ui.modal({
      title: 'Instalar la app',
      body: isIOS()
        ? `<p class="small muted">En iPhone o iPad:</p>${steps([
            'Abre esta página en <strong>Safari</strong>.',
            `Toca el botón <strong>Compartir</strong> ${I('arrow-up', 14)} (el cuadro con la flecha).`,
            'Elige <strong>Agregar a inicio</strong>.',
            'Toca <strong>Agregar</strong>. El ícono de Galilea aparece en tu pantalla.'
          ])}`
        : `<p class="small muted">En Android (Chrome) o en la computadora (Chrome o Edge):</p>${steps([
            `Abre el menú del navegador ${I('more', 14)}.`,
            'Toca <strong>Instalar app</strong> o <strong>Agregar a la pantalla principal</strong>.',
            'Confirma. La app se abre como cualquier otra, sin la barra del navegador.'
          ])}`,
      actions: [{ label: 'Entendido', kind: 'primary' }]
    });
  }

  function register() {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin conexión */ });
    }
  }

  App.pwa = { install, isStandalone, isIOS, register };
})();
