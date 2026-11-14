/* =========================================================================
   SELAH · Markdown mínimo y seguro para respuestas del asistente
   Escapa todo el HTML primero y luego aplica negritas, listas, tablas…
   ========================================================================= */
(function () {
  const esc = App.utils.esc;

  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  function table(rows) {
    const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const body = rows.filter((r) => !/^\|?\s*:?-{2,}/.test(r));
    if (!body.length) return '';
    const [head, ...rest] = body;
    return `<div class="md-table"><table><thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rest.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  App.md = function md(src) {
    const lines = esc(src || '').split('\n');
    let html = '';
    let list = null;
    let para = [];
    let tbl = [];

    const flushPara = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>`; para = []; } };
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
    const flushTable = () => { if (tbl.length) { html += table(tbl); tbl = []; } };

    lines.forEach((line) => {
      const t = line.trim();
      if (/^\|.*\|$/.test(t)) { flushPara(); closeList(); tbl.push(t); return; }
      flushTable();
      let m;
      if ((m = /^#{1,4}\s+(.*)$/.exec(t))) { flushPara(); closeList(); html += `<h4>${inline(m[1])}</h4>`; return; }
      if ((m = /^[-*•]\s+(.*)$/.exec(t))) { flushPara(); if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; return; }
      if ((m = /^\d+[.)]\s+(.*)$/.exec(t))) { flushPara(); if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; return; }
      if ((m = /^&gt;\s?(.*)$/.exec(t))) { flushPara(); closeList(); html += `<blockquote>${inline(m[1])}</blockquote>`; return; }
      if (!t) { flushPara(); closeList(); return; }
      closeList();
      para.push(t);
    });
    flushTable(); flushPara(); closeList();
    return html;
  };
})();
