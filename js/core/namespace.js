/* =========================================================================
   SELAH · Espacio de nombres global
   Cada archivo se registra dentro de window.App. Así la app funciona
   abriendo index.html directamente (sin servidor ni compilación) y cada
   módulo puede reemplazarse o ampliarse sin tocar los demás.

   App.config     → configuración (puestos, tipos de evento, IA…)
   App.utils      → utilidades (fechas, texto, DOM)
   App.storage    → adaptador de guardado (localStorage por defecto)
   App.store      → estado de la app + suscripciones
   App.model      → consultas sobre los datos (quién sirve, conflictos…)
   App.actions    → cambios sobre los datos (asignar, confirmar, setlist…)
   App.chords     → motor de acordes (parseo, transposición, notación)
   App.rotation   → motor de rotación justa del equipo
   App.ui         → componentes (modal, toast, avatar…)
   App.views      → pantallas registradas por nombre de ruta
   App.forms      → formularios reutilizables
   App.ai         → asistente con proveedores intercambiables
   ========================================================================= */
window.App = window.App || {
  config: {},
  utils: {},
  views: {},
  forms: {},
  ui: {},
  viewState: {},
  ai: { providers: {} }
};
