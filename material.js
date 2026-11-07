'use strict';
/* =========================================================
   Refugio Joven · Material del centro
   Billar, ordenadores, futbolín, PS5 y ping pong.
   Cada uso tiene UN responsable que lo devuelve como estaba.
   Para cambiar de responsable vienen los dos a recepción.
   (Usa E, $, $$, esc… definidos en app.js)
   ========================================================= */

const USOS_CAMPOS = 'id,material_id,responsable_id,grupo,fecha,inicio,fin,devolucion,nota,falta_id,abierto_por,cerrado_por';
const DEVOL = {
  bien:    { txt: 'Devuelto bien', ico: '✅', c: 'var(--green)' },
  danado:  { txt: 'Devuelto con daños', ico: '⚠️', c: 'var(--flame)' },
  perdido: { txt: 'Perdido / falta algo', ico: '❌', c: 'var(--grave)' },
  cambio:  { txt: 'Cambio de responsable', ico: '🔁', c: 'var(--gold)' }
};

/* ---------- Consultas ---------- */
function materialPorId(id) { return E.material.find(m => m.id === id); }
function usoAbierto(mid) { return E.usos.find(u => u.material_id === mid && !u.fin); }
function usosAbiertosDe(cid) { return E.usos.filter(u => !u.fin && (u.responsable_id === cid || (u.grupo || []).includes(cid))); }
function dentroHoy() {
  const hoy = hoyISO();
  return new Set(E.entradas.filter(e => e.fecha === hoy).map(e => e.chaval_id));
}
function minutosDesde(ts) { return Math.max(0, Math.round((Date.now() - new Date(ts)) / 60000)); }
function duracion(min) { return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`; }
function nombreDe(id) { return chaval(id)?.nombre || '¿?'; }
function textoFaltasPrevias(cid) {
  const r = resumenFaltas(cid);
  const t = ['leve', 'moderada', 'grave'].filter(g => r[g]).map(g => `${r[g]} ${g}${r[g] > 1 ? 's' : ''}`);
  return t.length ? `Ya tenía: <b>${t.join(', ')}</b>` : 'No tenía faltas';
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
function pintarMaterial() {
  const grid = $('#material-grid');
  if (!grid) return;
  grid.innerHTML = E.material.map(m => {
    const u = usoAbierto(m.id);
    if (!u) {
      return `<button class="puesto libre" data-material="${esc(m.id)}" aria-label="${esc(m.nombre)}: libre. Pulsa para dejarlo">
        <span class="ico">${m.icono}</span><span class="tit">${esc(m.nombre)}</span>
        <span class="estado">● Libre</span><span class="det">Toca para dejarlo</span>
      </button>`;
    }
    const grave = resumenFaltas(u.responsable_id).grave > 0;
    const n = (u.grupo || []).length;
    return `<button class="puesto ocupado" data-material="${esc(m.id)}" aria-label="${esc(m.nombre)}: en uso por ${esc(nombreDe(u.responsable_id))}">
      ${grave ? '<span class="alarma" title="El responsable tiene faltas graves">🚨</span>' : ''}
      <span class="ico">${m.icono}</span><span class="tit">${esc(m.nombre)}</span>
      <span class="estado">● En uso · ${duracion(minutosDesde(u.inicio))}</span>
      <span class="resp">🔑 ${esc(nombreDe(u.responsable_id))}</span>
      <span class="det">${n ? `+${n} en el grupo` : 'Solo'} · desde ${horaDe(u.inicio)}</span>
    </button>`;
  }).join('');

  // Movimientos de hoy
  const hoy = hoyISO();
  const deHoy = E.usos.filter(u => u.fecha === hoy);
  $('#material-hoy-num').textContent = deHoy.length ? `(${deHoy.length})` : '';
  $('#material-historial').innerHTML = deHoy.length ? deHoy.map(htmlMovimiento).join('')
    : '<div class="vacio"><b>Nada prestado hoy</b>Toca una de las cosas de arriba cuando alguien la pida.</div>';
}

function htmlMovimiento(u, conMaterial = true) {
  const m = materialPorId(u.material_id) || { icono: '❔', nombre: u.material_id };
  const d = u.fin ? DEVOL[u.devolucion] || DEVOL.bien : null;
  const grupo = (u.grupo || []).map(nombreDe);
  return `<div class="mov" style="--c:${d ? d.c : 'var(--flame-hi)'}">
    <span class="ico">${conMaterial ? m.icono : (d ? d.ico : '⏳')}</span>
    <div class="info">
      <span class="nombre">${conMaterial ? esc(m.nombre) + ' · ' : ''}🔑 ${esc(nombreDe(u.responsable_id))}</span>
      <span class="meta mono">${conMaterial ? '' : fechaCorta(u.fecha) + ' · '}${horaDe(u.inicio)}–${u.fin ? horaDe(u.fin) : 'ahora'}</span>
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
  if (u) abrirEnUso(m, u); else abrirPrestar(m);
}

