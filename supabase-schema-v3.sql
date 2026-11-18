-- Observatorio de plenos de Viladecans · esquema COMPLETO v3 (idempotente)
-- Se puede ejecutar entero aunque ya hayas ejecutado el esquema original y el v2.
-- Supabase > SQL Editor > New query > pega todo > Run.
--
-- Qué añade respecto a v2:
--   · Define todas las tablas base (por si el esquema original se perdió).
--   · Historial automático: antes de cada cambio se guarda la versión anterior (últimas 100).
--   · Función para restaurar una versión anterior (solo administradores).
--   · Bucket privado "actas" para los PDF, con permisos correctos.
--   · Realtime activado para la tabla de datos.
--   · Control de forma: plenos y legislaturas deben ser listas JSON.

-- 0) Administradores -----------------------------------------------------------
create table if not exists public.observatorio_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.observatorio_admins enable row level security;

drop policy if exists "Users read own admin row" on public.observatorio_admins;
create policy "Users read own admin row" on public.observatorio_admins
  for select to authenticated using (user_id = auth.uid());

revoke all on public.observatorio_admins from anon, authenticated;
grant select on public.observatorio_admins to authenticated;

create or replace function public.es_admin_obs()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.observatorio_admins a where a.user_id = auth.uid())
$$;
revoke all on function public.es_admin_obs() from public, anon;
grant execute on function public.es_admin_obs() to authenticated;

-- 1) Datos del observatorio (una sola fila, id = 1) ----------------------------
create table if not exists public.observatorio_data (
  id int primary key check (id = 1),
  plenos jsonb not null default '[]'::jsonb,
  legislaturas jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.observatorio_data (id) values (1) on conflict (id) do nothing;
alter table public.observatorio_data enable row level security;

do $$ begin
  alter table public.observatorio_data
    add constraint obs_listas_json check (jsonb_typeof(plenos) = 'array' and jsonb_typeof(legislaturas) = 'array');
exception when duplicate_object then null; when check_violation then null; end $$;

drop policy if exists "Public can read observatorio data" on public.observatorio_data;
drop policy if exists "Registered users can read observatorio data" on public.observatorio_data;
create policy "Registered users can read observatorio data" on public.observatorio_data
  for select to authenticated using (true);

drop policy if exists "Admins can update observatorio data" on public.observatorio_data;
create policy "Admins can update observatorio data" on public.observatorio_data
  for update to authenticated using (public.es_admin_obs()) with check (public.es_admin_obs());

revoke all on public.observatorio_data from anon, authenticated;
grant select, update on public.observatorio_data to authenticated;

-- 2) Historial de versiones ----------------------------------------------------
create table if not exists public.observatorio_historial (
  id bigint generated always as identity primary key,
  guardado_at timestamptz not null default now(),
  guardado_por uuid,
  plenos jsonb not null,
  legislaturas jsonb not null,
  n_sesiones int,
  n_votaciones int
);
alter table public.observatorio_historial enable row level security;

drop policy if exists "Admins read history" on public.observatorio_historial;
create policy "Admins read history" on public.observatorio_historial
  for select to authenticated using (public.es_admin_obs());

revoke all on public.observatorio_historial from anon, authenticated;
grant select on public.observatorio_historial to authenticated;

create or replace function public.obs_historial_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare arr jsonb := case when jsonb_typeof(old.plenos) = 'array' then old.plenos else '[]'::jsonb end;
begin
  if (old.plenos is distinct from new.plenos) or (old.legislaturas is distinct from new.legislaturas) then
    insert into public.observatorio_historial (guardado_por, plenos, legislaturas, n_sesiones, n_votaciones)
    values (
      auth.uid(), old.plenos, old.legislaturas, jsonb_array_length(arr),
      (select coalesce(sum(case when jsonb_typeof(s->'votaciones') = 'array' then jsonb_array_length(s->'votaciones') else 0 end), 0)
         from jsonb_array_elements(arr) s)
    );
    delete from public.observatorio_historial
     where id in (select id from public.observatorio_historial order by id desc offset 100);
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists obs_historial on public.observatorio_data;
create trigger obs_historial before update on public.observatorio_data
  for each row execute function public.obs_historial_trg();

