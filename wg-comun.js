'use strict';
/* =========================================================
   Wild Game · piezas comunes (Mi Refugio y app del equipo)
   Datos normalizados:
   { hoy, inicio, intro, inscripciones,
     dias: [{ id, fecha, juego, normas, caidos }],           (ordenados por fecha)
     jugadores: [{ num, nombre, yo, eliminado, en, juego, fecha, id }] }
   ========================================================= */
const WG = (() => {
  const e = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => '#' + String(n).padStart(3, '0');
  const f12 = iso => new Date(iso + 'T12:00');
  const larga = iso => f12(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const corta = iso => f12(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
  const SANGRE = '<svg class="wg-sangre" viewBox="0 0 120 60" aria-hidden="true"><path d="M8 30c10-6 22-4 34-8 10-3 18-12 30-10 12 2 22 10 38 8-12 6-22 4-34 10-10 5-16 12-30 12S22 34 8 30z"/><circle cx="96" cy="14" r="4"/><circle cx="20" cy="46" r="3"/><circle cx="62" cy="52" r="2.5"/><path d="M58 40c1 6 0 10-2 14-2-4-3-8-2-14z"/><path d="M84 38c1 4 0 7-1.5 9-1.5-2-2-5-1-9z"/></svg>';

  function cuentas(d) {
    const vivos = d.jugadores.filter(j => !j.eliminado), caidos = d.jugadores.filter(j => j.eliminado);
    const ganador = vivos.length === 1 && caidos.length > 0 ? vivos[0] : null;
    return { vivos, caidos, ganador };
  }
  function inicio(d) {
    if (!d.inicio || d.inicio < d.hoy) return null;
    const n = Math.round((f12(d.inicio) - f12(d.hoy)) / 864e5);
    return { txt: 'Empieza el ' + larga(d.inicio), falta: n === 0 ? '¡Empieza hoy!' : n === 1 ? '¡Empieza mañana!' : `Faltan ${n} días` };
  }
  // Cabecera con cifras. «estado» es el HTML de la zona de inscripción.
  function cabecera(d, estado = '') {
    const { vivos, caidos, ganador } = cuentas(d), ini = inicio(d);
    return `<div class="wg-hero">
      <div class="wg-logo">Wild Game</div>
      <div class="wg-intro">${e(d.intro)}</div>
      ${ini ? `<div class="wg-inicio"><b>${e(ini.txt)}</b><span>${ini.falta}</span></div>` : ''}
      <div class="wg-cifras"><div><b class="mono">${d.jugadores.length}</b><span>inscritos</span></div><div><b class="mono">${vivos.length}</b><span>quedan</span></div><div class="rojo"><b class="mono">${caidos.length}</b><span>eliminados</span></div></div>
      ${ganador ? `<div class="wg-ganador">🏆 ${num(ganador.num)} ${e(ganador.nombre)} es el último superviviente</div>` : ''}
      ${estado ? `<div class="wg-estado">${estado}</div>` : ''}
    </div>`;
  }
  // Juego del día (o el último) y los anteriores. Con «todos», también los futuros.
  function juegos(d, todos = false) {
    const pasados = d.dias.filter(x => x.fecha <= d.hoy), act = pasados[pasados.length - 1], ini = inicio(d);
    let h = `<h2 class="seccion">${!act ? 'Los juegos' : act.fecha === d.hoy ? 'Juego de hoy' : 'Último juego'}</h2>`;
    h += act ? `<div class="tarjeta wg-juego"><div class="wg-fecha">${e(larga(act.fecha))}</div><div class="wg-nombre-juego">${e(act.juego)}</div><div class="wg-normas">${e(act.normas) || '<span class="resumen">Sin normas escritas.</span>'}</div></div>`
      : `<div class="tarjeta"><p class="resumen">${ini ? e(ini.txt) + '. El primer juego se anunciará ese día. ¡Atento!' : 'El primer juego se anunciará pronto. ¡Atento!'}</p></div>`;
    if (pasados.length > 1) h += `<h2 class="seccion">Juegos anteriores</h2><div class="lista">${pasados.slice(0, -1).reverse().map(x =>
      `<details class="tarjeta wg-ant"><summary><span>${e(x.juego)}</span><small>${e(corta(x.fecha))} · ${x.caidos} eliminado${x.caidos === 1 ? '' : 's'}</small></summary><div class="wg-normas">${e(x.normas)}</div></details>`).join('')}</div>`;
    return h;
  }
  // Rejilla de jugadores. «botones(j)» añade controles (solo el equipo).
  function rejilla(d, botones = () => '') {
    const { vivos, caidos, ganador } = cuentas(d);
    const orden = vivos.slice().sort((a, b) => a.num - b.num).concat(caidos.slice().sort((a, b) => String(b.en).localeCompare(String(a.en))));
    return `<h2 class="seccion">Jugadores <span class="mono">(${d.jugadores.length})</span></h2>
      <div class="wg-rejilla">${orden.map(j => `<div class="wg-j${j.eliminado ? ' fuera' : ''}${j.yo ? ' yo' : ''}${ganador === j ? ' gana' : ''}">
        ${j.eliminado ? SANGRE : ''}<span class="n mono">${num(j.num)}</span><span class="nm">${e(j.nombre)}${j.yo ? ' (tú)' : ''}</span>
        ${j.eliminado ? `<span class="cayo">${j.juego ? e(j.juego) + ' · ' + e(corta(j.fecha)) : 'Eliminado'}</span>` : ''}${botones(j)}</div>`).join('')
        || '<p class="resumen">Todavía no se ha inscrito nadie.</p>'}</div>`;
  }
  return { num, larga, corta, cuentas, cabecera, juegos, rejilla, esc: e };
})();