/* ---------- Selector de chaval (buscador + lista) ---------- */
// cont: elemento donde pintar; excluir: ids a ocultar; alElegir(id)
function selectorChaval(cont, { excluir = [], alElegir, placeholder = 'Busca al responsable…' }) {
  cont.innerHTML = `<input type="search" class="sel-buscar" placeholder="${esc(placeholder)}" autocomplete="off" aria-label="Buscar chaval">
    <div class="lista-elegir"></div>`;
  const inp = $('.sel-buscar', cont);
  const lista = $('.lista-elegir', cont);
  const pintar = () => {
    const n = normal(inp.value);
    const dentro = dentroHoy();
    let res = E.chavales.filter(c => !excluir.includes(c.id) && (!n || normal(c.nombre).includes(n)));
    if (!n) res = res.filter(c => dentro.has(c.id));
    res.sort((a, b) => (dentro.has(b.id) - dentro.has(a.id)) || a.nombre.localeCompare(b.nombre, 'es'));
    lista.innerHTML = res.slice(0, 30).map(c => `
      <button type="button" class="opcion" data-elegir="${c.id}">
        <span class="avatar">${inicial(c.nombre)}</span>
        <span class="info"><span class="nombre">${esc(c.nombre)}</span>
          <span class="meta">${c.edad} años ${dentro.has(c.id) ? '<span class="etq-dentro">· dentro</span>' : ''} ${pildorasFaltas(c.id)} ${iconosUso(c.id)}</span></span>
      </button>`).join('')
      || `<p class="resumen">${n ? 'No hay nadie con ese nombre. Apúntalo primero en Puerta.' : 'No hay nadie dentro hoy. Escribe un nombre para buscar.'}</p>`;
  };
  inp.addEventListener('input', pintar);
  lista.addEventListener('click', ev => {
    const b = ev.target.closest('[data-elegir]');
    if (b) alElegir(Number(b.dataset.elegir));
  });
  pintar();
}

function tarjetaElegido(cid, etiqueta = 'Responsable') {
  const c = chaval(cid);
  const r = resumenFaltas(cid);
  const otros = E.usos.filter(u => !u.fin && u.responsable_id === cid).map(u => materialPorId(u.material_id)?.nombre).filter(Boolean);
  return `<div class="elegido">
      <span class="avatar">${inicial(c.nombre)}</span>
      <span class="info"><span class="etiqueta">${esc(etiqueta)}</span><span class="nombre">${esc(c.nombre)}</span>
        <span class="meta">${c.edad} años ${pildorasFaltas(cid)}</span></span>
      <button type="button" class="btn btn-borde" data-cambiar-elegido>Cambiar</button>
    </div>
    ${r.grave ? `<div class="alerta alerta-duplicado">🚨 <b>Ojo:</b> tiene ${r.grave} falta${r.grave > 1 ? 's' : ''} grave${r.grave > 1 ? 's' : ''}. Valorad si puede ser responsable.</div>` : ''}
    ${otros.length ? `<div class="alerta alerta-suave">Ya es responsable de: <b>${otros.map(esc).join(', ')}</b>.</div>` : ''}`;
}

// Da entrada de hoy si alguien coge material sin haberse apuntado en la puerta
async function asegurarEntradaHoy(ids) {
  const hoy = hoyISO();
  const yaDentro = dentroHoy();
  const faltan = ids.filter(id => !yaDentro.has(id));
  if (!faltan.length) return;
  const { data, error } = await E.sb.from('cj_entradas')
    .upsert(faltan.map(id => ({ chaval_id: id, fecha: hoy })), { onConflict: 'chaval_id,fecha', ignoreDuplicates: true })
    .select('id,chaval_id,fecha,hora,registrado_por');
  if (!error && data) E.entradas.unshift(...data);
}

