// Claves PÚBLICAS de Supabase (proyecto Wild Pass). Se pueden ver sin problema:
// la seguridad está en las políticas RLS de la base de datos.
window.CJ_CONFIG = {
  supabaseUrl: 'https://vnrgnagsssooklbgqjbk.supabase.co',
  supabaseKey: 'sb_publishable_jeqsUraKtzVDb9GGaU7ivQ_6gb9t-vw',
  // Días que abre el centro: 0 = domingo, 4 = jueves, 5 = viernes, 6 = sábado
  diasApertura: [4, 5, 6, 0],
  zonaHoraria: 'Europe/Madrid',
  // Pago del equipo: euros por hora y horas de cada día de la semana.
  // Cada horario vale desde su fecha (el más reciente que ya haya empezado).
  // Días: 0 = domingo, 4 = jueves, 5 = viernes, 6 = sábado
  euroHora: 10,
  horarios: [
    { desde: '2000-01-01', horas: { 5: 7, 6: 7, 0: 4 } },        // V y S de 17 a 24 · D de 16 a 20
    { desde: '2026-11-20', horas: { 4: 3, 5: 6, 6: 6, 0: 4 } }   // J de 17 a 20 · V y S de 17 a 23 · D de 16 a 20
  ]
};
