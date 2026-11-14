/* =========================================================================
   SELAH · Proveedor: Claude
   Disponible cuando la app se abre publicada en claude.ai: usa la cuenta
   de Claude de quien la está viendo, sin claves ni costo adicional.
   Fuera de claude.ai (archivo local, tu hosting) simplemente no aparece.
   ========================================================================= */
(function () {
  let ns = null;
  let pending = null;

  function getSample() {
    if (ns) return Promise.resolve(ns);
    if (!window.claude || typeof window.claude.use !== 'function') return Promise.resolve(null);
    if (!pending) {
      pending = Promise.resolve(window.claude.use('sample'))
        .then((x) => { ns = x || null; return ns; })
        .catch(() => null)
        .finally(() => { pending = null; });
    }
    return pending;
  }

  App.ai.register({
    id: 'claude',
    label: 'Claude',
    description: 'Solo funciona si la app se abre dentro de claude.ai. En la página web normal usa Gemini, Groq o el motor local.',
    async available() { return !!(await getSample()); },
    async ask({ system, context, messages, text, onText, signal }) {
      const sample = await getSample();
      if (!sample) throw new Error('Claude no está disponible en esta página');
      const prior = messages.slice(0, -1).slice(-6);
      while (prior.length && prior[0].role !== 'user') prior.shift();
      const input = prior.concat([{
        role: 'user',
        content: `${system}\n\n=== DATOS ACTUALES DE LA APP ===\n${context}\n\n=== MENSAJE DEL USUARIO ===\n${text}`
      }]);
      try {
        const res = await sample(input, { onText: onText ? ({ text: t }) => onText(t) : undefined, signal, cache: false });
        return res.text;
      } catch (err) {
        if (err && err.code === 'not_granted') ns = null;
        const e = new Error((err && (err.message || err.code)) || 'Claude no respondió');
        if (err && err.name === 'AbortError') e.name = 'AbortError';
        throw e;
      }
    }
  });
})();