/* ---------- Prestar (puesto libre) ---------- */
function abrirPrestar(m, grupoInicial = []) {
  let resp = null;
  const grupo = new Set(grupoInicial);
  abrirModal(`${m.icono} ${m.nombre}`, `
    <p class="pasos"><span>1. Responsable</span><span class="flecha">→</span><span>2. Grupo</span><span class="flecha">→</span><span>3. Entregar</span></p>
    <div id="pr-resp"></div>
    <div id="pr-grupo" class="oculto">
      <span class="etiqueta">¿Quién más juega? (opcional)</span>
      <div class="grupo-chips" id="pr-chips" style="margin-top:6px"></div>
      <details style="margin-top:8px"><summary class="resumen" style="cursor:pointer">Añadir a alguien que no está en la lista</summary>
        <div id="pr-mas" style="margin-top:8px"></div></details>
    </div>
    <label class="check oculto" id="pr-check"><input type="checkbox" id="pr-ok"> Le he explicado que lo devuelve como está y que, si se cambia, vienen los dos a recepción</label>
    <button class="btn btn-verde btn-grande" id="pr-entregar" disabled>Entregar ${esc(m.nombre)}</button>`);

  const pintarResp = () => {
    const cont = $('#pr-resp');
    if (!resp) {
      $('#pr-grupo').classList.add('oculto'); $('#pr-check').classList.add('oculto');
      selectorChaval(cont, { alElegir: id => { resp = id; grupo.delete(id); pintarResp(); } });
      setTimeout(() => $('.sel-buscar', cont)?.focus(), 250);
    } else {
      cont.innerHTML = tarjetaElegido(resp);
      $('[data-cambiar-elegido]', cont).addEventListener('click', () => { resp = null; pintarResp(); });
      $('#pr-grupo').classList.remove('oculto'); $('#pr-check').classList.remove('oculto');
      pintarGrupo();
    }
    validar();
  };
  const pintarGrupo = () => {
    const dentro = [...dentroHoy()].filter(id => id !== resp);
    const ids = [...new Set([...dentro, ...grupo])].filter(id => chaval(id));
    ids.sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es'));
    $('#pr-chips').innerHTML = ids.map(id => `<button type="button" class="chip ${grupo.has(id) ? 'on' : ''}" data-g="${id}" aria-pressed="${grupo.has(id)}">${esc(nombreDe(id))}</button>`).join('')
      || '<span class="resumen">No hay más chavales dentro hoy.</span>';
    $$('#pr-chips [data-g]').forEach(b => b.addEventListener('click', () => {
      const id = Number(b.dataset.g);
      grupo.has(id) ? grupo.delete(id) : grupo.add(id);
      pintarGrupo();
    }));
  };
  selectorChaval($('#pr-mas'), {
    excluir: [], placeholder: 'Buscar para añadir al grupo…',
    alElegir: id => { if (id !== resp) { grupo.add(id); pintarGrupo(); } }
  });
  const validar = () => { $('#pr-entregar').disabled = !(resp && $('#pr-ok').checked); };
  $('#pr-ok').addEventListener('change', validar);

  $('#pr-entregar').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget; btn.disabled = true;
    try {
      const { data, error } = await E.sb.from('cj_usos')
        .insert({ material_id: m.id, responsable_id: resp, grupo: [...grupo], fecha: hoyISO() })
        .select(USOS_CAMPOS).single();
      if (error) throw error;
      E.usos.unshift(data);
      await asegurarEntradaHoy([resp, ...grupo]);
      vibrar();
      cerrarModal();
      aviso(`${m.nombre} entregado a ${nombreDe(resp)} 🔑`);
      pintarTodo();
    } catch (e) {
      btn.disabled = false;
      if (e.code === '23505') { await refrescar(true); cerrarModal(); aviso('Alguien acaba de prestarlo. Mira quién lo tiene.', true); }
      else aviso(errorHumano(e), true);
    }
  });
  pintarResp();
}

/* ---------- Puesto en uso ---------- */
function abrirEnUso(m, u) {
  const grupo = (u.grupo || []).map(nombreDe);
  abrirModal(`${m.icono} ${m.nombre}`, `
    <div class="elegido" style="border-color:var(--flame);background:rgba(240,106,18,.12)">
      <span class="avatar">${inicial(nombreDe(u.responsable_id))}</span>
      <span class="info"><span class="etiqueta">Responsable</span><span class="nombre">${esc(nombreDe(u.responsable_id))}</span>
        <span class="meta">Desde las ${horaDe(u.inicio)} · ${duracion(minutosDesde(u.inicio))} ${pildorasFaltas(u.responsable_id)}</span></span>
    </div>
    <p class="resumen">${grupo.length ? `Con: <b>${grupo.map(esc).join(', ')}</b>` : 'Lo usa solo.'} · Lo entregó ${esc(u.abierto_por || '—')}</p>
    <button class="btn btn-verde btn-grande" id="eu-devolver">Devolver y revisar</button>
    <button class="btn btn-borde btn-grande" id="eu-cambiar">🔁 Cambiar de responsable</button>
    <button class="btn-enlace" id="eu-ficha">Ver ficha de ${esc(nombreDe(u.responsable_id))}</button>`);
  $('#eu-devolver').addEventListener('click', () => abrirDevolver(m, u));
  $('#eu-cambiar').addEventListener('click', () => abrirCambio(m, u));
  $('#eu-ficha').addEventListener('click', () => abrirFicha(u.responsable_id));
}

