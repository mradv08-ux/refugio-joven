'use strict';
/* =========================================================
   Mi Refugio · portal de solo lectura para los chavales
   Entran con su código personal. No tocan nada: solo miran.
   ========================================================= */

const CFG = window.CJ_CONFIG;
const $ = (s, r = document) => r.querySelector(s);
const CLAVE = 'cj-mi-codigo';
let codigo = '';
let datos = null;
let temporizador;

/* ---------- Utilidades ---------- */
function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function limpiar(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); }
function bonito(c) { return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c; }
function minutosDesde(ts) { return Math.max(0, Math.floor((Date.now() - new Date(ts)) / 60000)); }
function duracion(min) { return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`; }
function fechaCorta(iso) { const [, m, d] = iso.split('-'); return `${d}/${m}`; }
function guardar(c) { try { c ? localStorage.setItem(CLAVE, c) : localStorage.removeItem(CLAVE); } catch (e) { /* nada */ } }
function leer() { try { return localStorage.getItem(CLAVE) || ''; } catch (e) { return ''; } }
function mostrar(id) { ['#m-carga', '#m-login', '#m-app'].forEach(s => $(s).classList.toggle('oculto', s !== id)); }

/* ---------- Pedir mis datos ---------- */
async function pedir(c) {
  const r = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/cj_portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: `Bearer ${CFG.supabaseKey}` },
    body: JSON.stringify({ p_codigo: c })
  });
  if (!r.ok) throw new Error('red');
  return r.json();
}

async function entrar(c, silencioso = false) {
  if (!silencioso) mostrar('#m-carga');
  $('#m-carga-error').classList.add('oculto');
  try {
    const d = await pedir(c);
    if (!d) {
      guardar('');
      mostrar('#m-login');
      $('#m-msg').textContent = 'Ese código no existe o ya no vale. Pide uno nuevo en recepción.';
      return;
    }
    codigo = c; datos = d; guardar(c);
    pintar();
    mostrar('#m-app');
  } catch (e) {
    if (silencioso) return;
    $('#m-carga-error').classList.remove('oculto');
  }
}

/* ---------- Pintar ---------- */
function pintar() {
  const d = datos;
  $('#m-nombre').textContent = `Hola, ${d.nombre.split(' ')[0]} 👋`;

  // Comportamiento
  const r = { leve: 0, moderada: 0, grave: 0 };
  d.faltas.forEach(f => r[f.gravedad]++);
  let est;
  if (r.grave) est = { c: 'var(--grave)', e: '🔴', t: 'Tienes faltas graves', s: 'Habla con el equipo para arreglarlo.' };
  else if (r.moderada) est = { c: 'var(--flame)', e: '🟠', t: 'Cuidado con el comportamiento', s: `Tienes ${r.moderada} falta${r.moderada > 1 ? 's' : ''} moderada${r.moderada > 1 ? 's' : ''}${r.leve ? ` y ${r.leve} leve${r.leve > 1 ? 's' : ''}` : ''}.` };
  else if (r.leve) est = { c: 'var(--flame-hi)', e: '🟡', t: 'Vas bien, pero ojo', s: `Tienes ${r.leve} falta${r.leve > 1 ? 's' : ''} leve${r.leve > 1 ? 's' : ''}.` };
  else est = { c: 'var(--green)', e: '🟢', t: 'Te estás portando de lujo', s: 'Sin faltas. Así sí, superviviente. 🔥' };
  $('#m-estado').innerHTML = `
    <div class="estado-caja" style="--c:${est.c}"><span class="emoji">${est.e}</span><div><b>${esc(est.t)}</b><span>${esc(est.s)}</span></div></div>
    <div class="dias">
      <div class="stat"><span class="mono">${d.dias_mes}</span><small>Días este mes</small></div>
      <div class="stat"><span class="mono">${d.dias_total}</span><small>Días en total</small></div>
    </div>`;

  // Lo mío ahora: jugando o esperando
  const yo = [];
  d.juegos.forEach(j => {
    if (j.uso && j.uso.yo) {
      yo.push(`<div class="yo-item jugando"><span class="ico">${j.icono}</span>
        <div><div class="grande">Estás jugando</div><span class="meta">${esc(j.nombre)}${j.uso.yo_responsable ? ' · eres el responsable 🔑' : ''}</span></div>
        <span class="num">⏱ ${duracion(minutosDesde(j.uso.desde))}</span></div>`);
    }
    const mia = j.espera.find(e => e.yo);
    if (mia) {
      const delante = mia.pos - 1;
      yo.push(`<div class="yo-item"><span class="ico">${j.icono}</span>
        <div><div class="grande">${esc(j.nombre)}</div><span class="meta">${delante ? `${delante} grupo${delante > 1 ? 's' : ''} delante` : (j.uso ? '¡Eres el siguiente!' : '¡Te toca! Ve a recepción')}</span></div>
        <span class="num">nº ${mia.pos}</span></div>`);
    }
  });
  $('#m-yo').innerHTML = yo.length ? `<div class="yo-caja">${yo.join('')}</div>` : '';

  // Todos los juegos
  $('#m-juegos').innerHTML = d.juegos.map(j => {
    const esp = j.espera.length;
    let clase = 'libre', estado = '● Libre', crono = '';
    if (j.uso) {
      const min = minutosDesde(j.uso.desde);
      const pasado = j.limite && esp && min >= j.limite;
      clase = pasado ? 'pasado' : 'ocupado';
      estado = pasado ? '⏱ Tiempo cumplido' : '● Ocupado';
      crono = `<span class="crono">${duracion(min)}${j.limite ? ` <small class="resumen">/ ${duracion(j.limite)}</small>` : ''}</span>`;
    }
    const mio = (j.uso && j.uso.yo) || j.espera.some(e => e.yo);
    return `<div class="juego ${clase} ${mio ? 'mio' : ''}">
      <div class="juego-cab"><span class="ico">${j.icono}</span><span class="tit">${esc(j.nombre)}</span>
        <div style="text-align:right"><div class="estado">${estado}</div>${crono}</div></div>
      ${j.uso ? `<span class="resumen">Juega: ${j.uso.yo ? '<b>tú y tu grupo</b>' : `${esc(j.uso.responsable)}${j.uso.personas > 1 ? ` y ${j.uso.personas - 1} más` : ''}`}</span>` : ''}
      ${esp ? `<ol class="cola">${j.espera.map(e => `<li class="${e.yo ? 'yo' : ''}"><span class="pos">${e.pos}</span>
          <span>${e.yo ? 'Tú' + (e.personas > 1 ? ` y ${e.personas - 1} más` : '') : `${esc(e.responsable)}${e.personas > 1 ? ` +${e.personas - 1}` : ''}`}</span>
          <small>${duracion(minutosDesde(e.desde))}</small></li>`).join('')}</ol>`
        : `<p class="sin-cola">${j.uso ? 'Nadie esperando' : 'Libre: pídelo en recepción'}</p>`}
    </div>`;
  }).join('');

  // Mis faltas
  $('#m-faltas').innerHTML = d.faltas.length ? `
    <h2 class="seccion">Mis faltas <span class="mono">(${d.faltas.length})</span></h2>
    <div class="lista">${d.faltas.map(f => `<div class="falta" style="--c:var(--${f.gravedad})">
      <div class="info"><span class="meta"><span class="pildora p-${f.gravedad}">${f.gravedad}</span> ${fechaCorta(f.fecha)}</span>
      <p>${esc(f.motivo)}</p></div></div>`).join('')}</div>` : '';
}

/* ---------- Pase con QR ---------- */
function abrirPase() {
  if (!codigo || !datos) return;
  const base = location.href.split('#')[0].split('?')[0];
  let svg = '';
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(`${base}#${codigo}`);
    qr.make();
    svg = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
  } catch (e) {
    svg = '<p>No se ha podido dibujar el QR. Di tu código en recepción.</p>';
  }
  $('#m-pase-qr').innerHTML = svg;
  $('#m-pase-nombre').textContent = datos.nombre;
  $('#m-pase-cod').textContent = bonito(codigo);
  $('#m-pase').classList.remove('oculto');
}
$('#m-pase-btn').addEventListener('click', abrirPase);
$('#m-pase-cerrar').addEventListener('click', () => $('#m-pase').classList.add('oculto'));

