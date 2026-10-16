-- Ejecutar una vez en Supabase > SQL Editor. Compatible con la tabla original.
begin;
create table if not exists public.asistencias (
  id uuid primary key,
  nombre text not null check (char_length(nombre) between 2 and 120),
  hora_cliente timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  ip text
);
alter table public.asistencias add column if not exists sequence bigint generated always as identity;
create unique index if not exists asistencias_sequence_idx on public.asistencias(sequence);
create index if not exists asistencias_fecha_idx on public.asistencias(created_at desc);
-- Elimina el trigger anterior: la función controlada por el servidor fija estos campos.
drop trigger if exists trg_asistencias_meta on public.asistencias;
alter table public.asistencias enable row level security;
drop policy if exists "publico puede registrar" on public.asistencias;
drop policy if exists "panel puede leer" on public.asistencias;
revoke all on public.asistencias from anon, authenticated;
grant select, insert on public.asistencias to service_role;
grant usage, select on all sequences in schema public to service_role;

create or replace function public.registrar_visita(registro_id uuid, visitante text, hora_local timestamptz, direccion_ip text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result public.asistencias;
begin
  -- Una UUID se inserta una sola vez, incluso con reintentos simultáneos.
  insert into public.asistencias(id,nombre,hora_cliente,created_at,ip)
  values(registro_id,visitante,hora_local,clock_timestamp(),direccion_ip)
  on conflict (id) do nothing returning * into result;
  if result.id is null then
    select * into result from public.asistencias where id=registro_id;
  end if;
  return jsonb_build_object('id', result.id, 'created_at', result.created_at);
end $$;
revoke all on function public.registrar_visita(uuid,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.registrar_visita(uuid,text,timestamptz,text) to service_role;

create table if not exists public.attendance_login_limits (
  ip text primary key, since timestamptz not null, attempts integer not null
);
alter table public.attendance_login_limits enable row level security;
revoke all on public.attendance_login_limits from anon, authenticated;
create or replace function public.attendance_login_allowed(client_ip text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare tries integer;
begin
  delete from public.attendance_login_limits where since < now() - interval '1 day';
  insert into public.attendance_login_limits(ip,since,attempts) values(client_ip,now(),1)
  on conflict(ip) do update set
    attempts=case when attendance_login_limits.since < now()-interval '15 minutes' then 1 else attendance_login_limits.attempts+1 end,
    since=case when attendance_login_limits.since < now()-interval '15 minutes' then now() else attendance_login_limits.since end
  returning attempts into tries;
  return tries <= 10;
end $$;
revoke all on function public.attendance_login_allowed(text) from public, anon, authenticated;
grant execute on function public.attendance_login_allowed(text) to service_role;
commit;
