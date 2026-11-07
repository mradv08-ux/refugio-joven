'use strict';
/* =========================================================
   Refugio Joven · Control de acceso del Centro Joven
   San Juan del Puerto · by The Wild Side
   ========================================================= */

const CFG = window.CJ_CONFIG;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- Estado ---------- */
const E = {
  sb: null,
  usuario: null,       // { email, nombre }
  equipo: [],          // [{ email, nombre, color }]
  chavales: [],        // [{ id, nombre, edad, notas, creado }]
  entradas: [],        // [{ id, chaval_id, fecha, hora, registrado_por }]
  faltas: [],          // [{ id, chaval_id, fecha, gravedad, motivo, puesta_por }]
  turnos: [],          // [{ fecha, email }]
  vista: 'puerta',
  diaPuerta: null,     // 'AAAA-MM-DD'
  mesTurnos: null,     // { a, m } (m de 0 a 11)
  orden: 'nombre',
  material: [],        // [{ id, nombre, icono, orden }]
  usos: []             // [{ id, material_id, responsable_id, grupo, fecha, inicio, fin, devolucion, nota, falta_id, ... }]
};

/* ---------- Utilidades ---------- */
function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Fecha de hoy en Madrid como 'AAAA-MM-DD'
function hoyISO() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: CFG.zonaHoraria });
}
function aFecha(iso) { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d, 12); }
function aISO(f) { return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`; }
function sumarDias(iso, n) { const f = aFecha(iso); f.setDate(f.getDate() + n); return aISO(f); }
function abre(iso) { return CFG.diasApertura.includes(aFecha(iso).getDay()); }
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fechaLarga(iso) { const f = aFecha(iso); return `${f.getDate()} de ${MESES[f.getMonth()]}`; }
function fechaCorta(iso) { const f = aFecha(iso); return `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}`; }
function horaDe(ts) { return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: CFG.zonaHoraria }); }
function euros(n) { return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
// Normaliza nombres para comparar: sin tildes, minúsculas y espacios simples
function normal(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
// Pone en mayúscula la primera letra de cada palabra
function capitalizar(t) {
  return String(t || '').replace(/\s+/g, ' ').trim().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}
function inicial(n) { return esc((n || '?').trim().charAt(0).toUpperCase()); }

let toastTimer;
function aviso(texto, error = false) {
  const t = $('#toast');
  t.textContent = texto;
  t.classList.toggle('error', error);
  t.classList.add('ver');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('ver'), 2600);
}
function vibrar(ms = 30) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* nada */ } }

// Traduce errores técnicos a lenguaje normal
function errorHumano(err) {
  const m = String(err?.message || err || '');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'No hay conexión. Revisa la cobertura y vuelve a intentarlo.';
  if (/Invalid login/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(m)) return 'Tienes que confirmar el correo primero (mira tu bandeja de entrada).';
  if (err?.code === '23505' || /duplicate key/i.test(m)) return 'Ya existe un registro igual.';
  if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso para hacer esto.';
  return 'Algo ha fallado. Vuelve a intentarlo.';
}

/* ---------- Pantallas ---------- */
function mostrar(id) {
  ['#pantalla-carga', '#pantalla-login', '#pantalla-nueva-pass', '#pantalla-sin-acceso', '#app']
    .forEach(s => $(s).classList.toggle('oculto', s !== id));
}

/* ---------- Arranque ---------- */
let vigilante;
async function iniciar() {
  mostrar('#pantalla-carga');
  clearTimeout(vigilante);
  vigilante = setTimeout(() => {
    if (!$('#pantalla-carga').classList.contains('oculto')) falloCarga('Está tardando demasiado. Revisa la cobertura y pulsa Reintentar.');
  }, 15000);
  $('#carga-error').classList.add('oculto');
  if (!window.supabase) return falloCarga('No se ha podido cargar la app. Revisa la cobertura y vuelve a intentarlo.');
  if (!E.sb) {
    E.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
      auth: { storageKey: 'cj-refugio-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    E.sb.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') mostrar('#pantalla-nueva-pass');
      if (evento === 'SIGNED_OUT') { E.usuario = null; mostrar('#pantalla-login'); }
    });
  }
  try {
    const { data } = await E.sb.auth.getSession();
    if (location.hash.includes('type=recovery')) return mostrar('#pantalla-nueva-pass');
    if (!data.session) return mostrar('#pantalla-login');
    await entrarConSesion(data.session);
  } catch (e) {
    falloCarga(errorHumano(e));
  }
}
function falloCarga(texto) {
  $('#carga-error-texto').textContent = texto;
  $('#carga-error').classList.remove('oculto');
}

async function entrarConSesion(sesion) {
  mostrar('#pantalla-carga');
  const email = (sesion.user.email || '').toLowerCase();
  const { data, error } = await E.sb.from('cj_equipo').select('email,nombre,color').order('nombre');
  if (error) throw error;
  E.equipo = data || [];
  const yo = E.equipo.find(p => p.email.toLowerCase() === email);
  if (!yo) {
    $('#sin-acceso-email').textContent = email;
    return mostrar('#pantalla-sin-acceso');
  }
  E.usuario = yo;
  $('#cab-usuario').textContent = `Hola, ${yo.nombre} · Centro Joven San Juan del Puerto`;
  await cargarDatos();
  E.diaPuerta = elegirDiaInicial();
  const h = aFecha(hoyISO());
  E.mesTurnos = { a: h.getFullYear(), m: h.getMonth() };
  mostrar('#app');
  moverMes(0);
  pintarTodo();
}

// Si hoy no se abre, muestra el último día de apertura
function elegirDiaInicial() {
  let d = hoyISO();
  for (let i = 0; i < 7 && !abre(d); i++) d = sumarDias(d, -1);
  return d;
}

/* ---------- Datos ---------- */
async function cargarDatos() {
  const [ch, en, fa, tu, ma, us] = await Promise.all([
    E.sb.from('cj_chavales').select('id,nombre,edad,notas,creado').order('nombre'),
    E.sb.from('cj_entradas').select('id,chaval_id,fecha,hora,registrado_por').order('hora', { ascending: false }).limit(20000),
    E.sb.from('cj_faltas').select('id,chaval_id,fecha,gravedad,motivo,puesta_por').order('fecha', { ascending: false }),
    E.sb.from('cj_turnos').select('fecha,email'),
    E.sb.from('cj_material').select('id,nombre,icono,orden').eq('activo', true).order('orden'),
    E.sb.from('cj_usos').select(USOS_CAMPOS).order('inicio', { ascending: false }).limit(5000)
  ]);
  for (const r of [ch, en, fa, tu, ma, us]) if (r.error) throw r.error;
  E.chavales = ch.data; E.entradas = en.data; E.faltas = fa.data; E.turnos = tu.data;
  E.material = ma.data; E.usos = us.data;
}

async function refrescar(silencioso = false) {
  try {
    await cargarDatos();
    pintarTodo();
    if (!silencioso) aviso('Datos al día');
  } catch (e) {
    if (!silencioso) aviso(errorHumano(e), true);
  }
}

/* ---------- Cálculos ---------- */
function entradasDe(id) { return E.entradas.filter(e => e.chaval_id === id).sort((a, b) => b.fecha.localeCompare(a.fecha)); }
function faltasDe(id) { return E.faltas.filter(f => f.chaval_id === id); }
function chaval(id) { return E.chavales.find(c => c.id === id); }
function resumenFaltas(id) {
  const r = { leve: 0, moderada: 0, grave: 0 };
  faltasDe(id).forEach(f => r[f.gravedad]++);
  return r;
}
function pildorasFaltas(id) {
  const r = resumenFaltas(id);
  return ['leve', 'moderada', 'grave'].filter(g => r[g]).map(g =>
    `<span class="pildora p-${g}" title="Faltas ${g}s">${r[g]} ${g}${r[g] > 1 ? 's' : ''}</span>`).join('');
}
function buscarDuplicado(nombre, excepto = null) {
  const n = normal(nombre);
  return E.chavales.find(c => c.id !== excepto && normal(c.nombre) === n);
}
// Nombres parecidos (mismo primer nombre) para avisar sin bloquear
function parecidos(nombre, excepto = null) {
  const p = normal(nombre).split(' ')[0];
  if (!p || p.length < 2) return [];
  return E.chavales.filter(c => c.id !== excepto && normal(c.nombre).split(' ')[0] === p && normal(c.nombre) !== normal(nombre));
}
function quienTrabaja(fecha) { return E.turnos.filter(t => t.fecha === fecha).map(t => t.email); }
function color(email) { return E.equipo.find(p => p.email === email)?.color || '#00c837'; }

/* ---------- Pintar ---------- */
function pintarTodo() {
  pintarMaterial();
  pintarPuerta();
  pintarChavales();
  pintarTurnos();
}

function cambiarVista(v) {
  E.vista = v;
  $$('.tab').forEach(t => t.classList.toggle('activo', t.dataset.vista === v));
  $$('.vista').forEach(s => s.classList.toggle('oculto', s.id !== 'vista-' + v));
  window.scrollTo({ top: 0 });
}

/* ---------- Vista: Puerta ---------- */
function pintarPuerta() {
  const d = E.diaPuerta;
  const f = aFecha(d);
  const esHoy = d === hoyISO();
  $('#puerta-dia').textContent = esHoy ? `Hoy, ${DIAS[f.getDay()]}` : DIAS[f.getDay()];
  $('#puerta-fecha').textContent = `${fechaLarga(d)} ${f.getFullYear()}`;
  $('#aviso-cerrado').classList.toggle('oculto', abre(d));
  $('#dia-sig').disabled = d >= hoyISO();
  $('#dia-sig').style.opacity = d >= hoyISO() ? .35 : 1;

  const delDia = E.entradas.filter(e => e.fecha === d).sort((a, b) => b.hora.localeCompare(a.hora));
  $('#puerta-contador').textContent = delDia.length;
  $('#puerta-dentro-num').textContent = delDia.length ? `(${delDia.length})` : '';

  // Turno del día
  const trabajan = quienTrabaja(d);
  $('#puerta-turno').innerHTML = E.equipo.map(p => `
    <button class="chip ${trabajan.includes(p.email) ? 'on' : ''}" style="--c:${esc(p.color)}" data-turno="${esc(p.email)}" data-fecha="${d}" aria-pressed="${trabajan.includes(p.email)}">
      <span class="punto"></span>${esc(p.nombre)}
    </button>`).join('');

  // Lista de dentro
  $('#puerta-dentro').innerHTML = delDia.length ? delDia.map(e => {
    const c = chaval(e.chaval_id);
    if (!c) return '';
    return `<div class="fila-chaval dentro clic" data-ficha="${c.id}">
      <div class="avatar">${inicial(c.nombre)}</div>
      <div class="info"><span class="nombre">${esc(c.nombre)}</span>
        <span class="meta">${c.edad} años ${pildorasFaltas(c.id)} ${iconosUso(c.id)}</span></div>
      <span class="hora mono">${horaDe(e.hora)}</span>
    </div>`;
  }).join('') : `<div class="vacio"><b>Refugio vacío</b>Busca arriba al primer chaval que llegue.</div>`;

  pintarResultadosPuerta();
}

function pintarResultadosPuerta() {
  const q = $('#puerta-buscar').value;
  const cont = $('#puerta-resultados');
  if (!normal(q)) { cont.innerHTML = ''; return; }
  const n = normal(q);
  const dentro = new Set(E.entradas.filter(e => e.fecha === E.diaPuerta).map(e => e.chaval_id));
  const res = E.chavales.filter(c => normal(c.nombre).includes(n))
    .sort((a, b) => (normal(a.nombre).startsWith(n) ? 0 : 1) - (normal(b.nombre).startsWith(n) ? 0 : 1) || a.nombre.localeCompare(b.nombre))
    .slice(0, 8);
  const exacto = buscarDuplicado(q);
  let html = res.map(c => {
    const ya = dentro.has(c.id);
    const dias = entradasDe(c.id).length;
    return `<div class="fila-chaval ${ya ? 'dentro' : ''}">
      <div class="avatar clic" data-ficha="${c.id}">${inicial(c.nombre)}</div>
      <div class="info clic" data-ficha="${c.id}"><span class="nombre">${esc(c.nombre)}</span>
        <span class="meta">${c.edad} años · <span class="mono">${dias}</span> días ${pildorasFaltas(c.id)}</span></div>
      ${ya
        ? `<button class="btn btn-borde" data-quitar="${c.id}" aria-label="Quitar entrada de ${esc(c.nombre)}">Dentro ✓</button>`
        : `<button class="btn btn-verde" data-entrar="${c.id}">Entrar</button>`}
    </div>`;
  }).join('');
  if (!exacto) {
    html += `<button class="fila-nuevo" data-nuevo>＋ Apuntar a «${esc(capitalizar(q))}» como nuevo</button>`;
  }
  cont.innerHTML = html;
}

async function registrarEntrada(id) {
  const c = chaval(id);
  try {
    const { data, error } = await E.sb.from('cj_entradas')
      .insert({ chaval_id: id, fecha: E.diaPuerta })
      .select('id,chaval_id,fecha,hora,registrado_por').single();
    if (error && error.code !== '23505') throw error;
    if (data) E.entradas.unshift(data);
    vibrar();
    aviso(`${c.nombre} dentro del refugio 🔥`);
    const graves = faltasDe(id).filter(f => f.gravedad === 'grave');
    if (graves.length) setTimeout(() => aviso(`Ojo: ${c.nombre} tiene ${graves.length} falta${graves.length > 1 ? 's' : ''} grave${graves.length > 1 ? 's' : ''}`, true), 1400);
    $('#puerta-buscar').value = '';
    pintarTodo();
  } catch (e) { aviso(errorHumano(e), true); }
}

async function quitarEntrada(id) {
  const c = chaval(id);
  if (!confirm(`¿Quitar la entrada de ${c.nombre} de este día?`)) return;
  try {
    const { error } = await E.sb.from('cj_entradas').delete().eq('chaval_id', id).eq('fecha', E.diaPuerta);
    if (error) throw error;
    E.entradas = E.entradas.filter(e => !(e.chaval_id === id && e.fecha === E.diaPuerta));
    aviso('Entrada quitada');
    pintarTodo();
  } catch (e) { aviso(errorHumano(e), true); }
}

async function cambiarTurno(email, fecha) {
  const ya = E.turnos.some(t => t.email === email && t.fecha === fecha);
  try {
    if (ya) {
      const { error } = await E.sb.from('cj_turnos').delete().eq('email', email).eq('fecha', fecha);
      if (error) throw error;
      E.turnos = E.turnos.filter(t => !(t.email === email && t.fecha === fecha));
    } else {
      const { error } = await E.sb.from('cj_turnos').insert({ email, fecha });
      if (error && error.code !== '23505') throw error;
      E.turnos.push({ email, fecha });
    }
    vibrar(15);
    pintarPuerta();
    pintarTurnos();
  } catch (e) { aviso(errorHumano(e), true); }
}

/* ---------- Vista: Chavales ---------- */
function pintarChavales() {
  const n = normal($('#chav-buscar').value);
  let lista = E.chavales.filter(c => !n || normal(c.nombre).includes(n));
  const dias = new Map();
  E.entradas.forEach(e => dias.set(e.chaval_id, (dias.get(e.chaval_id) || 0) + 1));
  const peso = id => { const r = resumenFaltas(id); return r.grave * 100 + r.moderada * 10 + r.leve; };
  const ultima = id => entradasDe(id)[0]?.fecha || '';
  if (E.orden === 'dias') lista.sort((a, b) => (dias.get(b.id) || 0) - (dias.get(a.id) || 0));
  else if (E.orden === 'faltas') lista = lista.filter(c => peso(c.id)).sort((a, b) => peso(b.id) - peso(a.id));
  else if (E.orden === 'reciente') lista.sort((a, b) => ultima(b.id).localeCompare(ultima(a.id)));
  else lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const total = E.chavales.length;
  $('#chav-resumen').textContent = `${total} chaval${total === 1 ? '' : 'es'} apuntado${total === 1 ? '' : 's'} en el refugio`;
  $('#chav-lista').innerHTML = lista.length ? lista.map(c => {
    const u = ultima(c.id);
    return `<div class="fila-chaval clic" data-ficha="${c.id}">
      <div class="avatar">${inicial(c.nombre)}</div>
      <div class="info"><span class="nombre">${esc(c.nombre)}</span>
        <span class="meta">${c.edad} años <span class="pildora p-dias">${dias.get(c.id) || 0} días</span> ${pildorasFaltas(c.id)}</span></div>
      <span class="hora">${u ? 'Últ. ' + fechaCorta(u) : 'Sin venir'}</span>
    </div>`;
  }).join('') : `<div class="vacio"><b>${E.orden === 'faltas' ? 'Nadie con faltas' : 'Sin resultados'}</b>${E.orden === 'faltas' ? 'De momento, todos se portan. 🔥' : 'Prueba con otro nombre.'}</div>`;
}

/* ---------- Ventana emergente ---------- */
function abrirModal(titulo, html) {
  $('#modal-titulo').textContent = titulo;
  $('#modal-cuerpo').innerHTML = html;
  $('#modal').classList.remove('oculto');
  document.body.style.overflow = 'hidden';
}
function cerrarModal() {
  $('#modal').classList.add('oculto');
  document.body.style.overflow = '';
}

/* ---------- Nuevo chaval ---------- */
function abrirNuevo(nombreInicial = '', desdePuerta = false) {
  abrirModal('Nuevo superviviente', `
    <form id="form-nuevo" class="form" style="max-width:none">
      <label>Nombre (y apellido o apodo si hace falta)
        <input id="nuevo-nombre" required maxlength="60" autocomplete="off" value="${esc(capitalizar(nombreInicial))}" placeholder="Ej. Carlos M.">
      </label>
      <div id="nuevo-aviso"></div>
      <label>Edad
        <input id="nuevo-edad" type="number" inputmode="numeric" min="6" max="35" required placeholder="Ej. 14">
      </label>
      <label class="check"><input type="checkbox" id="nuevo-entrada" ${desdePuerta ? 'checked' : ''}> Apuntar su entrada (${esc(fechaLarga(E.diaPuerta))})</label>
      <button class="btn btn-verde btn-grande" type="submit">Guardar</button>
    </form>`);
  const inp = $('#nuevo-nombre');
  const revisar = () => avisoNombre(inp.value, $('#nuevo-aviso'));
  inp.addEventListener('input', revisar);
  revisar();
  setTimeout(() => (inp.value ? $('#nuevo-edad') : inp).focus(), 250);
  $('#form-nuevo').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nombre = capitalizar(inp.value);
    const edad = parseInt($('#nuevo-edad').value, 10);
    const dup = buscarDuplicado(nombre);
    if (dup) { vibrar(120); revisar(); inp.focus(); inp.select(); return; }
    if (nombre.length < 2) return aviso('Escribe un nombre', true);
    if (!(edad >= 6 && edad <= 35)) return aviso('Pon una edad entre 6 y 35', true);
    const btn = ev.submitter; btn.disabled = true;
    try {
      const { data, error } = await E.sb.from('cj_chavales').insert({ nombre, edad }).select('id,nombre,edad,notas,creado').single();
      if (error) throw error;
      E.chavales.push(data);
      cerrarModal();
      if ($('#nuevo-entrada').checked) await registrarEntrada(data.id);
      else { aviso(`${nombre} se une al refugio`); pintarTodo(); }
    } catch (e) {
      btn.disabled = false;
      if (e.code === '23505') { await refrescar(true); revisar(); aviso('Ya hay alguien con ese nombre. Cámbialo.', true); }
      else aviso(errorHumano(e), true);
    }
  });
}

// Avisa si el nombre ya existe (bloquea) o si se parece a otro (solo informa)
function avisoNombre(nombre, cont, excepto = null) {
  const dup = buscarDuplicado(nombre, excepto);
  if (dup) {
    cont.innerHTML = `<div class="alerta alerta-duplicado">⚠️ <b>Ya hay un ${esc(dup.nombre)}</b> (${dup.edad} años).<br>
      Si es otro chaval, cámbiale el nombre: añade apellido, inicial o apodo (ej. <b>${esc(dup.nombre)} G.</b>).</div>`;
    return true;
  }
  const par = parecidos(nombre, excepto);
  cont.innerHTML = par.length && normal(nombre).length > 1
    ? `<div class="alerta alerta-suave">Ojo, ya están: ${par.slice(0, 4).map(p => `<b>${esc(p.nombre)}</b> (${p.edad})`).join(', ')}. Asegúrate de que no es el mismo.</div>`
    : '';
  return false;
}

/* ---------- Ficha del chaval ---------- */
function abrirFicha(id) {
  const c = chaval(id);
  if (!c) return;
  const ent = entradasDe(id);
  const f = faltasDe(id);
  const mesAct = hoyISO().slice(0, 7);
  const esteMes = ent.filter(e => e.fecha.startsWith(mesAct)).length;
  const colorG = { leve: 'var(--leve)', moderada: 'var(--moderada)', grave: 'var(--grave)' };
  abrirModal(c.nombre, `
    <div class="stats">
      <div class="stat"><span class="mono">${ent.length}</span><small>Días total</small></div>
      <div class="stat"><span class="mono">${esteMes}</span><small>Este mes</small></div>
      <div class="stat"><span class="mono">${c.edad}</span><small>Años</small></div>
    </div>
    ${ent.length ? `<div><span class="etiqueta">Últimas visitas</span><div class="mini-cal" style="margin-top:6px">${ent.slice(0, 24).map(e => `<span>${fechaCorta(e.fecha)}</span>`).join('')}</div></div>` : ''}

    <h3 class="seccion sin-margen">Faltas ${f.length ? `<span class="mono">(${f.length})</span>` : ''}</h3>
    <div class="lista">
      ${f.length ? f.map(x => `<div class="falta" style="--c:${colorG[x.gravedad]}">
        <div class="info">
          <span class="meta"><span class="pildora p-${x.gravedad}">${x.gravedad}</span> ${fechaCorta(x.fecha)} · ${esc(x.puesta_por || '')}</span>
          <p>${esc(x.motivo)}</p>
        </div>
        <button class="borrar-mini" data-borrar-falta="${x.id}" aria-label="Borrar falta">🗑</button>
      </div>`).join('') : '<p class="resumen">Sin faltas. Buen superviviente.</p>'}
    </div>
    <button class="btn btn-llama btn-grande" id="btn-poner-falta">Poner falta</button>

    ${htmlUsosFicha(id)}

    <h3 class="seccion sin-margen">Datos</h3>
    <form id="form-editar" class="form" style="max-width:none">
      <label>Nombre<input id="ed-nombre" maxlength="60" required value="${esc(c.nombre)}"></label>
      <div id="ed-aviso"></div>
      <label>Edad<input id="ed-edad" type="number" inputmode="numeric" min="6" max="35" required value="${c.edad}"></label>
      <label>Notas (opcional)<textarea id="ed-notas" maxlength="500" placeholder="Ej. viene con su hermano">${esc(c.notas || '')}</textarea></label>
      <div class="fila-botones">
        <button class="btn btn-verde" type="submit">Guardar cambios</button>
        <button class="btn btn-peligro" type="button" id="btn-borrar-chaval">Borrar</button>
      </div>
    </form>`);

  $('#btn-poner-falta').addEventListener('click', () => abrirFalta(id));
  $('#ed-nombre').addEventListener('input', () => avisoNombre($('#ed-nombre').value, $('#ed-aviso'), id));
  $('#form-editar').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nombre = capitalizar($('#ed-nombre').value);
    const edad = parseInt($('#ed-edad').value, 10);
    if (avisoNombre(nombre, $('#ed-aviso'), id)) return vibrar(120);
    try {
      const { data, error } = await E.sb.from('cj_chavales')
        .update({ nombre, edad, notas: $('#ed-notas').value.trim() || null })
        .eq('id', id).select('id,nombre,edad,notas,creado').single();
      if (error) throw error;
      Object.assign(c, data);
      aviso('Guardado');
      cerrarModal();
      pintarTodo();
    } catch (e) {
      aviso(e.code === '23505' ? 'Ya hay alguien con ese nombre. Cámbialo.' : errorHumano(e), true);
    }
  });
  $('#btn-borrar-chaval').addEventListener('click', async () => {
    if (!confirm(`¿Borrar a ${c.nombre}? Se borrarán también sus entradas y faltas. No se puede deshacer.`)) return;
    try {
      const { error } = await E.sb.from('cj_chavales').delete().eq('id', id);
      if (error) throw error;
      E.chavales = E.chavales.filter(x => x.id !== id);
      E.entradas = E.entradas.filter(x => x.chaval_id !== id);
      E.faltas = E.faltas.filter(x => x.chaval_id !== id);
      E.usos = E.usos.filter(x => x.responsable_id !== id);
      cerrarModal(); aviso('Borrado'); pintarTodo();
    } catch (e) { aviso(errorHumano(e), true); }
  });
  $$('[data-borrar-falta]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('¿Borrar esta falta?')) return;
    try {
      const fid = Number(b.dataset.borrarFalta);
      const { error } = await E.sb.from('cj_faltas').delete().eq('id', fid);
      if (error) throw error;
      E.faltas = E.faltas.filter(x => x.id !== fid);
      pintarTodo(); abrirFicha(id);
    } catch (e) { aviso(errorHumano(e), true); }
  }));
}

/* ---------- Poner falta ---------- */
function abrirFalta(id) {
  const c = chaval(id);
  let grav = 'leve';
  abrirModal(`Falta a ${c.nombre}`, `
    <form id="form-falta" class="form" style="max-width:none">
      <span class="etiqueta">Gravedad</span>
      <div class="grav" role="radiogroup" aria-label="Gravedad">
        <button type="button" data-g="leve" class="on" role="radio" aria-checked="true">Leve</button>
        <button type="button" data-g="moderada" role="radio" aria-checked="false">Moderada</button>
        <button type="button" data-g="grave" role="radio" aria-checked="false">Grave</button>
      </div>
      <label>¿Qué ha pasado?
        <textarea id="falta-motivo" required maxlength="300" placeholder="Ej. Ha roto el mando de la consola"></textarea>
      </label>
      <div class="chips" style="justify-content:flex-start">
        ${['Ensuciar', 'Romper algo', 'Faltar al respeto', 'Pelea', 'No hacer caso'].map(t => `<button type="button" class="chip" data-motivo="${t}">${t}</button>`).join('')}
      </div>
      <label>Fecha<input type="date" id="falta-fecha" value="${E.diaPuerta}" max="${hoyISO()}" required></label>
      <button class="btn btn-llama btn-grande" type="submit">Guardar falta</button>
      <button class="btn btn-borde" type="button" id="falta-volver">Volver a la ficha</button>
    </form>`);
  $$('.grav button').forEach(b => b.addEventListener('click', () => {
    grav = b.dataset.g;
    $$('.grav button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
  }));
  $$('[data-motivo]').forEach(b => b.addEventListener('click', () => {
    const t = $('#falta-motivo');
    t.value = t.value.trim() ? `${t.value.trim()}. ${b.dataset.motivo}` : b.dataset.motivo;
    t.focus();
  }));
  $('#falta-volver').addEventListener('click', () => abrirFicha(id));
  $('#form-falta').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const motivo = $('#falta-motivo').value.trim();
    if (motivo.length < 2) return aviso('Explica un poco qué ha pasado', true);
    try {
      const { data, error } = await E.sb.from('cj_faltas')
        .insert({ chaval_id: id, gravedad: grav, motivo, fecha: $('#falta-fecha').value })
        .select('id,chaval_id,fecha,gravedad,motivo,puesta_por').single();
      if (error) throw error;
      E.faltas.unshift(data);
      vibrar(60);
      aviso(`Falta ${grav} apuntada a ${c.nombre}`);
      pintarTodo();
      abrirFicha(id);
    } catch (e) { aviso(errorHumano(e), true); }
  });
}

/* ---------- Vista: Turnos y reparto ---------- */
function diasAperturaDelMes(a, m) {
  const r = [];
  const f = new Date(a, m, 1, 12);
  while (f.getMonth() === m) {
    if (CFG.diasApertura.includes(f.getDay())) r.push(aISO(f));
    f.setDate(f.getDate() + 1);
  }
  return r;
}

function pintarTurnos() {
  if (!E.mesTurnos) return;
  const { a, m } = E.mesTurnos;
  $('#mes-titulo').textContent = `${MESES[m]} ${a}`;
  const pref = `${a}-${String(m + 1).padStart(2, '0')}`;
  const dias = diasAperturaDelMes(a, m);
  const hoy = hoyISO();

  // Turnos del mes (incluye días extra que no sean V/S/D si alguien los marcó)
  const delMes = E.turnos.filter(t => t.fecha.startsWith(pref));
  const conteo = E.equipo.map(p => ({ ...p, dias: delMes.filter(t => t.email === p.email).length }));
  const totalJornadas = conteo.reduce((s, p) => s + p.dias, 0);
  $('#reparto-personas').innerHTML = conteo.map(p => `
    <div class="persona-caja" style="--c:${esc(p.color)}">
      <b>${esc(p.nombre)}</b><span class="mono">${p.dias}</span> <small>día${p.dias === 1 ? '' : 's'} trabajado${p.dias === 1 ? '' : 's'}</small>
    </div>`).join('');
  pintarReparto(conteo, totalJornadas);

  const lista = [...new Set([...dias, ...delMes.map(t => t.fecha)])].sort();
  $('#turnos-lista').innerHTML = lista.map(d => {
    const f = aFecha(d);
    const trabajan = quienTrabaja(d);
    const n = E.entradas.filter(e => e.fecha === d).length;
    const futuro = d > hoy;
    return `<div class="fila-turno ${d === hoy ? 'hoy-marca' : ''}" style="${futuro ? 'opacity:.6' : ''}">
      <div class="fecha-turno"><div class="d">${f.getDate()}</div><div class="s">${DIAS[f.getDay()].slice(0, 3)}</div></div>
      <div class="chips">${E.equipo.map(p => `<button class="chip ${trabajan.includes(p.email) ? 'on' : ''}" style="--c:${esc(p.color)}" data-turno="${esc(p.email)}" data-fecha="${d}" aria-pressed="${trabajan.includes(p.email)}"><span class="punto"></span>${esc(p.nombre)}</button>`).join('')}</div>
      <div class="asist"><span class="mono">${n}</span>chav.</div>
    </div>`;
  }).join('') || '<div class="vacio">Este mes no hay días de apertura.</div>';
}

function pintarReparto(conteo, totalJornadas) {
  const total = parseFloat(String($('#reparto-total').value).replace(',', '.')) || 0;
  const cont = $('#reparto-resultado');
  if (!total) { cont.innerHTML = '<p class="resumen">Pon cuánto hay que repartir y te digo cuánto le toca a cada uno según los días trabajados.</p>'; return; }
  if (!totalJornadas) { cont.innerHTML = '<p class="resumen">Marca abajo quién trabajó cada día para poder repartir.</p>'; return; }
  const porDia = total / totalJornadas;
  cont.innerHTML = conteo.map(p => `
    <div class="linea-reparto"><span><b>${esc(p.nombre)}</b> · ${p.dias} día${p.dias === 1 ? '' : 's'}</span><span class="mono">${euros(p.dias * porDia)}</span></div>`).join('')
    + `<p class="resumen">A <span class="mono">${euros(porDia)}</span> por día trabajado (${totalJornadas} jornadas en total).</p>`;
}

function textoReparto() {
  const { a, m } = E.mesTurnos;
  const pref = `${a}-${String(m + 1).padStart(2, '0')}`;
  const delMes = E.turnos.filter(t => t.fecha.startsWith(pref));
  const total = parseFloat(String($('#reparto-total').value).replace(',', '.')) || 0;
  const jornadas = delMes.length;
  let t = `🔥 Refugio Joven · ${MESES[m]} ${a}\n`;
  E.equipo.forEach(p => {
    const d = delMes.filter(x => x.email === p.email).map(x => x.fecha).sort();
    t += `\n${p.nombre}: ${d.length} días (${d.map(fechaCorta).join(', ') || '—'})`;
    if (total && jornadas) t += ` → ${euros(total / jornadas * d.length)}`;
  });
  if (total) t += `\n\nTotal a repartir: ${euros(total)}`;
  t += `\n\nQue la plaga se propague ☢️`;
  return t;
}

/* ---------- Eventos ---------- */
function enlazar() {
  $('#btn-reintentar').addEventListener('click', iniciar);

  $('#form-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const msg = $('#login-msg'); msg.className = 'mensaje'; msg.textContent = '';
    const btn = $('#btn-login'); btn.disabled = true; btn.textContent = 'Abriendo…';
    try {
      const { data, error } = await E.sb.auth.signInWithPassword({
        email: $('#login-email').value.trim(), password: $('#login-pass').value
      });
      if (error) throw error;
      await entrarConSesion(data.session);
    } catch (e) {
      mostrar('#pantalla-login');
      msg.textContent = errorHumano(e);
    } finally { btn.disabled = false; btn.textContent = 'Entrar al refugio'; }
  });

  $('#btn-olvido').addEventListener('click', async () => {
    const email = $('#login-email').value.trim();
    const msg = $('#login-msg'); msg.className = 'mensaje';
    if (!email) { msg.textContent = 'Escribe primero tu correo arriba.'; return; }
    try {
      const { error } = await E.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) throw error;
      msg.className = 'mensaje ok';
      msg.textContent = 'Te hemos mandado un correo para cambiar la contraseña.';
    } catch (e) { msg.textContent = errorHumano(e); }
  });

  $('#form-nueva-pass').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const msg = $('#nueva-pass-msg');
    try {
      const { data, error } = await E.sb.auth.updateUser({ password: $('#nueva-pass').value });
      if (error) throw error;
      history.replaceState(null, '', location.pathname);
      const { data: s } = await E.sb.auth.getSession();
      await entrarConSesion(s.session || data);
    } catch (e) { msg.textContent = errorHumano(e); }
  });

  const salir = async () => { await E.sb.auth.signOut(); mostrar('#pantalla-login'); };
  $('#btn-salir').addEventListener('click', () => { if (confirm('¿Cerrar sesión?')) salir(); });
  $('#btn-salir-2').addEventListener('click', salir);
  $('#btn-refrescar').addEventListener('click', () => refrescar());

  $$('.tab').forEach(t => t.addEventListener('click', () => cambiarVista(t.dataset.vista)));

  // Puerta
  $('#dia-ant').addEventListener('click', () => { E.diaPuerta = sumarDias(E.diaPuerta, -1); pintarPuerta(); });
  $('#dia-sig').addEventListener('click', () => {
    if (E.diaPuerta >= hoyISO()) return;
    E.diaPuerta = sumarDias(E.diaPuerta, 1); pintarPuerta();
  });
  $('#puerta-buscar').addEventListener('input', pintarResultadosPuerta);
  $('#puerta-buscar').addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    const b = $('#puerta-resultados [data-entrar]') || $('#puerta-resultados [data-nuevo]');
    if (b) b.click();
  });

  // Clics delegados (listas que se repintan)
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-entrar],[data-quitar],[data-nuevo],[data-ficha],[data-turno],[data-material],[data-cerrar]');
    if (!el) return;
    if (el.dataset.entrar) registrarEntrada(Number(el.dataset.entrar));
    else if (el.dataset.quitar) quitarEntrada(Number(el.dataset.quitar));
    else if (el.hasAttribute('data-nuevo')) abrirNuevo($('#puerta-buscar').value, true);
    else if (el.dataset.ficha) abrirFicha(Number(el.dataset.ficha));
    else if (el.dataset.turno) cambiarTurno(el.dataset.turno, el.dataset.fecha);
    else if (el.dataset.material) abrirMaterial(el.dataset.material);
    else if (el.hasAttribute('data-cerrar')) cerrarModal();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') cerrarModal(); });

  // Chavales
  $('#chav-buscar').addEventListener('input', pintarChavales);
  $('#btn-nuevo-chaval').addEventListener('click', () => abrirNuevo($('#chav-buscar').value, false));
  $$('.filtro').forEach(b => b.addEventListener('click', () => {
    E.orden = b.dataset.orden;
    $$('.filtro').forEach(x => x.classList.toggle('activo', x === b));
    pintarChavales();
  }));

  // Turnos
  $('#mes-ant').addEventListener('click', () => { moverMes(-1); });
  $('#mes-sig').addEventListener('click', () => { moverMes(1); });
  $('#reparto-total').addEventListener('input', () => {
    try { localStorage.setItem('cj-reparto-' + claveMes(), $('#reparto-total').value); } catch (e) { /* nada */ }
    pintarTurnos();
  });
  $('#btn-copiar-reparto').addEventListener('click', async () => {
    const t = textoReparto();
    try { await navigator.clipboard.writeText(t); aviso('Resumen copiado. Pégalo en WhatsApp'); }
    catch (e) { prompt('Copia este texto:', t); }
  });

  // Al volver a la app, actualiza (por si el otro ha apuntado algo)
  document.addEventListener('visibilitychange', () => { if (!document.hidden && E.usuario) refrescar(true); });
  setInterval(() => { if (!document.hidden && E.usuario && $('#modal').classList.contains('oculto')) refrescar(true); }, 30000);
}

function claveMes() { return `${E.mesTurnos.a}-${E.mesTurnos.m}`; }
function moverMes(n) {
  let { a, m } = E.mesTurnos;
  m += n; if (m < 0) { m = 11; a--; } if (m > 11) { m = 0; a++; }
  E.mesTurnos = { a, m };
  let v = '';
  try { v = localStorage.getItem('cj-reparto-' + claveMes()) || ''; } catch (e) { /* nada */ }
  $('#reparto-total').value = v;
  pintarTurnos();
}

/* ---------- Service worker (app instalable) ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

enlazar();
iniciar();
