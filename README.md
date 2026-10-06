# Fisio-booking — Prenotazioni visite fisioterapiche via WhatsApp

Sito di prenotazione per **Roberta — Fisioterapista**: il paziente sceglie un
trattamento (una sola prenotazione alla volta), compila nome/telefono/indirizzo
(trattamenti sempre a domicilio), indica una fascia oraria preferita e invia la
richiesta via WhatsApp con messaggio precompilato (`wa.me`). Pagamento di
persona a fine trattamento.

Derivato da un sistema multi-tenant di prenotazioni (template asporto),
adattato alla tipologia **prenotazioni**.

## Dati attività

- **Nome:** Roberta — Fisioterapista
- **Tariffa:** 40 € a seduta da 45 minuti, per ogni trattamento
- **Zone:** provincia di Varese + Canton Ticino (a sud di Lugano)
- **WhatsApp prenotazioni:** +39 345 111 4337 (numero reale, `demo: false`)
- **Orari:** giorni e orari definitivi da concordare in chat; gli slot proposti
  (lun–ven 09:00–19:00, sab 09:00–13:00) sono solo preferenze.

## Trattamenti

- Riabilitazione ortopedica / post-infortunio — 40 €/seduta
- Dolori muscolari e articolari — 40 €/seduta
- Ginnastica posturale — 40 €/seduta
- Massoterapia — 40 €/seduta

## Struttura

```
├── index.html                 # pagina di prenotazione
├── app.js                     # logica: trattamenti, riepilogo, form, messaggio wa.me
├── reminders.js               # promemoria locali (localStorage + banner + .ics), nessun invio
├── styles.css                 # mobile-first (tema teal)
├── favicon.svg                # icona sito (croce su sfondo teal)
├── og-image.png               # immagine anteprima link (WhatsApp/Facebook)
├── robots.txt / sitemap.xml   # SEO di base
├── zone-servite.html          # pagina SEO locale (Varese + Ticino sud Lugano)
├── trattamento-*.html         # 4 pagine SEO per trattamento (riabilitazione, dolori muscolari, ginnastica posturale, massoterapia)
├── tenant.json                # TEMPLATE per nuovi tenant
├── tenants/
│   └── roberta-fisioterapista.json  # configurazione attività
├── vercel.json
└── README.md
```

Il tenant si sceglie con `?tenant=<slug>` (default: `roberta-fisioterapista`).

## Funzionalità aggiunte (05/10/2026)

- **FAQ** in `index.html` (16 domande) + `FAQPage` JSON-LD per i rich snippet Google.
- **Pagine trattamenti** (`trattamento-riabilitazione.html`, `trattamento-dolori-muscolari.html`, `trattamento-ginnastica-posturale.html`, `trattamento-massoterapia.html`): SEO per trattamento con `Service` + `FAQPage` + `BreadcrumbList` JSON-LD, link incrociati tra loro e con home/zone; sitemap aggiornata. (07/10/2026, blitz B)
- **Pagina zone servite** (`zone-servite.html`): SEO locale per provincia di
  Varese e Canton Ticino a sud di Lugano, con CTA WhatsApp.
- **Promemoria prenotazioni** (`reminders.js`): ogni richiesta inviata viene
  salvata nel browser; alla visita successiva un banner discreto propone
  "Aggiungi al calendario" (file `.ics` generato al volo). Nessun dato esce
  dal dispositivo, nessun invio automatico.
- **SEO locale**: `LocalBusiness`/`Physiotherapy` JSON-LD, meta keywords,
  geo-tags, `robots.txt` + `sitemap.xml` con le due pagine.
- **Accessibilità**: skip-link, focus visibile 3px, `prefers-reduced-motion`,
  target touch ≥44px, label/errori inline nel form.
- **Performance**: `hero.jpg` ottimizzata (~170KB), `fetchpriority="high"`
  sull'hero, dimensioni width/height anti-layout-shift.

## Test (26/09/2026)

- ✅ `node --check app.js`
- ✅ JSON valido (`tenant.json`, `tenants/roberta-fisioterapista.json`)
- ✅ Test funzionali in Node: messaggio prenotazione conforme, `encodeURIComponent`
  corretto con caratteri speciali, slot orari (buffer 20 min), troncamento note
  a 300 caratteri, ID prenotazione formato `Pxxxx`, numero WhatsApp valido.

## Deploy

Sito statico — pubblicato su Vercel da `main` (ogni push su `main`
fa ripartire il deploy automaticamente).

## Chiusure straordinarie (es. Natale, Capodanno)

Il campo `chiusureStraordinarie` in `tenants/roberta-fisioterapista.json`
contiene le date di chiusura in formato `YYYY-MM-DD`; il sito non propone
slot in quei giorni.

Procedura (nessun backend, ~2 minuti):
1. Apri `tenants/roberta-fisioterapista.json` su GitHub e premi ✏️ (modifica).
2. Aggiungi le date all'array, es.: `"chiusureStraordinarie": ["2026-12-25", "2026-12-26", "2027-01-01"]`.
3. Commit su `main` → Vercel ridistribuisce da solo in 1–2 minuti.

## Analytics (senza cookie)

Il sito usa **Vercel Web Analytics** (gratis, senza cookie, niente banner):
lo snippet è già in `index.html`. Va solo **abilitato una volta nel
dashboard del progetto Vercel** (Analytics → Enable).

Eventi tracciati:
- `prenotazione_whatsapp` — click su "Prenota via WhatsApp" con `orderId`
  (serve a misurare quante visite dagli annunci diventano richieste).
