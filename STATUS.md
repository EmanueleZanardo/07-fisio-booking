# STATUS.md — 07-fisio-booking (Prenotazioni fisioterapista Roberta)

**Ultimo aggiornamento: 03/10/2026 ~14:45 CEST**

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
