-- Messa in sicurezza fisio-roberta (02/11/2026).
-- Prima: policy "using (true)" = chiunque con la chiave pubblica del sito
-- poteva leggere, modificare e cancellare prenotazioni (nomi, telefoni, note),
-- slot e incassi. Il PIN admin era scritto nel codice pubblico.
-- Dopo: il visitatore vede solo gli slot e prenota tramite la funzione
-- fisio_prenota; prenotazioni, incassi e gestione slot solo per gli admin
-- autenticati con Supabase Auth e presenti nella tabella fisio_admin.
--
-- COME APPLICARLO (progetto Supabase poyodlfqxoprmictvmaj):
-- 1. Authentication → Users → Add user: crea l'utente admin (email + password).
-- 2. Sostituisci ADMIN_EMAIL_QUI qui sotto con quella email.
-- 3. Esegui tutto lo script nel SQL Editor, POI pubblica il branch
--    security/supabase-auth (se pubblichi prima il sito o prima lo script,
--    le prenotazioni si bloccano finché non fai anche l'altro passo).

-- Elenco admin autorizzati
create table if not exists public.fisio_admin (email text primary key);
insert into public.fisio_admin (email) values ('emanuele1998zanardo@gmail.com')
  on conflict do nothing;
alter table public.fisio_admin enable row level security;
-- nessuna policy: la tabella non è leggibile dal sito

create or replace function public.fisio_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.fisio_admin
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

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

-- Prenotazione atomica per i visitatori
create or replace function public.fisio_prenota(
  p_slot bigint, p_nome text, p_telefono text, p_note text default ''
) returns json
language plpgsql security definer set search_path = public as $$
declare s public.fisio_slot%rowtype;
begin
  if length(coalesce(p_nome, '')) = 0 or length(coalesce(p_telefono, '')) = 0 then
    raise exception 'dati mancanti';
  end if;
  update public.fisio_slot set stato = 'occupato'
    where id = p_slot and stato = 'libero' and data >= current_date
    returning * into s;
  if not found then
    raise exception 'occupato';
  end if;
  insert into public.fisio_prenotazioni (slot_id, nome, telefono, note)
    values (p_slot, left(p_nome, 120), left(p_telefono, 40), left(coalesce(p_note, ''), 320));
  return json_build_object('id', s.id, 'data', s.data,
    'ora_inizio', s.ora_inizio, 'ora_fine', s.ora_fine);
end $$;

revoke all on function public.fisio_prenota(bigint, text, text, text) from public;
grant execute on function public.fisio_prenota(bigint, text, text, text) to anon, authenticated;
