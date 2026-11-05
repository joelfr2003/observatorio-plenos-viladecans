-- Observatorio de plenos de Viladecans · ampliación v2 (usuarios, accesos, lectura solo para registrados)
-- Ejecuta DESPUÉS de supabase-schema.sql: Supabase > SQL Editor > New query > Run.

-- 1) Perfiles de usuario (quién usa la aplicación)
create table if not exists public.observatorio_perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nombre text,
  created_at timestamptz not null default now(),
  ultimo_acceso timestamptz,   -- última vez que entró (inicio de sesión)
  last_seen_at timestamptz     -- última actividad (se actualiza cada pocos minutos)
);
alter table public.observatorio_perfiles enable row level security;

drop policy if exists "Users read own profile" on public.observatorio_perfiles;
create policy "Users read own profile" on public.observatorio_perfiles
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Admins read all profiles" on public.observatorio_perfiles;
create policy "Admins read all profiles" on public.observatorio_perfiles
  for select to authenticated
  using (exists (select 1 from public.observatorio_admins a where a.user_id = auth.uid()));

revoke all on public.observatorio_perfiles from anon, authenticated;
grant select on public.observatorio_perfiles to authenticated;   -- sin escritura directa

-- 2) Crear el perfil automáticamente al registrarse
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

-- Perfiles de los usuarios que ya existían (p. ej. tu administrador)
insert into public.observatorio_perfiles (user_id, email, nombre)
select id, email, coalesce(raw_user_meta_data->>'nombre', '') from auth.users
on conflict (user_id) do nothing;

-- 3) Registro de acceso / actividad (lo llama la app)
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

-- 4) Los datos solo se pueden leer con la sesión iniciada (antes eran públicos)
drop policy if exists "Public can read observatorio data" on public.observatorio_data;
drop policy if exists "Registered users can read observatorio data" on public.observatorio_data;
create policy "Registered users can read observatorio data" on public.observatorio_data
  for select to authenticated using (true);
revoke select on public.observatorio_data from anon;
-- La edición sigue limitada a observatorio_admins (política "Admins can update observatorio data").
