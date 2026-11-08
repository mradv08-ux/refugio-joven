'use strict';
/* =========================================================
   Refugio Joven · Material del centro
   Cada turno: UN responsable + su grupo, elegidos de una vez.
   - Quien está jugando a algo no puede apuntarse a la espera de
     ese mismo juego ni entrar en el turno siguiente (no acaparar).
   - Límite de tiempo (PS5/PC 1 h, billar/futbolín/ping pong 30 min)
     solo si hay alguien en la lista de espera. Si se pasa: rojo,
     y el reloj sigue hasta que haya cambio de turno.
   (Usa E, $, $$, esc… definidos en app.js)
   ========================================================= */

const USOS_CAMPOS = 'id,material_id,responsable_id,grupo,fecha,inicio,turno_inicio,fin,devolucion,nota,falta_id,abierto_por,cerrado_por';
const ESPERA_CAMPOS = 'id,material_id,responsable_id,grupo,fecha,creado,creado_por';
const DEVOL = {
  bien:    { txt: 'Devuelto bien', ico: '✅', c: 'var(--green)' },
  turno:   { txt: 'Fin de turno, todo bien', ico: '▶️', c: 'var(--green)' },
  danado:  { txt: 'Devuelto con daños', ico: '⚠️', c: 'var(--flame)' },
  perdido: { txt: 'Perdido / falta algo', ico: '❌', c: 'var(--grave)' },
  cambio:  { txt: 'Cambio de responsable', ico: '🔁', c: 'var(--gold)' }
};