/* ---------- Devolver ---------- */
function abrirDevolver(m, u) {
  let estado = 'bien';
  let grav = 'leve';
  const anterior = E.usos.find(x => x.material_id === m.id && x.fin && x.id !== u.id);
  abrirModal(`Devolver ${m.nombre}`, `
    <p class="resumen">Revisa que esté todo como se entregó.</p>
    <div class="devol" role="radiogroup" aria-label="Estado">
      <button type="button" data-d="bien" class="on" role="radio" aria-checked="true"><span>✅</span>Todo bien</button>
      <button type="button" data-d="danado" role="radio" aria-checked="false"><span>⚠️</span>Algo roto</button>
      <button type="button" data-d="perdido" role="radio" aria-checked="false"><span>❌</span>Falta algo</button>
    </div>
    <div id="dv-mal" class="oculto" style="display:flex;flex-direction:column;gap:10px">
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
    <button class="btn btn-verde btn-grande" id="dv-ok">Confirmar devolución</button>
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
      cerrarModal();
      aviso(estado === 'bien' ? `${m.nombre} devuelto. Todo en orden ✅` : `${m.nombre} devuelto con incidencia${faltaId ? ' y falta apuntada' : ''}`, estado !== 'bien');
      pintarTodo();
    } catch (e) {
      btn.disabled = false;
      aviso(errorHumano(e), true);
      refrescar(true);
    }
  });
}

/* ---------- Cambio de responsable (en recepción) ---------- */
function abrirCambio(m, u) {
  let nuevo = null;
  abrirModal(`🔁 Cambio en ${m.nombre}`, `
    <div class="alerta alerta-suave">Tienen que estar <b>los dos en recepción</b>: ${esc(nombreDe(u.responsable_id))} y el nuevo responsable.</div>
    <p class="pasos"><span>${esc(nombreDe(u.responsable_id))}</span><span class="flecha">→</span><span id="cb-nuevo-txt">¿?</span></p>
    <div id="cb-resp"></div>
    <label class="check"><input type="checkbox" id="cb-ok"> Lo hemos revisado con los dos y está todo bien</label>
    <p class="resumen">Si algo está roto o falta, no hagas el cambio: pulsa <b>Volver</b> y haz <b>Devolver y revisar</b> para que la falta sea de quien lo tenía.</p>
    <button class="btn btn-verde btn-grande" id="cb-guardar" disabled>Hacer el cambio</button>
    <button class="btn btn-borde" id="cb-volver">Volver</button>`);
  const pintar = () => {
    const cont = $('#cb-resp');
    $('#cb-nuevo-txt').textContent = nuevo ? nombreDe(nuevo) : '¿?';
    if (!nuevo) {
      selectorChaval(cont, { excluir: [u.responsable_id], placeholder: 'Busca al nuevo responsable…', alElegir: id => { nuevo = id; pintar(); } });
    } else {
      cont.innerHTML = tarjetaElegido(nuevo, 'Nuevo responsable');
      $('[data-cambiar-elegido]', cont).addEventListener('click', () => { nuevo = null; pintar(); });
    }
    validar();
  };
  const validar = () => { $('#cb-guardar').disabled = !(nuevo && $('#cb-ok').checked); };
  $('#cb-ok').addEventListener('change', validar);
  $('#cb-volver').addEventListener('click', () => abrirEnUso(m, u));

  $('#cb-guardar').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget; btn.disabled = true;
    try {
      // 1) Se cierra el uso del responsable anterior (revisado, todo bien)
      const { data: cerrado, error: e1 } = await E.sb.from('cj_usos')
        .update({ fin: new Date().toISOString(), devolucion: 'cambio', nota: `Pasa a ${nombreDe(nuevo)}`, cerrado_por: E.usuario.nombre })
        .eq('id', u.id).is('fin', null).select(USOS_CAMPOS).single();
      if (e1) throw e1;
      Object.assign(u, cerrado);
      // 2) Se abre uno nuevo con el nuevo responsable y el mismo grupo
      const grupo = (u.grupo || []).filter(id => id !== nuevo);
      const { data, error } = await E.sb.from('cj_usos')
        .insert({ material_id: m.id, responsable_id: nuevo, grupo, fecha: hoyISO() })
        .select(USOS_CAMPOS).single();
      if (error) throw error;
      E.usos.unshift(data);
      await asegurarEntradaHoy([nuevo]);
      vibrar();
      cerrarModal();
      aviso(`${m.nombre}: ahora el responsable es ${nombreDe(nuevo)} 🔑`);
      pintarTodo();
    } catch (e) {
      btn.disabled = false;
      aviso(errorHumano(e), true);
      refrescar(true);
    }
  });
  pintar();
}
