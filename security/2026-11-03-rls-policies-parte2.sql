-- PARTE 2: eseguire SOLO dopo che il nuovo frontend e' online.
-- Rimuove tutte le policy esistenti sulle tabelle fisio
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('fisio_slot', 'fisio_prenotazioni', 'fisio_incassi')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.fisio_slot enable row level security;
alter table public.fisio_prenotazioni enable row level security;
alter table if exists public.fisio_incassi enable row level security;

-- Slot: lettura pubblica (solo date, orari e stato), modifiche solo admin
create policy "slot lettura pubblica" on public.fisio_slot
  for select using (true);
create policy "slot gestione admin" on public.fisio_slot
  for all to authenticated using (public.fisio_is_admin())
  with check (public.fisio_is_admin());

-- Prenotazioni: solo admin
create policy "prenotazioni admin" on public.fisio_prenotazioni
  for all to authenticated using (public.fisio_is_admin())
  with check (public.fisio_is_admin());

-- Incassi: solo admin
do $$
begin
  if to_regclass('public.fisio_incassi') is not null then
    execute 'create policy "incassi admin" on public.fisio_incassi
      for all to authenticated using (public.fisio_is_admin())
      with check (public.fisio_is_admin())';
  end if;
end $$;

