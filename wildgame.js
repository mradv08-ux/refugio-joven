'use strict';
/* =========================================================
   Wild Game · panel del equipo (refugio-joven)
   Inscritos, juegos de cada día y eliminaciones.
   ========================================================= */
const WGE = { cfg: null, dias: [], jug: [], diaElim: null, editando: null, borrar: null };

async function cargarWild() {
  const [c, d, j] = await Promise.all([
    E.sb.from('cj_wg_config').select('*').eq('id', 1).maybeSingle(),
    E.sb.from('cj_wg_dias').select('*').order('fecha').order('id'),
    E.sb.from('cj_wg_jugadores').select('*').order('num')
  ]);
  for (const r of [c, d, j]) if (r.error) throw r.error;
  WGE.cfg = c.data; WGE.dias = d.data; WGE.jug = j.data;
}

function datosWild() {
  const dia = id => WGE.dias.find(x => x.id === id);
  return {
    hoy: hoyISO(), inicio: WGE.cfg.inicio, intro: WGE.cfg.intro, inscripciones: WGE.cfg.inscripciones,
    dias: WGE.dias.map(x => ({ ...x, caidos: WGE.jug.filter(j => j.eliminado_dia === x.id && !j.salio_en).length })),
    jugadores: WGE.jug.filter(j => !j.salio_en).map(j => {
      const c = chaval(j.chaval_id) || { nombre: '¿?' }, d = dia(j.eliminado_dia);
      return { id: j.chaval_id, num: j.num, nombre: c.nombre, eliminado: !!j.eliminado_en, en: j.eliminado_en, juego: d && d.juego, fecha: d && d.fecha };
    })
  };
}

function pintarWild() {
  const activo = !!(WGE.cfg && WGE.cfg.activo);
  $('#tab-wild').classList.toggle('oculto', !activo);
  if (!activo) { if (E.vista === 'wild') cambiarVista('puerta'); return; }
  const d = datosWild(), hoy = hoyISO();
  const pasados = WGE.dias.filter(x => x.fecha <= hoy);
  const porDefecto = WGE.diaElim && WGE.dias.some(x => x.id === WGE.diaElim) ? WGE.diaElim : (pasados.length ? pasados[pasados.length - 1].id : (WGE.dias[0] || {}).id);
  const ed = WGE.editando && WGE.dias.find(x => x.id === WGE.editando);
  const botones = j => j.eliminado
    ? `<button class="btn btn-borde" data-wg-revivir="${j.id}">Revivir</button>`
    : `<button class="btn btn-peligro" data-wg-eliminar="${j.id}">Eliminar</button>`;
  const inscritos = new Set(WGE.jug.map(j => j.chaval_id));

  $('#vista-wild').innerHTML = WG.cabecera(d) + `
    <h2 class="seccion">Control</h2>
    <div class="tarjeta form wg-control">
      <label class="wg-check"><input type="checkbox" id="wg-insc" ${WGE.cfg.inscripciones ? 'checked' : ''}> Inscripciones abiertas</label>
      <label>Día de inicio<input type="date" id="wg-inicio" value="${WGE.cfg.inicio || ''}"></label>
      <label>Al pulsar «Eliminar», cae en:
        <select id="wg-dia-elim">${WGE.dias.slice().reverse().map(x => `<option value="${x.id}" ${x.id === porDefecto ? 'selected' : ''}>${esc(x.juego)} · ${fechaCorta(x.fecha)}</option>`).join('') || '<option value="">Primero añade un juego</option>'}</select></label>
    </div>
    ${WG.rejilla(d, botones)}
    <h2 class="seccion">Inscribir a un chaval</h2>
    <div class="tarjeta form wg-control">
      <input id="wg-buscar" placeholder="Busca por nombre" autocomplete="off">
      <div id="wg-resultados" class="lista"></div>
    </div>
    <h2 class="seccion" id="wg-form-tit">${ed ? 'Editar juego' : 'Añadir juego del día'}</h2>
    <form class="tarjeta form wg-control" id="wg-form">
      <label>Día<input type="date" id="wg-fecha" required value="${ed ? ed.fecha : hoy}"></label>
      <label>Nombre del juego<input id="wg-juego" required maxlength="80" placeholder="Ej.: Luz roja, luz verde" value="${esc(ed ? ed.juego : '')}"></label>
      <label>Explicación y normas<textarea id="wg-normas" rows="6" maxlength="3000" placeholder="Cómo se juega, qué está prohibido y cuándo se elimina a alguien">${esc(ed ? ed.normas : '')}</textarea></label>
      <div class="fila-botones">${ed ? '<button type="button" class="btn btn-borde" data-wg-cancelar>Cancelar</button>' : ''}<button class="btn btn-verde" type="submit">${ed ? 'Guardar' : 'Añadir juego'}</button></div>
      <p class="resumen">Los chavales solo ven cada juego a partir de su día.</p>
    </form>
    <div class="lista">${WGE.dias.slice().reverse().map(x => `<div class="fila-turno"><div style="flex:1"><b>${esc(x.juego)}</b><div class="resumen">${fechaCorta(x.fecha)}${x.fecha > hoy ? ' · aún oculto' : ''} · ${d.dias.find(y => y.id === x.id).caidos} eliminados</div></div>
      <button class="btn btn-borde btn-peq" data-wg-editar="${x.id}">Editar</button><button class="btn btn-peligro btn-peq" data-wg-borrar="${x.id}">${WGE.borrar === x.id ? '¿Seguro?' : 'Quitar'}</button></div>`).join('')}</div>
    <h2 class="seccion">Inscritos <span class="mono">(${WGE.jug.length})</span></h2>
    <div class="tarjeta"><ol class="wg-inscritos">${WGE.jug.map(j => `<li><span class="mono">${WG.num(j.num)}</span> ${esc((chaval(j.chaval_id) || {}).nombre || '¿?')}${j.salio_en ? ' <small class="resumen">· se salió</small>' : j.eliminado_en ? ' <small class="resumen">· eliminado</small>' : ''}</li>`).join('') || '<li class="resumen">Nadie todavía.</li>'}</ol></div>`;
  pintarBusquedaWild();
}

