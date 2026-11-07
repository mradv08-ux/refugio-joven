-- =========================================================
--  Centro Joven San Juan del Puerto · The Wild Side
--  Tablas con prefijo cj_ dentro del proyecto Wild Pass.
--  No tocan nada de Wild Pass. Se puede volver a ejecutar.
-- =========================================================

/* ---------- Equipo (quién puede entrar) ---------- */
create table if not exists public.cj_equipo (
  email   text primary key,
  nombre  text not null,
  color   text not null default '#00c837',
  creado  timestamptz not null default now()
);

/* ---------- Chavales ---------- */
create table if not exists public.cj_chavales (
  id      bigint generated always as identity primary key,
  nombre  text not null check (length(trim(nombre)) between 2 and 60),
  edad    smallint not null check (edad between 6 and 35),
  notas   text check (length(notas) <= 500),
  creado  timestamptz not null default now(),
  creado_por text
);
-- Dos chavales no pueden llamarse igual (sin distinguir mayúsculas ni espacios)
create unique index if not exists cj_chavales_nombre_unico
  on public.cj_chavales (lower(trim(nombre)));

/* ---------- Entradas (un registro por chaval y día) ---------- */
create table if not exists public.cj_entradas (
  id        bigint generated always as identity primary key,
  chaval_id bigint not null references public.cj_chavales(id) on delete cascade,
  fecha     date not null default (now() at time zone 'Europe/Madrid')::date,
  hora      timestamptz not null default now(),
  registrado_por text,
  unique (chaval_id, fecha)
);
create index if not exists cj_entradas_fecha on public.cj_entradas (fecha);

/* ---------- Faltas ---------- */
create table if not exists public.cj_faltas (
  id        bigint generated always as identity primary key,
  chaval_id bigint not null references public.cj_chavales(id) on delete cascade,
  fecha     date not null default (now() at time zone 'Europe/Madrid')::date,
  gravedad  text not null check (gravedad in ('leve','moderada','grave')),
  motivo    text not null check (length(trim(motivo)) between 2 and 300),
  puesta_por text,
  creado    timestamptz not null default now()
);
create index if not exists cj_faltas_chaval on public.cj_faltas (chaval_id);

/* ---------- Turnos (quién trabaja cada día) ---------- */
create table if not exists public.cj_turnos (
  fecha date not null,
  email text not null references public.cj_equipo(email) on update cascade on delete cascade,
  primary key (fecha, email)
);

/* ---------- ¿Soy del equipo? ---------- */
-- Solo cuenta si el correo está confirmado, para que nadie se registre con
-- un correo ajeno y se cuele.
create or replace function public.cj_es_equipo()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cj_equipo e
    join auth.users u on lower(u.email) = lower(e.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.cj_es_equipo() from public, anon;
grant execute on function public.cj_es_equipo() to authenticated;

-- Pone automáticamente quién registra cada cosa
create or replace function public.cj_mi_nombre()
returns text language sql stable security definer set search_path = '' as $$
  select e.nombre from public.cj_equipo e
  join auth.users u on lower(u.email) = lower(e.email)
  where u.id = auth.uid();
$$;
revoke all on function public.cj_mi_nombre() from public, anon;
grant execute on function public.cj_mi_nombre() to authenticated;

alter table public.cj_chavales alter column creado_por set default public.cj_mi_nombre();
alter table public.cj_entradas alter column registrado_por set default public.cj_mi_nombre();
alter table public.cj_faltas   alter column puesta_por set default public.cj_mi_nombre();

/* ---------- Seguridad (RLS): solo el equipo ve y toca datos ---------- */
alter table public.cj_equipo   enable row level security;
alter table public.cj_chavales enable row level security;
alter table public.cj_entradas enable row level security;
alter table public.cj_faltas   enable row level security;
alter table public.cj_turnos   enable row level security;

revoke all on public.cj_equipo, public.cj_chavales, public.cj_entradas,
              public.cj_faltas, public.cj_turnos from anon;

drop policy if exists cj_equipo_ver on public.cj_equipo;
create policy cj_equipo_ver on public.cj_equipo
  for select to authenticated using ((select public.cj_es_equipo()));
-- El equipo solo se cambia desde el panel de Supabase (SQL), no desde la app.

do $$
declare t text;
begin
  foreach t in array array['cj_chavales','cj_entradas','cj_faltas','cj_turnos'] loop
    execute format('drop policy if exists %I on public.%I', t||'_equipo', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select public.cj_es_equipo()))
         with check ((select public.cj_es_equipo()))', t||'_equipo', t);
  end loop;
end $$;

/* ---------- Equipo inicial ---------- */
insert into public.cj_equipo (email, nombre, color) values
  ('thewildsidebusiness@gmail.com', 'Mister', '#00c837'),
  ('castellanoleira@gmail.com',     'Leira',  '#f06a12')
on conflict (email) do nothing;

/* ---------- Permisos (Wild Pass no los da por defecto a tablas nuevas) ---------- */
grant select on public.cj_equipo to authenticated;
grant select, insert, update, delete on public.cj_chavales, public.cj_entradas, public.cj_faltas, public.cj_turnos to authenticated;
grant usage, select on all sequences in schema public to authenticated;

/* ---------- Material del centro y sus usos ---------- */
create table if not exists public.cj_material (
  id     text primary key,
  nombre text not null,
  icono  text not null default '🎮',
  orden  smallint not null default 0,
  activo boolean not null default true
);
create table if not exists public.cj_usos (
  id            bigint generated always as identity primary key,
  material_id   text not null references public.cj_material(id) on update cascade,
  responsable_id bigint not null references public.cj_chavales(id) on delete cascade,
  grupo         bigint[] not null default '{}',
  fecha         date not null default (now() at time zone 'Europe/Madrid')::date,
  inicio        timestamptz not null default now(),
  fin           timestamptz,
  devolucion    text check (devolucion in ('bien','danado','perdido','cambio')),
  nota          text check (length(nota) <= 300),
  falta_id      bigint references public.cj_faltas(id) on delete set null,
  abierto_por   text default public.cj_mi_nombre(),
  cerrado_por   text
);
-- Solo un uso abierto a la vez por cada cosa
create unique index if not exists cj_usos_abierto on public.cj_usos (material_id) where fin is null;
create index if not exists cj_usos_responsable on public.cj_usos (responsable_id);
create index if not exists cj_usos_falta on public.cj_usos (falta_id);
create index if not exists cj_usos_fecha on public.cj_usos (fecha);

alter table public.cj_material enable row level security;
alter table public.cj_usos enable row level security;
revoke all on public.cj_material, public.cj_usos from anon;
grant select on public.cj_material to authenticated;
grant select, insert, update, delete on public.cj_usos to authenticated;

drop policy if exists cj_material_equipo on public.cj_material;
create policy cj_material_equipo on public.cj_material for select to authenticated using ((select public.cj_es_equipo()));
drop policy if exists cj_usos_equipo on public.cj_usos;
create policy cj_usos_equipo on public.cj_usos for all to authenticated
  using ((select public.cj_es_equipo())) with check ((select public.cj_es_equipo()));

insert into public.cj_material (id, nombre, icono, orden) values
  ('billar','Billar','🎱',1), ('pc1','Ordenador 1','💻',2), ('pc2','Ordenador 2','💻',3),
  ('futbolin','Futbolín','⚽',4), ('ps5','PS5','🎮',5), ('pingpong','Ping pong','🏓',6)
on conflict (id) do nothing;