/* ---------- Consultas ---------- */
function materialPorId(id) { return E.material.find(m => m.id === id); }
function usoAbierto(mid) { return E.usos.find(u => u.material_id === mid && !u.fin); }
function personas(x) { return x ? [x.responsable_id, ...(x.grupo || [])] : []; }
function usosAbiertosDe(cid) { return E.usos.filter(u => !u.fin && personas(u).includes(cid)); }
function esperaDe(mid) {
  const hoy = hoyISO();
  return E.espera.filter(e => e.material_id === mid && e.fecha === hoy).sort((a, b) => a.creado.localeCompare(b.creado));
}
function dentroHoy() {
  const hoy = hoyISO();
  return new Set(E.entradas.filter(e => e.fecha === hoy).map(e => e.chaval_id));
}
function minutosDesde(ts) { return Math.max(0, Math.floor((Date.now() - new Date(ts)) / 60000)); }
function duracion(min) { return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`; }
function nombreDe(id) { return chaval(id)?.nombre || '¿?'; }
function nombresDe(x) { return personas(x).map(nombreDe); }
function textoFaltasPrevias(cid) {
  const r = resumenFaltas(cid);
  const t = ['leve', 'moderada', 'grave'].filter(g => r[g]).map(g => `${r[g]} ${g}${r[g] > 1 ? 's' : ''}`);
  return t.length ? `Ya tenía: <b>${t.join(', ')}</b>` : 'No tenía faltas';
}

// Estado del tiempo de un turno: libre de límite, aviso (quedan ≤5 min) o pasado
function estadoTiempo(m, u) {
  const min = minutosDesde(u.turno_inicio || u.inicio);
  const esperan = esperaDe(m.id).length;
  const lim = m.limite_min;
  if (!lim) return { min, clase: 'ocupado', txt: 'Sin límite' };
  if (!esperan) return { min, clase: 'ocupado', txt: `Límite ${duracion(lim)} si hay espera` };
  if (min >= lim) return { min, clase: 'pasado', txt: `¡Pasados ${duracion(min - lim)}!` };
  if (min >= lim - 5) return { min, clase: 'aviso', txt: `Quedan ${lim - min} min` };
  return { min, clase: 'ocupado', txt: `Quedan ${lim - min} min` };
}

// ¿Por qué no puede alguien entrar en un turno o en la espera de este juego?
// opciones: ignorarUso (id de uso cuyos jugadores se permiten), ignorarEspera (id de espera)
// paraEspera: además, norma de una sola reserva a la vez (en cualquier juego)
function motivoBloqueo(mid, cid, { ignorarUso = null, ignorarEspera = null, saliente = [], paraEspera = false } = {}) {
  if (saliente.includes(cid)) return 'acaba de jugar';
  const u = usoAbierto(mid);
  if (u && u.id !== ignorarUso && personas(u).includes(cid)) return 'ya está jugando aquí';
  const e = esperaDe(mid).find(x => x.id !== ignorarEspera && personas(x).includes(cid));
  if (e) return `ya espera con ${nombreDe(e.responsable_id)}`;
  if (paraEspera) {
    const hoy = hoyISO();
    const otra = E.espera.find(x => x.fecha === hoy && x.material_id !== mid && x.id !== ignorarEspera && personas(x).includes(cid));
    if (otra) return `ya espera en ${materialPorId(otra.material_id)?.nombre || 'otro juego'}`;
  }
  return null;
}

// Iconos de lo que tiene alguien ahora mismo (para listas)
function iconosUso(cid) {
  return usosAbiertosDe(cid).map(u => {
    const m = materialPorId(u.material_id);
    const resp = u.responsable_id === cid;
    return m ? `<span title="${resp ? 'Responsable de' : 'Usando'} ${esc(m.nombre)}">${m.icono}${resp ? '🔑' : ''}</span>` : '';
  }).join(' ');
}

/* ---------- Vista principal ---------- */
function botonEspera(m) {
  return `<button class="puesto-espera" data-espera-rapida="${esc(m.id)}" aria-label="Apuntar un grupo a la espera de ${esc(m.nombre)}">⏳ + Espera</button>`;
}
function pintarMaterial() {
  const grid = $('#material-grid');
  if (!grid) return;
  grid.innerHTML = E.material.map(m => {
    const u = usoAbierto(m.id);
    const esp = esperaDe(m.id).length;
    const lim = m.limite_min ? `⏱ ${duracion(m.limite_min)} si hay espera` : 'Sin límite';
    if (!u) {
      return `<div class="puesto libre ${esp ? 'con-espera' : ''}"><button class="puesto-cuerpo" data-material="${esc(m.id)}" aria-label="${esc(m.nombre)}: libre">
        <span class="ico">${m.icono}</span><span class="tit">${esc(m.nombre)}</span>
        <span class="estado">● Libre</span>
        <span class="det">${esp ? `<b class="espera-n">⏳ ${esp} esperando · ▶ dar turno</b>` : lim}</span>
      </button>${esp ? botonEspera(m) : ''}</div>`;
    }
    const t = estadoTiempo(m, u);
    const grave = resumenFaltas(u.responsable_id).grave > 0;
    const n = (u.grupo || []).length;
    return `<div class="puesto ${t.clase}"><button class="puesto-cuerpo" data-material="${esc(m.id)}" aria-label="${esc(m.nombre)}: en uso por ${esc(nombreDe(u.responsable_id))}, lleva ${duracion(t.min)}. ${esc(t.txt)}">
      ${grave ? '<span class="alarma" title="El responsable tiene faltas graves">🚨</span>' : ''}
      <span class="ico">${m.icono}</span><span class="tit">${esc(m.nombre)}</span>
      <span class="crono mono">⏱ ${duracion(t.min)}</span>
      <span class="estado">${esc(t.txt)}</span>
      <span class="resp">🔑 ${esc(nombreDe(u.responsable_id))}${n ? ` +${n}` : ''}</span>
      <span class="det">${esp ? `<b class="espera-n">⏳ ${esp} esperando</b>` : 'Nadie esperando'}</span>
    </button>${botonEspera(m)}</div>`;
  }).join('');

  const hoy = hoyISO();
  const deHoy = E.usos.filter(u => u.fecha === hoy);
  $('#material-hoy-num').textContent = deHoy.length ? `(${deHoy.length})` : '';
  $('#material-historial').innerHTML = deHoy.length ? deHoy.map(u => htmlMovimiento(u)).join('')
    : '<div class="vacio"><b>Nada prestado hoy</b>Toca una de las cosas de arriba cuando alguien la pida.</div>';
}

function htmlMovimiento(u, conMaterial = true) {
  const m = materialPorId(u.material_id) || { icono: '❔', nombre: u.material_id };
  const d = u.fin ? DEVOL[u.devolucion] || DEVOL.bien : null;
  const grupo = (u.grupo || []).map(nombreDe);
  return `<div class="mov" style="--c:${d ? d.c : 'var(--flame-hi)'}">
    <span class="ico">${m.icono}</span>
    <div class="info">
      <span class="nombre">${conMaterial ? esc(m.nombre) + ' · ' : ''}🔑 ${esc(nombreDe(u.responsable_id))}</span>
      <span class="meta mono">${conMaterial && u.fecha === hoyISO() ? '' : fechaCorta(u.fecha) + ' · '}${horaDe(u.inicio)}–${u.fin ? horaDe(u.fin) : 'ahora'}</span>
      ${grupo.length ? `<span class="meta">Con: ${grupo.map(esc).join(', ')}</span>` : ''}
      <p>${d ? `${d.ico} ${d.txt}` : '⏳ En uso'}${u.nota ? ` — ${esc(u.nota)}` : ''}</p>
    </div>
  </div>`;
}

// Sección para la ficha del chaval
function htmlUsosFicha(cid) {
  const us = E.usos.filter(u => u.responsable_id === cid);
  if (!us.length) return '';
  const malos = us.filter(u => u.devolucion === 'danado' || u.devolucion === 'perdido').length;
  return `<h3 class="seccion sin-margen">Material a su cargo <span class="mono">(${us.length})</span></h3>
    ${malos ? `<p class="resumen">⚠️ ${malos} vez${malos > 1 ? 'es' : ''} devuelto con daños o pérdidas.</p>` : ''}
    <div class="lista">${us.slice(0, 10).map(u => htmlMovimiento(u, true)).join('')}</div>`;
}

/* ---------- Abrir un puesto ---------- */
function abrirMaterial(mid) {
  const m = materialPorId(mid);
  if (!m) return;
  const u = usoAbierto(mid);
  if (u) abrirEnUso(m, u); else abrirTurno(m);
}

/* ---------- Selector de grupo: responsable + grupo de una vez ----------
   El primero que añades es el responsable 🔑. Toca la llave de otro
   para hacerlo responsable, o la ✕ para quitarlo. */
function selectorGrupo(cont, { mid, iniciales = [], bloqueo = {}, alCambiar = () => {} }) {
  let sel = iniciales.filter(id => chaval(id));
  cont.innerHTML = `
    <div class="seleccion" aria-live="polite"></div>
    <input type="search" class="sel-buscar" placeholder="Escribe un nombre y tócalo…" autocomplete="off" aria-label="Buscar chaval">
    <div class="lista-elegir"></div>`;
  const caja = $('.seleccion', cont), inp = $('.sel-buscar', cont), lista = $('.lista-elegir', cont);

  const pintarSel = () => {
    caja.innerHTML = sel.length ? sel.map((id, i) => {
      const motivo = motivoBloqueo(mid, id, bloqueo);
      return `<span class="chip-sel ${i === 0 ? 'resp' : ''} ${motivo ? 'mal' : ''}">
        ${i === 0 ? '<span class="llave" aria-hidden="true">🔑</span>'
                  : `<button type="button" class="mini" data-resp="${id}" aria-label="Hacer responsable a ${esc(nombreDe(id))}" title="Hacer responsable">🔑</button>`}
        <span>${esc(nombreDe(id))}${motivo ? ` <small>(${esc(motivo)})</small>` : ''}</span>
        <button type="button" class="mini" data-fuera="${id}" aria-label="Quitar a ${esc(nombreDe(id))}">✕</button>
      </span>`;
    }).join('') : '<span class="resumen">El primero que toques será el <b>responsable 🔑</b>; los demás, su grupo.</span>';
    alCambiar(sel);
  };
  const pintarLista = () => {
    const n = normal(inp.value);
    const dentro = dentroHoy();
    let res = E.chavales.filter(c => !sel.includes(c.id) && (n ? normal(c.nombre).includes(n) : dentro.has(c.id)));
    res.sort((a, b) => (dentro.has(b.id) - dentro.has(a.id)) || a.nombre.localeCompare(b.nombre, 'es'));
    lista.innerHTML = res.slice(0, 40).map(c => {
      const motivo = motivoBloqueo(mid, c.id, bloqueo);
      return `<button type="button" class="opcion ${motivo ? 'bloq' : ''}" data-elegir="${c.id}" ${motivo ? 'disabled' : ''}>
        <span class="avatar">${inicial(c.nombre)}</span>
        <span class="info"><span class="nombre">${esc(c.nombre)}</span>
          <span class="meta">${motivo ? `⛔ ${esc(motivo)}` : `${c.edad} años ${dentro.has(c.id) ? '<span class="etq-dentro">· dentro</span>' : ''} ${pildorasFaltas(c.id)} ${iconosUso(c.id)}`}</span></span>
        ${motivo ? '' : `<span class="mas">${sel.length ? '+' : '🔑'}</span>`}
      </button>`;
    }).join('') || `<p class="resumen">${n ? 'No hay nadie con ese nombre. Apúntalo primero en Puerta.' : 'No hay nadie dentro hoy. Escribe un nombre.'}</p>`;
  };
  inp.addEventListener('input', pintarLista);
  lista.addEventListener('click', ev => {
    const b = ev.target.closest('[data-elegir]');
    if (!b || b.disabled) return;
    sel.push(Number(b.dataset.elegir));
    inp.value = ''; inp.focus();
    pintarSel(); pintarLista();
  });
  caja.addEventListener('click', ev => {
    const r = ev.target.closest('[data-resp]'), f = ev.target.closest('[data-fuera]');
    if (r) { const id = Number(r.dataset.resp); sel = [id, ...sel.filter(x => x !== id)]; }
    else if (f) { const id = Number(f.dataset.fuera); sel = sel.filter(x => x !== id); }
    else return;
    pintarSel(); pintarLista();
  });
  pintarSel(); pintarLista();
  return {
    valor: () => sel.slice(),
    poner: ids => { sel = ids.filter(id => chaval(id)); pintarSel(); pintarLista(); },
    errores: () => sel.map(id => [id, motivoBloqueo(mid, id, bloqueo)]).filter(x => x[1])
  };
}

// Lista de espera de un juego (dentro de una ventana)
function htmlEspera(m, { conElegir = false } = {}) {
  const es = esperaDe(m.id);
  return `<div class="espera-caja">
    <div class="espera-cab"><span class="etiqueta">⏳ Lista de espera ${es.length ? `(${es.length})` : ''}</span>
      <button type="button" class="btn btn-borde btn-peq" data-esp-anadir>+ Apuntar grupo</button></div>
    ${es.length ? es.map((e, i) => `<div class="espera-item ${i === 0 ? 'primero' : ''}">
        <span class="pos mono">${i + 1}</span>
        <span class="info"><span class="nombre">🔑 ${esc(nombreDe(e.responsable_id))}${(e.grupo || []).length ? ` <small>+${e.grupo.length}</small>` : ''}${e.creado_por === 'Mi Refugio' ? ' <small title="Se apuntó desde su móvil">📱</small>' : ''}</span>
          ${(e.grupo || []).length ? `<span class="meta">${e.grupo.map(nombreDe).map(esc).join(', ')}</span>` : ''}
          <span class="meta mono">desde ${horaDe(e.creado)} · ${duracion(minutosDesde(e.creado))}</span></span>
        ${conElegir ? `<button type="button" class="mini" data-esp-editar="${e.id}" aria-label="Añadir gente al grupo y dar turno" title="Añadir gente y dar turno">✏️</button>
          <button type="button" class="btn btn-verde btn-peq" data-esp-elegir="${e.id}">Turno</button>` : ''}
        <button type="button" class="mini" data-esp-quitar="${e.id}" aria-label="Quitar de la lista">✕</button>
      </div>`).join('') : '<p class="resumen">Nadie esperando.</p>'}
  </div>`;
}
function enlazarEspera(m, volver, alElegir) {
  $$('[data-esp-anadir]').forEach(b => b.addEventListener('click', () => abrirApuntarEspera(m, volver)));
  $$('[data-esp-quitar]').forEach(b => b.addEventListener('click', async () => {
    const id = Number(b.dataset.espQuitar);
    const e = E.espera.find(x => x.id === id);
    if (!confirm(`¿Quitar a ${nombreDe(e.responsable_id)} y su grupo de la lista?`)) return;
    try {
      const { error } = await E.sb.from('cj_espera').delete().eq('id', id);
      if (error) throw error;
      E.espera = E.espera.filter(x => x.id !== id);
      pintarMaterial(); volver();
    } catch (er) { aviso(errorHumano(er), true); }
  }));
  if (alElegir) $$('[data-esp-elegir]').forEach(b => b.addEventListener('click', () => alElegir(Number(b.dataset.espElegir))));
  $$('[data-esp-editar]').forEach(b => b.addEventListener('click', () => abrirTurnoEditar(m, Number(b.dataset.espEditar))));
}

// Da entrada de hoy si alguien coge material sin haberse apuntado en la puerta
async function asegurarEntradaHoy(ids) {
  const hoy = hoyISO();
  const yaDentro = dentroHoy();
  const faltan = [...new Set(ids)].filter(id => !yaDentro.has(id));
  if (!faltan.length) return;
  const { data, error } = await E.sb.from('cj_entradas')
    .upsert(faltan.map(id => ({ chaval_id: id, fecha: hoy })), { onConflict: 'chaval_id,fecha', ignoreDuplicates: true })
    .select('id,chaval_id,fecha,hora,registrado_por');
  if (!error && data) E.entradas.unshift(...data);
}

async function borrarEspera(id) {
  if (!id) return;
  await E.sb.from('cj_espera').delete().eq('id', id);
  E.espera = E.espera.filter(x => x.id !== id);
}

/* ---------- Dar turno (solo con el juego libre y ya revisado) ---------- */
// Último grupo que lo tuvo hoy: si hay espera, no puede volver a cogerlo como grupo nuevo
function ultimoGrupo(mid) {
  const hoy = hoyISO();
  const ult = E.usos.find(x => x.material_id === mid && x.fin && x.fecha === hoy);
  return ult ? personas(ult) : [];
}

async function darTurno(m, ids, esperaId = null) {
  try {
    const { data, error } = await E.sb.from('cj_usos')
      .insert({ material_id: m.id, responsable_id: ids[0], grupo: ids.slice(1), fecha: hoyISO() })
      .select(USOS_CAMPOS).single();
    if (error) throw error;
    E.usos.unshift(data);
    await borrarEspera(esperaId);
    await asegurarEntradaHoy(ids);
    vibrar();
    cerrarModal();
    aviso(`${m.icono} ${m.nombre} para ${nombreDe(ids[0])}${ids.length > 1 ? ` +${ids.length - 1}` : ''} 🔑`);
    pintarTodo();
    return true;
  } catch (e) {
    if (e.code === '23505') { await refrescar(true); cerrarModal(); aviso('Alguien acaba de darlo. Mira quién lo tiene.', true); }
    else { aviso(errorHumano(e), true); refrescar(true); }
    return false;
  }
}

// Da el turno a un grupo de la lista de espera con un toque
async function darTurnoEspera(m, esperaId, btn) {
  const e = E.espera.find(x => x.id === esperaId);
  if (!e) return;
  const pos = esperaDe(m.id).indexOf(e);
  if (pos > 0 && !confirm(`${nombreDe(e.responsable_id)} es el nº ${pos + 1}. ¿Darle el turno antes que al nº 1?`)) return;
  const ids = personas(e).filter(id => chaval(id));
  const mal = ids.map(id => [id, motivoBloqueo(m.id, id, { ignorarEspera: e.id })]).filter(x => x[1]);
  if (mal.length) { aviso(`${nombreDe(mal[0][0])}: ${mal[0][1]}`, true); return; }
  if (btn) btn.disabled = true;
  if (!(await darTurno(m, ids, e.id)) && btn) btn.disabled = false;
}

function abrirTurno(m) {
  if (usoAbierto(m.id)) return abrirEnUso(m, usoAbierto(m.id));
  const es = esperaDe(m.id);
  const sig = es[0];
  const saliente = es.length ? ultimoGrupo(m.id) : [];
  abrirModal(`${m.icono} ${m.nombre}`, `
    ${sig ? `<div class="siguiente">
        <span class="etiqueta">▶ Siguiente en la lista</span>
        <span class="nombre">🔑 ${esc(nombreDe(sig.responsable_id))}</span>
        ${(sig.grupo || []).length ? `<span class="meta">Con: ${sig.grupo.map(nombreDe).map(esc).join(', ')}</span>` : ''}
        <span class="meta mono">Esperando desde ${horaDe(sig.creado)} · ${duracion(minutosDesde(sig.creado))}</span>
        <button class="btn btn-verde btn-grande" id="tn-siguiente">▶ Dar turno a ${esc(nombreDe(sig.responsable_id))}${(sig.grupo || []).length ? ` +${sig.grupo.length}` : ''}</button>
        <button class="btn btn-borde" id="tn-editar">✏️ Añadir gente al grupo y dar turno</button>
      </div>` : ''}
    ${htmlEspera(m, { conElegir: true })}
    ${sig ? `<details id="tn-otro"><summary class="btn btn-borde" style="list-style:none">Otro grupo (no está en la lista)</summary>
      <div class="columna" style="margin-top:10px"><p class="resumen">⚠️ Se saltan la espera.${saliente.length ? ' El último grupo no puede volver a cogerlo.' : ''}</p>` : '<div class="columna">'}
      <div id="tn-sel"></div>
      <button class="btn btn-verde btn-grande" id="tn-ok" disabled>Elige quién juega</button>
    </div>${sig ? '</details>' : ''}`);

  if (sig) {
    $('#tn-siguiente').addEventListener('click', ev => darTurnoEspera(m, sig.id, ev.currentTarget));
    $('#tn-editar').addEventListener('click', () => abrirTurnoEditar(m, sig.id));
  }
  enlazarEspera(m, () => abrirTurno(m), id => darTurnoEspera(m, id));

  const bloqueo = { saliente };
  const sel = selectorGrupo($('#tn-sel'), {
    mid: m.id,
    bloqueo,
    alCambiar: s => {
      const ok = s.length > 0;
      $('#tn-ok').disabled = !ok;
      $('#tn-ok').textContent = ok ? `Dar ${m.nombre} a ${nombreDe(s[0])}${s.length > 1 ? ` +${s.length - 1}` : ''}` : 'Elige quién juega';
    }
  });
  if (!sig) setTimeout(() => $('#tn-sel .sel-buscar')?.focus(), 250);

  $('#tn-ok').addEventListener('click', async (ev) => {
    const ids = sel.valor();
    const mal = sel.errores();
    if (mal.length) { aviso(`${nombreDe(mal[0][0])}: ${mal[0][1]}. Quítalo del grupo.`, true); vibrar(120); return; }
    const btn = ev.currentTarget; btn.disabled = true;
    if (!(await darTurno(m, ids))) btn.disabled = false;
  });
}

/* ---------- Dar turno a un grupo de la lista, añadiendo o quitando gente ---------- */
function abrirTurnoEditar(m, esperaId) {
  const e = E.espera.find(x => x.id === esperaId);
  if (!e) return abrirTurno(m);
  const pos = esperaDe(m.id).indexOf(e) + 1;
  abrirModal(`${m.icono} Turno nº ${pos} · ${m.nombre}`, `
    <p class="resumen">Añade a quien juega con ${esc(nombreDe(e.responsable_id))} (o toca la 🔑 de otro para cambiar el responsable).</p>
    <div id="te-sel"></div>
    <button class="btn btn-verde btn-grande" id="te-ok">Dar turno</button>
    <button class="btn btn-borde" id="te-volver">Volver</button>`);
  const sel = selectorGrupo($('#te-sel'), {
    mid: m.id,
    iniciales: personas(e),
    bloqueo: { ignorarEspera: e.id },
    alCambiar: s => {
      const b = $('#te-ok'); if (!b) return;
      b.disabled = !s.length;
      b.textContent = s.length ? `▶ Dar ${m.nombre} a ${nombreDe(s[0])}${s.length > 1 ? ` +${s.length - 1}` : ''}` : 'Elige quién juega';
    }
  });
  $('#te-volver').addEventListener('click', () => abrirTurno(m));
  $('#te-ok').addEventListener('click', async (ev) => {
    if (usoAbierto(m.id)) { aviso('Ese juego ya está en uso. Primero hay que recibirlo y revisarlo.', true); return; }
    const ids = sel.valor();
    const mal = sel.errores();
    if (mal.length) { aviso(`${nombreDe(mal[0][0])}: ${mal[0][1]}. Quítalo del grupo.`, true); vibrar(120); return; }
    const btn = ev.currentTarget; btn.disabled = true;
    if (!(await darTurno(m, ids, e.id))) btn.disabled = false;
  });
}

/* ---------- Apuntar un grupo a la lista de espera ---------- */
function abrirApuntarEspera(m, volver) {
  abrirModal(`⏳ Espera · ${m.nombre}`, `
    <p class="resumen">Quien ya está jugando a ${esc(m.nombre)} o ya está en otra lista no se puede apuntar (una reserva a la vez).</p>
    <div id="ae-sel"></div>
    <button class="btn btn-verde btn-grande" id="ae-ok" disabled>Apuntar a la lista</button>
    <button class="btn btn-borde" id="ae-volver">Volver</button>`);
  const sel = selectorGrupo($('#ae-sel'), {
    mid: m.id,
    bloqueo: { paraEspera: true },
    alCambiar: s => { $('#ae-ok').disabled = !s.length; }
  });
  setTimeout(() => $('#ae-sel .sel-buscar')?.focus(), 250);
  $('#ae-volver').addEventListener('click', volver);
  $('#ae-ok').addEventListener('click', async (ev) => {
    const ids = sel.valor();
    const mal = sel.errores();
    if (mal.length) { aviso(`${nombreDe(mal[0][0])}: ${mal[0][1]}`, true); vibrar(120); return; }
    const btn = ev.currentTarget; btn.disabled = true;
    try {
      const { data, error } = await E.sb.from('cj_espera')
        .insert({ material_id: m.id, responsable_id: ids[0], grupo: ids.slice(1), fecha: hoyISO() })
        .select(ESPERA_CAMPOS).single();
      if (error) throw error;
      E.espera.push(data);
      await asegurarEntradaHoy(ids);
      vibrar();
      aviso(`Apuntados: nº ${esperaDe(m.id).length} para ${m.nombre}`);
      pintarTodo();
      volver();
    } catch (e) { btn.disabled = false; aviso(errorHumano(e), true); }
  });
}

/* ---------- Juego en uso ---------- */
function abrirEnUso(m, u) {
  const t = estadoTiempo(m, u);
  const grupo = (u.grupo || []).map(nombreDe);
  const esp = esperaDe(m.id).length;
  abrirModal(`${m.icono} ${m.nombre}`, `
    <div class="elegido reloj-${t.clase}">
      <span class="avatar">${inicial(nombreDe(u.responsable_id))}</span>
      <span class="info"><span class="etiqueta">Responsable</span><span class="nombre">${esc(nombreDe(u.responsable_id))}</span>
        <span class="meta">${grupo.length ? `Con: ${grupo.map(esc).join(', ')}` : 'Solo'} ${pildorasFaltas(u.responsable_id)}</span></span>
      <span class="reloj mono">${duracion(t.min)}${m.limite_min ? `<small>de ${duracion(m.limite_min)}</small>` : ''}</span>
    </div>
    <p class="resumen">Empezó a las ${horaDe(u.turno_inicio || u.inicio)} · lo entregó ${esc(u.abierto_por || '—')}</p>
    ${t.clase === 'pasado' ? `<div class="alerta alerta-duplicado">⏱ <b>Se han pasado del tiempo</b> y hay ${esp} grupo${esp > 1 ? 's' : ''} esperando. Que vengan a recepción a entregarlo.</div>` : ''}
    <button class="btn ${t.clase === 'pasado' ? 'btn-llama' : 'btn-verde'} btn-grande" id="eu-devolver">📥 Recibir y revisar</button>
    <div class="fila-botones">
      <button class="btn btn-borde" id="eu-espera">⏳ + Apuntar a la espera</button>
      <button class="btn btn-borde" id="eu-cambiar">🔁 Solo responsable</button>
    </div>
    ${htmlEspera(m)}
    <button class="btn-enlace" id="eu-ficha">Ver ficha de ${esc(nombreDe(u.responsable_id))}</button>`);
  $('#eu-devolver').addEventListener('click', () => abrirDevolver(m, u));
  $('#eu-cambiar').addEventListener('click', () => abrirCambio(m, u));
  $('#eu-espera').addEventListener('click', () => abrirApuntarEspera(m, () => abrirEnUso(m, usoAbierto(m.id) || u)));
  $('#eu-ficha').addEventListener('click', () => abrirFicha(u.responsable_id));
  enlazarEspera(m, () => abrirEnUso(m, usoAbierto(m.id) || u));
}

/* ---------- Devolver (se acaba el uso, con revisión) ---------- */
function abrirDevolver(m, u) {
  let estado = 'bien';
  let grav = 'leve';
  const anterior = E.usos.find(x => x.material_id === m.id && x.fin && x.id !== u.id);
  abrirModal(`📥 Recibir ${m.nombre}`, `
    <p class="resumen">Que <b>${esc(nombreDe(u.responsable_id))}</b> lo entregue en recepción. Revisad que esté todo como se dio.</p>
    <div class="devol" role="radiogroup" aria-label="Estado">
      <button type="button" data-d="bien" class="on" role="radio" aria-checked="true"><span>✅</span>Todo bien</button>
      <button type="button" data-d="danado" role="radio" aria-checked="false"><span>⚠️</span>Algo roto</button>
      <button type="button" data-d="perdido" role="radio" aria-checked="false"><span>❌</span>Falta algo</button>
    </div>
    <div id="dv-mal" class="oculto columna">
      <label>¿Qué ha pasado?<textarea id="dv-nota" maxlength="300" placeholder="Ej. Falta una bola / mando con un botón roto"></textarea></label>
      <div class="alerta alerta-suave">
        Responsable: <b>${esc(nombreDe(u.responsable_id))}</b>. ${textoFaltasPrevias(u.responsable_id)}.
        ${anterior ? `<br>Antes lo tuvo <b>${esc(nombreDe(anterior.responsable_id))}</b> (${fechaCorta(anterior.fecha)}): ${(DEVOL[anterior.devolucion] || DEVOL.bien).txt.toLowerCase()}.` : ''}
      </div>
      <label class="check"><input type="checkbox" id="dv-falta" checked> Poner falta a ${esc(nombreDe(u.responsable_id))}</label>
      <div class="grav" id="dv-grav" role="radiogroup" aria-label="Gravedad">
        <button type="button" data-g="leve" class="on" role="radio" aria-checked="true">Leve</button>
        <button type="button" data-g="moderada" role="radio" aria-checked="false">Moderada</button>
        <button type="button" data-g="grave" role="radio" aria-checked="false">Grave</button>
      </div>
    </div>
    <button class="btn btn-verde btn-grande" id="dv-ok">Recibido, queda libre</button>
    <button class="btn btn-borde" id="dv-volver">Volver</button>`);

  $$('.devol button').forEach(b => b.addEventListener('click', () => {
    estado = b.dataset.d;
    $$('.devol button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    $('#dv-mal').classList.toggle('oculto', estado === 'bien');
    $('#dv-ok').className = 'btn btn-grande ' + (estado === 'bien' ? 'btn-verde' : 'btn-llama');
    if (estado === 'perdido' && grav === 'leve') $('#dv-grav [data-g=moderada]').click();
  }));
  $$('#dv-grav button').forEach(b => b.addEventListener('click', () => {
    grav = b.dataset.g;
    $$('#dv-grav button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
  }));
  $('#dv-falta').addEventListener('change', () => $('#dv-grav').classList.toggle('oculto', !$('#dv-falta').checked));
  $('#dv-volver').addEventListener('click', () => abrirEnUso(m, u));

  $('#dv-ok').addEventListener('click', async (ev) => {
    const nota = estado === 'bien' ? null : $('#dv-nota').value.trim();
    if (estado !== 'bien' && (!nota || nota.length < 2)) { aviso('Escribe qué ha pasado', true); $('#dv-nota').focus(); return; }
    const btn = ev.currentTarget; btn.disabled = true;
    try {
      let faltaId = null;
      if (estado !== 'bien' && $('#dv-falta').checked) {
        const motivo = `${m.nombre}: ${estado === 'perdido' ? 'falta material' : 'devuelto roto'} — ${nota}`.slice(0, 300);
        const { data: f, error: ef } = await E.sb.from('cj_faltas')
          .insert({ chaval_id: u.responsable_id, gravedad: grav, motivo, fecha: hoyISO() })
          .select('id,chaval_id,fecha,gravedad,motivo,puesta_por').single();
        if (ef) throw ef;
        E.faltas.unshift(f);
        faltaId = f.id;
      }
      const { data, error } = await E.sb.from('cj_usos')
        .update({ fin: new Date().toISOString(), devolucion: estado, nota, falta_id: faltaId, cerrado_por: E.usuario.nombre })
        .eq('id', u.id).is('fin', null).select(USOS_CAMPOS).single();
      if (error) throw error;
      Object.assign(u, data);
      vibrar(estado === 'bien' ? 30 : 80);
      pintarTodo();
      const esp = esperaDe(m.id).length;
      const sig = esp ? ` · siguiente: ${nombreDe(esperaDe(m.id)[0].responsable_id)}` : '';
      aviso(estado === 'bien' ? `${m.nombre} libre ✅${sig}` : `${m.nombre} con incidencia${faltaId ? ' y falta apuntada' : ''}${sig}`, estado !== 'bien');
      cerrarModal();
    } catch (e) {
      btn.disabled = false;
      aviso(errorHumano(e), true);
      refrescar(true);
    }
  });
}

/* ---------- Cambiar solo el responsable (mismo grupo, el tiempo sigue) ---------- */
function abrirCambio(m, u) {
  const actuales = personas(u);
  abrirModal(`🔁 Responsable · ${m.nombre}`, `
    <div class="alerta alerta-suave">Sigue el <b>mismo turno</b>: el reloj no se reinicia (${duracion(minutosDesde(u.turno_inicio))}). Tienen que venir <b>los dos a recepción</b>.</div>
    <div id="cb-sel"></div>
    <label class="check"><input type="checkbox" id="cb-ok"> Lo hemos revisado con los dos y está todo bien</label>
    <p class="resumen">Si algo está roto o falta, pulsa <b>Volver</b> y haz <b>Devolver y revisar</b> para que la falta sea de quien lo tenía.</p>
    <button class="btn btn-verde btn-grande" id="cb-guardar" disabled>Guardar cambio</button>
    <button class="btn btn-borde" id="cb-volver">Volver</button>`);
  // Empieza con el grupo actual; toca 🔑 en quien pasa a ser responsable. Se puede quitar a quien se va.
  const sel = selectorGrupo($('#cb-sel'), {
    mid: m.id,
    iniciales: actuales,
    bloqueo: { ignorarUso: u.id },
    alCambiar: s => validar(s)
  });
  function validar(s = sel?.valor() || actuales) {
    const ok = s.length && s[0] !== u.responsable_id && $('#cb-ok')?.checked;
    if ($('#cb-guardar')) $('#cb-guardar').disabled = !ok;
  }
  $('#cb-ok').addEventListener('change', () => validar());
  $('#cb-volver').addEventListener('click', () => abrirEnUso(m, u));
  $('#cb-guardar').addEventListener('click', async (ev) => {
    const ids = sel.valor();
    if (!ids.length || ids[0] === u.responsable_id) { aviso('Toca la 🔑 del nuevo responsable', true); return; }
    const mal = sel.errores();
    if (mal.length) { aviso(`${nombreDe(mal[0][0])}: ${mal[0][1]}`, true); return; }
    const btn = ev.currentTarget; btn.disabled = true;
    try {
      const { data: c, error: e1 } = await E.sb.from('cj_usos')
        .update({ fin: new Date().toISOString(), devolucion: 'cambio', nota: `Pasa a ${nombreDe(ids[0])}`, cerrado_por: E.usuario.nombre })
        .eq('id', u.id).is('fin', null).select(USOS_CAMPOS).single();
      if (e1) throw e1;
      Object.assign(u, c);
      const { data, error } = await E.sb.from('cj_usos')
        .insert({ material_id: m.id, responsable_id: ids[0], grupo: ids.slice(1), fecha: hoyISO(), turno_inicio: u.turno_inicio })
        .select(USOS_CAMPOS).single();
      if (error) throw error;
      E.usos.unshift(data);
      await asegurarEntradaHoy(ids);
      vibrar();
      cerrarModal();
      aviso(`${m.nombre}: ahora el responsable es ${nombreDe(ids[0])} 🔑`);
      pintarTodo();
    } catch (e) {
      btn.disabled = false;
      aviso(errorHumano(e), true);
      refrescar(true);
    }
  });
}

/* ---------- Reloj: repinta los juegos cada 20 s ---------- */
setInterval(() => {
  if (!document.hidden && E.usuario && E.vista === 'material') pintarMaterial();
}, 20000);
