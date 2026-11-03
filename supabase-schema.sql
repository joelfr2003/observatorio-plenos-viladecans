-- Observatorio de plenos municipales de Viladecans
-- Ejecuta este archivo completo en Supabase > SQL Editor > New query.

create table if not exists public.observatorio_data (
  id integer primary key check (id = 1),
  plenos jsonb not null default '[]'::jsonb,
  legislaturas jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.observatorio_data (id, plenos, legislaturas)
values (1, '[]'::jsonb, '[]'::jsonb)
on conflict (id) do nothing;

create table if not exists public.observatorio_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.observatorio_data enable row level security;
alter table public.observatorio_admins enable row level security;

-- Cualquier visitante puede leer los datos publicados.
drop policy if exists "Public can read observatorio data" on public.observatorio_data;
create policy "Public can read observatorio data"
  on public.observatorio_data for select
  to anon, authenticated using (true);

-- Solo los usuarios incluidos en observatorio_admins pueden modificar el registro.
drop policy if exists "Admins can update observatorio data" on public.observatorio_data;
create policy "Admins can update observatorio data"
  on public.observatorio_data for update
  to authenticated
  using (exists (select 1 from public.observatorio_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.observatorio_admins a where a.user_id = auth.uid()));

-- Cada usuario autenticado solo puede comprobar su propio registro de administrador.
drop policy if exists "Admins can read own admin row" on public.observatorio_admins;
create policy "Admins can read own admin row"
  on public.observatorio_admins for select
  to authenticated using (user_id = auth.uid());

grant select on public.observatorio_data to anon, authenticated;
grant update on public.observatorio_data to authenticated;
grant select on public.observatorio_admins to authenticated;

-- Habilita actualizaciones en tiempo real para la tabla principal.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'observatorio_data') then
    alter publication supabase_realtime add table public.observatorio_data;
  end if;
end $$;
