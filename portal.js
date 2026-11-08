'use strict';
/* =========================================================
   Refugio Joven · acceso de los chavales a «Mi Refugio»
   En la ficha: QR para escanear, código y botón de código nuevo.
   (Usa E, $, esc… de app.js)
   ========================================================= */

function enlaceMiRefugio(codigo) {
  const base = location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '');
  return `${base}mi.html#${codigo}`;
}
function codigoBonito(c) { return c ? `${c.slice(0, 4)}-${c.slice(4)}` : ''; }

function htmlQR(texto) {
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true });
  } catch (e) {
    return '<p class="resumen">No se ha podido dibujar el QR. Usa el código.</p>';
  }
}

function htmlCodigoFicha(c) {
  if (!c.codigo) return '';
  return `<details class="codigo-caja">
    <summary>📱 Su acceso a «Mi Refugio»</summary>
    <div class="columna" style="margin-top:10px">
      <p class="resumen">Que escanee el QR con la cámara de su móvil, o que entre en la web y escriba el código. Solo verá sus días, sus faltas y las listas de espera.</p>
      <div class="qr">${htmlQR(enlaceMiRefugio(c.codigo))}</div>
      <div class="codigo-grande mono">${esc(codigoBonito(c.codigo))}</div>
      <div class="fila-botones">
        <button type="button" class="btn btn-borde" id="cod-copiar">Copiar enlace</button>
        <button type="button" class="btn btn-peligro" id="cod-nuevo">Código nuevo</button>
      </div>
    </div>
  </details>`;
}

function enlazarCodigoFicha(c) {
  $('#cod-copiar')?.addEventListener('click', async () => {
    const t = `Tu acceso a Mi Refugio (Centro Joven): ${enlaceMiRefugio(c.codigo)}\nTu código: ${codigoBonito(c.codigo)}`;
    try { await navigator.clipboard.writeText(t); aviso('Enlace copiado'); }
    catch (e) { prompt('Copia este texto:', t); }
  });
  $('#cod-nuevo')?.addEventListener('click', async () => {
    if (!confirm(`¿Dar un código nuevo a ${c.nombre}? El anterior dejará de funcionar.`)) return;
    try {
      const { data, error } = await E.sb.rpc('cj_nuevo_codigo', { p_id: c.id });
      if (error) throw error;
      c.codigo = data;
      aviso('Código nuevo listo');
      abrirFicha(c.id);
      setTimeout(() => { const d = $('.codigo-caja'); if (d) d.open = true; }, 50);
    } catch (e) { aviso(errorHumano(e), true); }
  });
}
