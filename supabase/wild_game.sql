/* =========================================================
   Wild Game · evento temporal de eliminación del Centro Joven
   Los chavales se inscriben desde Mi Refugio con su código.
   El equipo añade los juegos de cada día y elimina jugadores.
   ========================================================= */

create table if not exists public.cj_wg_config (
  id int primary key default 1 check (id = 1),
  activo boolean not null default false,
  inscripciones boolean not null default true,
  inicio date,
  intro text not null default 'Muchos juegos, un solo superviviente. ¿Aguantarás hasta el final?'
);
insert into public.cj_wg_config (id) values (1) on conflict do nothing;

create table if not exists public.cj_wg_dias (
  id bigint generated always as identity primary key,
  fecha date not null,
  juego text not null check (length(juego) between 1 and 80),
  normas text not null default '' check (length(normas) <= 3000),
  creado timestamptz not null default now()
);

create table if not exists public.cj_wg_jugadores (
  chaval_id bigint primary key references public.cj_chavales(id) on delete cascade,
  num int not null,
  eliminado_dia bigint references public.cj_wg_dias(id) on delete set null,
  eliminado_en timestamptz,
  salio_en timestamptz,
  creado timestamptz not null default now()
);

alter table public.cj_wg_config enable row level security;
alter table public.cj_wg_dias enable row level security;
alter table public.cj_wg_jugadores enable row level security;
create policy cj_wg_config_equipo on public.cj_wg_config for all to authenticated
  using ((select public.cj_es_equipo())) with check ((select public.cj_es_equipo()));
create policy cj_wg_dias_equipo on public.cj_wg_dias for all to authenticated
  using ((select public.cj_es_equipo())) with check ((select public.cj_es_equipo()));
create policy cj_wg_jugadores_equipo on public.cj_wg_jugadores for all to authenticated
  using ((select public.cj_es_equipo())) with check ((select public.cj_es_equipo()));
grant select, insert, update, delete on public.cj_wg_config, public.cj_wg_dias, public.cj_wg_jugadores to authenticated;
revoke all on public.cj_wg_config, public.cj_wg_dias, public.cj_wg_jugadores from anon;

/* ---------- Lo que ve el chaval (solo lectura) ---------- */
create or replace function public.cj_wg_portal(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  cod text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  yo public.cj_chavales; cfg public.cj_wg_config;
  hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  select * into cfg from public.cj_wg_config where id = 1;
  if not found or not cfg.activo then return jsonb_build_object('activo', false); end if;
  select * into yo from public.cj_chavales where codigo = cod;
  if not found then return null; end if;
  return jsonb_build_object(
    'activo', true, 'hoy', hoy, 'inscripciones', cfg.inscripciones, 'inicio', cfg.inicio, 'intro', cfg.intro,
    'dias', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'fecha', d.fecha, 'juego', d.juego, 'normas', d.normas,
                        'caidos', (select count(*) from public.cj_wg_jugadores j where j.eliminado_dia = d.id and j.salio_en is null))
                      order by d.fecha, d.id) from public.cj_wg_dias d where d.fecha <= hoy), '[]'::jsonb),
    'jugadores', coalesce((select jsonb_agg(jsonb_build_object('num', j.num,
                        'nombre', case when j.chaval_id = yo.id then c.nombre else public.cj_nombre_corto(c.nombre) end,
                        'yo', j.chaval_id = yo.id,
                        'eliminado', j.eliminado_en is not null, 'en', j.eliminado_en,
                        'juego', d.juego, 'fecha', d.fecha) order by j.num)
                      from public.cj_wg_jugadores j join public.cj_chavales c on c.id = j.chaval_id
                      left join public.cj_wg_dias d on d.id = j.eliminado_dia
                      where j.salio_en is null), '[]'::jsonb),
    'yo', (select jsonb_build_object('num', j.num, 'salio', j.salio_en is not null, 'eliminado', j.eliminado_en is not null)
           from public.cj_wg_jugadores j where j.chaval_id = yo.id)
  );
end $$;
revoke all on function public.cj_wg_portal(text) from public;
grant execute on function public.cj_wg_portal(text) to anon, authenticated;

/* ---------- El chaval se inscribe o se sale ---------- */
create or replace function public.cj_wg_apuntar(p_codigo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cod text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  yo public.cj_chavales; cfg public.cj_wg_config; n int; j public.cj_wg_jugadores;
begin
  select * into cfg from public.cj_wg_config where id = 1;
  if not found or not cfg.activo then return jsonb_build_object('ok', false, 'motivo', 'inactivo'); end if;
  if not cfg.inscripciones then return jsonb_build_object('ok', false, 'motivo', 'cerrado'); end if;
  select * into yo from public.cj_chavales where codigo = cod;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'codigo'); end if;
  select * into j from public.cj_wg_jugadores where chaval_id = yo.id;
  if found then
    update public.cj_wg_jugadores set salio_en = null where chaval_id = yo.id;
    return jsonb_build_object('ok', true, 'num', j.num);
  end if;
  perform pg_advisory_xact_lock(777001);
  select coalesce(max(num), 0) + 1 into n from public.cj_wg_jugadores;
  insert into public.cj_wg_jugadores (chaval_id, num) values (yo.id, n);
  return jsonb_build_object('ok', true, 'num', n);
end $$;
revoke all on function public.cj_wg_apuntar(text) from public;
grant execute on function public.cj_wg_apuntar(text) to anon, authenticated;

create or replace function public.cj_wg_salir(p_codigo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cod text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  yo public.cj_chavales; j public.cj_wg_jugadores;
begin
  select * into yo from public.cj_chavales where codigo = cod;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'codigo'); end if;
  select * into j from public.cj_wg_jugadores where chaval_id = yo.id;
  if not found then return jsonb_build_object('ok', true); end if;
  if j.eliminado_en is not null then return jsonb_build_object('ok', false, 'motivo', 'eliminado'); end if;
  update public.cj_wg_jugadores set salio_en = now() where chaval_id = yo.id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.cj_wg_salir(text) from public;
grant execute on function public.cj_wg_salir(text) to anon, authenticated;
