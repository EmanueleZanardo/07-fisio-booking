# STATUS.md — 07-fisio-booking (Prenotazioni fisioterapista Roberta)

**Ultimo aggiornamento: 01/10/2026 ~20:25 CEST**

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
