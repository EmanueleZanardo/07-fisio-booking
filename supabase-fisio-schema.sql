-- Disponibilità e prenotazioni per il sito fisio-roberta (progetto 07-fisio-booking).
-- Eseguire nel SQL Editor di Supabase (progetto warehouse-mobile).
-- La PWA funziona anche senza queste tabelle: mostra un avviso e usa le fasce
-- orarie indicative finché non vengono create.

create table if not exists fisio_slot (
  id bigint generated always as identity primary key,
  data date not null,
  ora_inizio time not null,
  ora_fine time not null,
  stato text not null default 'libero'
    check (stato in ('libero', 'occupato', 'bloccato')),
  created_at timestamptz not null default now()
);
create index if not exists idx_fisio_slot_data on fisio_slot (data);
create index if not exists idx_fisio_slot_stato on fisio_slot (stato);

create table if not exists fisio_prenotazioni (
  id bigint generated always as identity primary key,
  slot_id bigint references fisio_slot(id) on delete set null,
  nome text not null default '',
  telefono text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_fisio_pren_slot on fisio_prenotazioni (slot_id);
create index if not exists idx_fisio_pren_created on fisio_prenotazioni (created_at desc);

alter table fisio_slot enable row level security;
alter table fisio_prenotazioni enable row level security;

drop policy if exists "mobile full access" on fisio_slot;
create policy "mobile full access" on fisio_slot
  for all using (true) with check (true);
drop policy if exists "mobile full access" on fisio_prenotazioni;
create policy "mobile full access" on fisio_prenotazioni
  for all using (true) with check (true);
