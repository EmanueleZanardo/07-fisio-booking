# STATUS.md — 07-fisio-booking (Prenotazioni fisioterapista Roberta)

**Ultimo aggiornamento: 07/10/2026 ~02:10 CEST**

## 07/10/2026 ~02:10 CEST — aggiornamento documentale giornaliero
- **Commit `5f2b098c` (07/10 00:01 UTC):** blitz-A — a11y/perf head: preload hero.jpg (LCP), aria-modal sulla conferma, role=status sull'avviso.
- Squadra 10 worker 05/10: hero.jpg 448KB→170KB, pagina zone-servite.html, CSS a11y, SEO head (LocalBusiness JSON-LD), sitemap, reminders.js, README senza nome proprietario. Sito live https://fisio-roberta.vercel.app/ (4 trattamenti 40 €/45 min, solo domicilio).
- Prossimo: verifica live deploy Vercel sui nuovi commit (rate limit potrebbe toccare anche questo repo — verificare prima del push).
- Blocchi: nessuno lato repo; monitor lead WhatsApp disattivato (29/09).

## 06/10/2026 ~02:05 CEST — aggiornamento documentale giornaliero
- **Commit `59edc34` (05/10 12:00 UTC):** docs STATUS.md — report squadra W10.
- **05/10 ~13:25 — squadra 10 worker:** piattaforma ha riavviato il daemon 3 volte (worker uccisi prima del push); atterrati: ottimizzazione hero.jpg 448KB→170KB, pagina zone-servite.html, CSS a11y, SEO head (LocalBusiness JSON-LD), sitemap aggiornata, reminders.js (promemoria locali), README (rimosso nome proprietario). Nessuna recensione inventata.
- Sito live https://fisio-roberta.vercel.app/ (4 trattamenti 40 €/45 min, solo domicilio). Blocchi: nessuno lato repo; monitor lead WhatsApp disattivato (29/09). Prossimo: verifica live deploy Vercel sui nuovi commit.

## 05/10/2026 ~13:25 CEST — squadra 10 worker (ordine: 2h, task non sovrapposti)
- **Infrastruttura instabile**: la piattaforma ha riavviato il daemon 3 volte (~12:26, ~12:51, ~12:56 CEST), uccidendo tutti i worker non ancora pushati. Totale worker spawnati: 21 (10 wave-1 + 10 wave-2 + 1 retry W2).
- **Atterrati via worker** (verificati su main): `5cfb566` hero.jpg 448KB→~170KB [W8]; `261d153` nuova pagina zone-servite.html [W6]; `a90ae7f` CSS a11y (focus 3px, reduced-motion, skip-link, target 44px) [W7]; `26bf2fd` SEO head (keywords + LocalBusiness JSON-LD) [W2]; `970ad1c` sitemap con zone-servite.html [W2].
- **Completati dal coordinatore** (lavoro residuo, push immediati): `7aaf388` reminders.js (promemoria locali: localStorage + banner + .ics, nessun invio) [W3]; `ef8fd6c` script tag reminders + link footer a zone-servite.html [W3/W6]; `f035958` hook FisioReminders.registra in completaPrenotazione (app.js) [W3]; `de06b2e` README aggiornato + rimosso nome proprietario da file pubblico [W9].
- **Recensioni**: sezione + render già presenti (da tenant.recensioni), CTA WhatsApp "Lascia la tua recensione" attivo. NESSUNA recensione inventata: l'array resta vuoto finché non arrivano testimonianze reali.
- robots.txt: già OK (Allow + Sitemap). FAQ: già presente (12 Q&A + FAQPage JSON-LD, dal 30/09). Booking UX: flusso già solido (step indicator, validazione inline, conferma post-invio, anti-doppio-tap) — nessun intervento necessario.
- Prossimo: verifica live del deploy Vercel sui nuovi commit.

## 05/10/2026 ~02:00 CEST — aggiornamento documentale giornaliero
- **04/10 16:40 — squadra FISIO (sprint 1h): 2 bug reali trovati e fixati** — popup wa.me bloccato dopo async (commit `b4661060`), slot resta occupato se POST fallisce (commit `b2989c1`, HEAD); UX mobile safe-area/tap target (`3ef3b3b`). QA live: md5 app.js = repo, nessun bug residuo.
- Blocchi: nessuno. Patch header locale: non applicabile a questo repo.


## 04/10/2026 ~02:00 CEST — aggiornamento documentale giornaliero
- **03/10 00:44–01:43 — pannello admin Vendite/Incassi + configurazione Supabase reale** (tabelle `fisio_incassi`, `orto_*` su progetto `warehouse-mobile` West EU; test E2E INSERT/READ/DELETE OK).
- **03/10 01:48–01:49 — restyling completo pushato** (commit 6fa759a: hero verde petrolio, font Fraunces+Inter, card trattamenti) e verificato live su fisio-roberta.vercel.app.
- **03/10 11:07–11:10** — prenotazione giorno+slot (30 giorni) + admin disponibilità pushati (commit 35846f2).
- **03/10 ~12:00–13:00 — QA E2E live: 3 bug reali trovati e fixati** (slot non visibili al pubblico, slot non marcato occupato dopo prenotazione test, admin bloccata su "Caricamento..."); fix pushati `c4fd13ef`; record test eliminati, nessuna prenotazione reale toccata.
- **03/10 ~14:55 — squadra SEO locale + UX conversione** (commit 9f970fbe, bc9c4cae — HEAD). 2 bug preesistenti confermati ma NON corretti (apertura WhatsApp bloccabile dopo round-trip async; POST fallita dopo PATCH può lasciare slot occupato senza prenotazione).


