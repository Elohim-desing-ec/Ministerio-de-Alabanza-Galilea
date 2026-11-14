/* =========================================================================
   SELAH · Proveedor: cualquier API compatible con OpenAI
   Opciones gratuitas:
     · Groq        → https://console.groq.com/keys   (base: https://api.groq.com/openai/v1)
     · OpenRouter  → modelos ":free"                  (base: https://openrouter.ai/api/v1)
     · Ollama      → IA en tu propia computadora      (base: http://localhost:11434/v1, sin clave)
   La clave se guarda solo en este navegador.
   ========================================================================= */
(function () {
  const isLocal = (url) => /localhost|127\.0\.0\.1/.test(url || '');

  App.ai.register({
    id: 'openai',
    label: 'Groq / OpenRouter / Ollama',
    description: 'Cualquier servicio compatible con OpenAI. Groq y OpenRouter tienen planes gratis; Ollama corre en tu computadora.',
    async available(settings) {
      const o = settings.openai || {};
      return !!(o.baseUrl && o.model && (o.key || isLocal(o.baseUrl)));
    },
    async ask({ system, context, messages, text, onText, signal, settings }) {
      const { baseUrl, key, model } = settings.openai;
      const headers = { 'Content-Type': 'application/json' };
      if (key) headers.Authorization = `Bearer ${key}`;
      const turns = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
      turns.push({ role: 'user', content: text });
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          temperature: 0.6,
          messages: [{ role: 'system', content: `${system}${context ? '\n\nDATOS ACTUALES DE LA APP:\n' + context : ''}` }].concat(turns)
        }),
        signal
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`El servicio respondió ${res.status}. ${body.slice(0, 140)}`);
      }
      const data = await res.json();
      const out = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!out) throw new Error('El servicio no devolvió texto');
      if (onText) onText(out);
      return out;
    }
  });
})();
