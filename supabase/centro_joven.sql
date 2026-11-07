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
