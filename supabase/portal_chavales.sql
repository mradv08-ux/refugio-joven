-- =========================================================
--  «Mi Refugio»: portal de solo lectura para los chavales
--  Cada chaval entra con su código personal (8 caracteres).
--  Solo ve SUS faltas y días, y el estado y las listas de espera
--  de los juegos (con nombres recortados). Se puede volver a ejecutar.
-- =========================================================

/* ---------- Código personal ---------- */
create or replace function public.cj_generar_codigo()
returns text language plpgsql volatile set search_path = '' as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sin 0/O ni 1/I
  b bytea := extensions.gen_random_bytes(8);
  r text := '';
begin
  for i in 0..7 loop
    r := r || substr(alfabeto, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return r;
end $$;
revoke all on function public.cj_generar_codigo() from public, anon;
grant execute on function public.cj_generar_codigo() to authenticated;  -- lo usa el valor por defecto al dar de alta

alter table public.cj_chavales add column if not exists codigo text;
update public.cj_chavales set codigo = public.cj_generar_codigo() where codigo is null;
alter table public.cj_chavales alter column codigo set default public.cj_generar_codigo();
alter table public.cj_chavales alter column codigo set not null;
create unique index if not exists cj_chavales_codigo on public.cj_chavales (codigo);

-- El equipo puede dar un código nuevo (si un chaval lo pierde o lo comparte)
create or replace function public.cj_nuevo_codigo(p_id bigint)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare c text;
begin
  if not public.cj_es_equipo() then raise exception 'Sin permiso'; end if;
  c := public.cj_generar_codigo();
  update public.cj_chavales set codigo = c where id = p_id;
  return c;
end $$;
revoke all on function public.cj_nuevo_codigo(bigint) from public, anon;
grant execute on function public.cj_nuevo_codigo(bigint) to authenticated;

/* ---------- Nombre recortado para mostrar a otros chavales ---------- */
create or replace function public.cj_nombre_corto(n text)
returns text language sql immutable set search_path = '' as $$
  select case when position(' ' in trim(n)) > 0
    then split_part(trim(n), ' ', 1) || ' ' || upper(left(split_part(trim(n), ' ', 2), 1)) || '.'
    else trim(n) end;
$$;

/* ---------- Lo que ve el chaval ---------- */
create or replace function public.cj_portal(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  cod text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  yo public.cj_chavales;
  hoy date := (now() at time zone 'Europe/Madrid')::date;
  res jsonb;
begin
  if length(cod) <> 8 then return null; end if;
  select * into yo from public.cj_chavales where codigo = cod;
  if not found then return null; end if;

  select jsonb_build_object(
    'nombre', yo.nombre,
    'hoy', hoy,
    'dias_total', (select count(*) from public.cj_entradas where chaval_id = yo.id),
    'dias_mes', (select count(*) from public.cj_entradas where chaval_id = yo.id and date_trunc('month', fecha) = date_trunc('month', hoy)),
    'dentro_hoy', exists (select 1 from public.cj_entradas where chaval_id = yo.id and fecha = hoy),
    'faltas', coalesce((select jsonb_agg(jsonb_build_object('fecha', f.fecha, 'gravedad', f.gravedad, 'motivo', f.motivo) order by f.fecha desc, f.id desc)
                        from public.cj_faltas f where f.chaval_id = yo.id), '[]'::jsonb),
    'juegos', coalesce((select jsonb_agg(t.j order by t.j->>'orden') from (
      select jsonb_build_object(
        'id', m.id, 'nombre', m.nombre, 'icono', m.icono, 'orden', lpad(m.orden::text, 3, '0'), 'limite', m.limite_min,
        'uso', (select jsonb_build_object(
                   'desde', u.turno_inicio,
                   'responsable', public.cj_nombre_corto(c.nombre),
                   'personas', 1 + coalesce(array_length(u.grupo, 1), 0),
                   'yo', (u.responsable_id = yo.id or yo.id = any(u.grupo)),
                   'yo_responsable', (u.responsable_id = yo.id))
                from public.cj_usos u join public.cj_chavales c on c.id = u.responsable_id
                where u.material_id = m.id and u.fin is null limit 1),
        'espera', coalesce((select jsonb_agg(jsonb_build_object(
                     'pos', e.pos, 'responsable', public.cj_nombre_corto(c.nombre),
                     'personas', 1 + coalesce(array_length(e.grupo, 1), 0),
                     'desde', e.creado,
                     'yo', (e.responsable_id = yo.id or yo.id = any(e.grupo))) order by e.pos)
                   from (select x.*, row_number() over (order by x.creado) pos
                         from public.cj_espera x where x.material_id = m.id and x.fecha = hoy) e
                   join public.cj_chavales c on c.id = e.responsable_id), '[]'::jsonb)
      ) as j
      from public.cj_material m where m.activo) t), '[]'::jsonb)
  ) into res;
  return res;
end $$;
revoke all on function public.cj_portal(text) from public;
grant execute on function public.cj_portal(text) to anon, authenticated;