## 03/10/2026 ~14:45 CEST — pass SEO locale (builder b2)
- index.html: JSON-LD Physiotherapy — `areaServed` semplificato al testo zone reale ("Provincia di Varese e Canton Ticino (zone a sud di Lugano)"), niente liste di comuni; `name`, `url`, `telephone`, `priceRange`, `openingHoursSpecification` (lun–ven 09–19, sab 09–13, come da orari tenant) confermati. Meta invariati (title/description già buoni, canonical + theme-color già presenti).
- hero.jpg: aggiunti width/height (1920×1280) anti-CLS, alt già presente; preconnect font già in head; script vercel insights già defer; app.js resta in fondo al body (nessuna modifica alla logica).
- tenants/roberta-fisioterapista.json: descrizioni 4 trattamenti arricchite con parole chiave naturali ("a domicilio … in provincia di Varese e in Ticino").
- sitemap.xml: lastmod → 2026-10-03. Form prenotazioni e pannello admin non toccati.

## 03/10/2026 ~02:00 CEST — aggiornamento documentale giornaliero
- 02/10 23:48 UTC: **restyling grafico** pushato su main (commit 6fa759a): hero con foto, serif Fraunces, card trattamenti, palette calda (tenants/roberta-fisioterapista.json). Sito live https://fisio-roberta.vercel.app/.
- Monitor lead WhatsApp resta disattivato (ordine 29/09). Prossimi passi: QA ordinaria; pubblicazione automatica risposte NON autorizzata.


## 02/10/2026 ~02:00 CEST — aggiornamento documentale giornaliero
- Blitz 01/10 ~20:25 CEST: security headers via vercel.json, head SEO, JSON-LD FAQPage specchio delle 12 FAQ, skip-link + role=alert + prefers-reduced-motion, bugfix app.js (title SEO non più sovrascritto) — integrato con le modifiche del worker B senza sovrascritture. Test verdi.
- Agente crescita 01/10 ~19:35: strip tariffa 40 €/45 min in evidenza, CTA WhatsApp diretto, nuova FAQ "prenotare per un familiare" — nessun claim inventato.
- Sito live https://fisio-roberta.vercel.app/ (completato 26/09). Monitor lead WhatsApp resta disattivato (ordine 29/09).

## Stato
- Sito di prenotazione visite fisioterapiche, live su https://fisio-roberta.vercel.app/.
- COMPLETATO il 26/09/2026.
- Offerta: 4 trattamenti a 40 € per seduta da 45 minuti; solo domicilio (indirizzo sempre obbligatorio); WhatsApp +39 345 111 4337; zone Varese + Canton Ticino a sud di Lugano.

## Ultimi eventi verificati
- 01/10/2026 ~20:25 CEST: blitz solidità (worker A) — push verificati: security headers via vercel.json (nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy); head SEO (og:image:width/height/alt, Twitter Card, apple-touch-icon 180×180); JSON-LD FAQPage specchio delle 12 FAQ visibili; skip-link + role=alert sugli errori + prefers-reduced-motion; bugfix app.js (il <title> SEO non viene più sovrascritto da JS, recensioni agganciate ad applyTenant senza polling); <style> inline spostato in styles.css. Tutti i push integrati con le modifiche del worker B (strip tariffa, CTA WhatsApp, FAQ familiare) senza sovrascritture. Test verdi.
- 26/09/2026: completamento e deploy su Vercel; vecchio URL GitHub Pages (con il suo nome) disattivato.
- Annuncio Bakeca fisio pubblicato il 26/09/2026 ~11:48 (scade 25/12/2026).
- 30/09/2026: ondata builder — commit fc441ac7d38bad5ac037221eecd0e964a79301cc (push remoto verificato): SEO locale Varese+Ticino, FAQ v2, template recensioni senza testimonianze inventate, UX mobile prenotazione, flyer A5. Validazione dei due verifier dopo un giro di revisione.
- 01/10/2026 ~19:35 CEST (agente crescita): strip tariffa 40 €/45 min in evidenza sotto l'hero, sezione CTA WhatsApp diretto "Preferisci parlare prima di prenotare?", nuova FAQ "prenotare per un familiare"; nessuno claim/recensione inventata.

## Prossimi passi
- Revenue cycle completato: verificare eventuali lead WhatsApp (monitor automatico disattivato il 29/09/2026 su richiesta di Emanuele).

## Blocchi
- Controllo visivo live completo ancora da confermare.
- Annunci a raffica attivi (job ads-republish-12h).