/* ---------- Eventos ---------- */
$('#m-codigo').addEventListener('input', ev => {
  const c = limpiar(ev.target.value);
  ev.target.value = bonito(c);
});
$('#m-form').addEventListener('submit', ev => {
  ev.preventDefault();
  const c = limpiar($('#m-codigo').value);
  if (c.length !== 8) { $('#m-msg').textContent = 'El código tiene 8 letras y números.'; return; }
  entrar(c);
});
$('#m-reintentar').addEventListener('click', () => entrar(codigo || leer()));
$('#m-refrescar').addEventListener('click', () => entrar(codigo, true));
$('#m-salir').addEventListener('click', () => {
  if (!confirm('¿Salir? Necesitarás tu código para volver a entrar.')) return;
  guardar(''); codigo = ''; datos = null;
  $('#m-codigo').value = ''; $('#m-msg').textContent = '';
  mostrar('#m-login');
});

// Se actualiza solo cada 20 s y al volver a la app
clearInterval(temporizador);
temporizador = setInterval(() => { if (!document.hidden && codigo) entrar(codigo, true); }, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && codigo) entrar(codigo, true); });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
}

/* ---------- Arranque ---------- */
(function () {
  // El QR de recepción trae el código tras la # (no viaja al servidor)
  const deQR = limpiar(decodeURIComponent(location.hash.slice(1)));
  if (location.hash) history.replaceState(null, '', location.pathname);
  const c = deQR.length === 8 ? deQR : leer();
  if (c) entrar(c); else mostrar('#m-login');
})();