-- Restaurar una versión: select public.restaurar_version_obs(<id>);
-- (ver los ids con: select id, guardado_at, n_sesiones, n_votaciones from public.observatorio_historial order by id desc;)
create or replace function public.restaurar_version_obs(version_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare h public.observatorio_historial;
begin
  if not public.es_admin_obs() then raise exception 'Solo los administradores pueden restaurar versiones'; end if;
  select * into h from public.observatorio_historial where id = version_id;
  if not found then raise exception 'Versión % no encontrada', version_id; end if;
  update public.observatorio_data set plenos = h.plenos, legislaturas = h.legislaturas where id = 1;
end $$;
revoke all on function public.restaurar_version_obs(bigint) from public, anon;
grant execute on function public.restaurar_version_obs(bigint) to authenticated;

-- 3) Perfiles de usuario y registro de accesos (como en v2) --------------------
create table if not exists public.observatorio_perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nombre text,
  created_at timestamptz not null default now(),
  ultimo_acceso timestamptz,
  last_seen_at timestamptz
);
alter table public.observatorio_perfiles enable row level security;

drop policy if exists "Users read own profile" on public.observatorio_perfiles;
create policy "Users read own profile" on public.observatorio_perfiles
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Admins read all profiles" on public.observatorio_perfiles;
create policy "Admins read all profiles" on public.observatorio_perfiles
  for select to authenticated using (public.es_admin_obs());

revoke all on public.observatorio_perfiles from anon, authenticated;
grant select on public.observatorio_perfiles to authenticated;

create or replace function public.handle_new_user_obs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.observatorio_perfiles (user_id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', ''))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created_obs on auth.users;
create trigger on_auth_user_created_obs
  after insert on auth.users
  for each row execute function public.handle_new_user_obs();

insert into public.observatorio_perfiles (user_id, email, nombre)
select id, email, coalesce(raw_user_meta_data->>'nombre', '') from auth.users
on conflict (user_id) do nothing;

create or replace function public.registrar_acceso(nuevo boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.observatorio_perfiles (user_id, email, nombre, ultimo_acceso, last_seen_at)
  select u.id, u.email, coalesce(u.raw_user_meta_data->>'nombre', ''), now(), now()
  from auth.users u where u.id = auth.uid()
  on conflict (user_id) do update
    set last_seen_at = now(),
        ultimo_acceso = case when nuevo then now() else public.observatorio_perfiles.ultimo_acceso end;
end $$;
revoke all on function public.registrar_acceso(boolean) from public, anon;
grant execute on function public.registrar_acceso(boolean) to authenticated;

-- 4) Realtime: avisar a los clientes cuando se publican cambios ----------------
do $$ begin
  alter publication supabase_realtime add table public.observatorio_data;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- 5) Storage: bucket privado para los PDF de las actas -------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('actas', 'actas', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "obs actas leer" on storage.objects;
create policy "obs actas leer" on storage.objects
  for select to authenticated using (bucket_id = 'actas');

drop policy if exists "obs actas subir" on storage.objects;
create policy "obs actas subir" on storage.objects
  for insert to authenticated with check (bucket_id = 'actas' and public.es_admin_obs());

drop policy if exists "obs actas actualizar" on storage.objects;
create policy "obs actas actualizar" on storage.objects
  for update to authenticated using (bucket_id = 'actas' and public.es_admin_obs()) with check (bucket_id = 'actas' and public.es_admin_obs());

drop policy if exists "obs actas borrar" on storage.objects;
create policy "obs actas borrar" on storage.objects
  for delete to authenticated using (bucket_id = 'actas' and public.es_admin_obs());