function pintarBusquedaWild() {
  const cont = $('#wg-resultados'); if (!cont) return;
  const n = normal($('#wg-buscar').value);
  if (!n) { cont.innerHTML = ''; return; }
  const activos = new Set(WGE.jug.filter(j => !j.salio_en).map(j => j.chaval_id));
  cont.innerHTML = E.chavales.filter(c => normal(c.nombre).includes(n)).slice(0, 6).map(c => `<div class="fila-chaval">
    <div class="avatar">${inicial(c.nombre)}</div><div class="info"><span class="nombre">${esc(c.nombre)}</span><span class="meta">${c.edad} años</span></div>
    ${activos.has(c.id) ? '<span class="resumen">Ya está</span>' : `<button class="btn btn-verde btn-peq" data-wg-inscribir="${c.id}">Inscribir</button>`}</div>`).join('') || '<p class="resumen">No hay nadie con ese nombre.</p>';
}

async function accionWild(fn, ok) {
  try { await fn(); await cargarWild(); pintarWild(); if (ok) aviso(ok); }
  catch (e) { aviso(errorHumano(e), true); }
}

function enlazarWild() {
  const v = $('#vista-wild');
  v.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.wgEliminar) {
      const dia = Number(($('#wg-dia-elim') || {}).value);
      if (!dia) return aviso('Primero añade el juego del día.', true);
      vibrar(60);
      accionWild(() => E.sb.from('cj_wg_jugadores').update({ eliminado_dia: dia, eliminado_en: new Date().toISOString() }).eq('chaval_id', d.wgEliminar).then(r => { if (r.error) throw r.error; }), '💀 Eliminado');
    } else if (d.wgRevivir) {
      accionWild(() => E.sb.from('cj_wg_jugadores').update({ eliminado_dia: null, eliminado_en: null }).eq('chaval_id', d.wgRevivir).then(r => { if (r.error) throw r.error; }), 'Vuelve a estar en juego');
    } else if (d.wgInscribir) {
      const id = Number(d.wgInscribir), ya = WGE.jug.find(j => j.chaval_id === id);
      const n = WGE.jug.reduce((m, j) => Math.max(m, j.num), 0) + 1;
      accionWild(() => (ya ? E.sb.from('cj_wg_jugadores').update({ salio_en: null }).eq('chaval_id', id) : E.sb.from('cj_wg_jugadores').insert({ chaval_id: id, num: n })).then(r => { if (r.error) throw r.error; }), 'Inscrito');
      $('#wg-buscar').value = '';
    } else if (d.wgEditar) {
      WGE.editando = Number(d.wgEditar); pintarWild(); $('#wg-form-tit').scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else if ('wgCancelar' in d) {
      WGE.editando = null; pintarWild();
    } else if (d.wgBorrar) {
      const id = Number(d.wgBorrar);
      if (WGE.borrar !== id) { WGE.borrar = id; return pintarWild(); }
      WGE.borrar = null;
      accionWild(() => E.sb.from('cj_wg_dias').delete().eq('id', id).then(r => { if (r.error) throw r.error; }), 'Juego quitado');
    }
  });
  v.addEventListener('input', ev => { if (ev.target.id === 'wg-buscar') pintarBusquedaWild(); });
  v.addEventListener('change', ev => {
    const t = ev.target;
    if (t.id === 'wg-dia-elim') WGE.diaElim = Number(t.value);
    if (t.id === 'wg-insc') accionWild(() => E.sb.from('cj_wg_config').update({ inscripciones: t.checked }).eq('id', 1).then(r => { if (r.error) throw r.error; }), t.checked ? 'Inscripciones abiertas' : 'Inscripciones cerradas');
    if (t.id === 'wg-inicio') accionWild(() => E.sb.from('cj_wg_config').update({ inicio: t.value || null }).eq('id', 1).then(r => { if (r.error) throw r.error; }), 'Fecha de inicio guardada');
  });
  v.addEventListener('submit', ev => {
    if (ev.target.id !== 'wg-form') return;
    ev.preventDefault();
    const datos = { fecha: $('#wg-fecha').value, juego: $('#wg-juego').value.trim(), normas: $('#wg-normas').value.trim() };
    if (!datos.fecha || !datos.juego) return aviso('Pon el día y el nombre del juego.', true);
    const id = WGE.editando;
    accionWild(async () => {
      const r = id ? await E.sb.from('cj_wg_dias').update(datos).eq('id', id) : await E.sb.from('cj_wg_dias').insert(datos);
      if (r.error) throw r.error;
      WGE.editando = null;
    }, id ? 'Juego guardado' : (datos.fecha > hoyISO() ? 'Juego añadido · lo verán ese día' : 'Juego añadido'));
  });
}
