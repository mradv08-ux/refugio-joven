'use strict';
/* =========================================================
   Refugio Joven · Escáner de QR en la puerta
   Lee el QR de «Mi Refugio» de cada chaval y le apunta la entrada.
   Se queda abierto para ir pasando uno detrás de otro.
   (Usa E, $, esc, registrarEntrada… de app.js)
   ========================================================= */

const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';

// Carga el lector de QR solo cuando hace falta
function cargarLector() {
  if (window.jsQR) return Promise.resolve();
  return new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = JSQR_URL;
    s.onload = () => ok();
    s.onerror = () => mal(new Error('No se pudo cargar el lector'));
    document.head.appendChild(s);
  });
}

// Saca el código de lo que trae el QR (enlace con #CODIGO o el código a secas)
function codigoDeQR(texto) {
  const t = String(texto || '').trim();
  const trasAlmohadilla = t.includes('#') ? t.split('#').pop() : t;
  const c = trasAlmohadilla.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 8 ? c : null;
}

async function abrirEscaner() {
  abrirModal('📷 Escanear entrada', `
    <div class="escaner">
      <video id="esc-video" playsinline muted autoplay></video>
      <div class="esc-marco" aria-hidden="true"></div>
      <div class="esc-flash" id="esc-flash" aria-hidden="true"></div>
    </div>
    <p class="resumen centro-txt" id="esc-estado">Abriendo la cámara…</p>
    <p class="resumen centro-txt">Que el chaval abra <b>Mi Refugio</b> y enseñe su pase. Si no lo ve bien, que suba el brillo.</p>
    <div id="esc-lista" class="lista"></div>
    <button class="btn btn-borde btn-grande" data-cerrar>Terminar</button>`);

  const video = $('#esc-video');
  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  let flujo = null, activo = true, ultimo = 0;
  const vistos = new Map();       // código → hora del último escaneo (evita repetir)
  window.alCerrarModal = () => {
    activo = false;
    if (flujo) flujo.getTracks().forEach(t => t.stop());
  };

  const estado = (t) => { const e = $('#esc-estado'); if (e) e.innerHTML = t; };
  const flash = (ok) => {
    const f = $('#esc-flash'); if (!f) return;
    f.className = 'esc-flash ' + (ok ? 'ok' : 'mal');
    setTimeout(() => { f.className = 'esc-flash'; }, 450);
  };
  const apuntarLista = (html) => {
    const l = $('#esc-lista'); if (!l) return;
    l.insertAdjacentHTML('afterbegin', html);
    while (l.children.length > 6) l.lastElementChild.remove();
  };

  try {
    await cargarLector();
    flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    if (!activo) { flujo.getTracks().forEach(t => t.stop()); return; }
    video.srcObject = flujo;
    await video.play();
    estado('Apunta al QR del chaval');
  } catch (e) {
    const sinPermiso = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
    estado(sinPermiso
      ? '⚠️ La app no tiene permiso para usar la cámara. Actívalo en los ajustes del navegador y vuelve a intentarlo.'
      : '⚠️ No se ha podido abrir la cámara o el lector. Revisa la cobertura y vuelve a intentarlo.');
    return;
  }

  const leer = async () => {
    if (!activo) return;
    requestAnimationFrame(leer);
    const ahora = Date.now();
    if (ahora - ultimo < 180 || video.readyState < 2) return;   // ~5 lecturas por segundo
    ultimo = ahora;
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return;
    const escala = Math.min(1, 640 / Math.max(w, h));
    lienzo.width = Math.round(w * escala); lienzo.height = Math.round(h * escala);
    ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
    const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
    const qr = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    if (!qr) return;
    const cod = codigoDeQR(qr.data);
    if (!cod) return;
    if (vistos.has(cod) && ahora - vistos.get(cod) < 6000) return;   // el mismo QR, ignorado unos segundos
    vistos.set(cod, ahora);
    await procesar(cod);
  };

  const procesar = async (cod) => {
    let c = E.chavales.find(x => x.codigo === cod);
    if (!c) { await refrescar(true); c = E.chavales.find(x => x.codigo === cod); }   // por si lo dio de alta otro móvil
    if (!c) {
      flash(false); vibrar(200);
      apuntarLista(`<div class="esc-item mal">❓ QR no reconocido. Puede que sea un código antiguo: dale uno nuevo desde su ficha.</div>`);
      return;
    }
    const yaDentro = E.entradas.some(e => e.chaval_id === c.id && e.fecha === E.diaPuerta);
    const r = resumenFaltas(c.id);
    if (yaDentro) {
      flash(true); vibrar(40);
      apuntarLista(`<div class="esc-item">↩️ <b>${esc(c.nombre)}</b> ya estaba dentro</div>`);
      return;
    }
    await registrarEntrada(c.id);
    flash(!r.grave);
    apuntarLista(`<div class="esc-item ${r.grave ? 'aviso' : 'ok'}">✅ <b>${esc(c.nombre)}</b> · ${c.edad} años ${pildorasFaltas(c.id)}
      ${r.grave ? `<br>🚨 Tiene ${r.grave} falta${r.grave > 1 ? 's' : ''} grave${r.grave > 1 ? 's' : ''}` : ''}</div>`);
    const n = E.entradas.filter(e => e.fecha === E.diaPuerta).length;
    estado(`Apunta al siguiente · <b class="mono">${n}</b> dentro`);
  };

  requestAnimationFrame(leer);
}
