/* =========================================================================
   SELAH · Proveedor: Google Gemini (nivel gratuito)
   1. Entra a https://aistudio.google.com/apikey y crea una clave gratis.
   2. Pégala en Ajustes → Asistente de IA.
   La clave se guarda solo en este navegador. Funciona al abrir la app
   desde tu computadora o tu propio hosting.
   ========================================================================= */
(function () {
  App.ai.register({
    id: 'gemini',
    label: 'Gemini',
    description: 'Clave gratuita de Google AI Studio. Funciona al abrir la app desde tu computadora o tu hosting.',
    async available(settings) { return !!(settings.gemini && settings.gemini.key); },
    async ask({ system, context, messages, text, onText, signal, settings }) {
      const { key, model } = settings.gemini;
      const url = `${App.config.ai.gemini.endpoint}/${encodeURIComponent(model)}:generateContent`;
      const contents = messages.slice(0, -1).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      while (contents.length && contents[0].role !== 'user') contents.shift();
      contents.push({ role: 'user', parts: [{ text: `${context ? 'DATOS ACTUALES DE LA APP:\n' + context + '\n\n' : ''}MENSAJE:\n${text}` }] });

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: 0.6 } }),
        signal
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Gemini respondió ${res.status}. ${body.slice(0, 140)}`);
      }
      const data = await res.json();
      const out = ((data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || []).map((p) => p.text || '').join('');
      if (!out) throw new Error('Gemini no devolvió texto');
      if (onText) onText(out);
      return out;
    }
  });
})();
