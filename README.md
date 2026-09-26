# Fisio-booking — Prenotazioni visite fisioterapiche via WhatsApp

Sito di prenotazione per **Roberto — Fisioterapista**: il paziente sceglie i
trattamenti (quantità = numero di sedute), compila nome/telefono/modalità
(a domicilio o in studio), indica una fascia oraria preferita e invia la
richiesta via WhatsApp con messaggio precompilato (`wa.me`).

Derivato dal sistema multi-tenant di `EmanueleZanardo/booking-system`
(template asporto), adattato alla tipologia **prenotazioni**.

## Dati attività

- **Nome:** Roberto — Fisioterapista
- **Tariffa:** 40 €/ora per ogni trattamento
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
├── styles.css                 # mobile-first (tema teal)
├── tenant.json                # TEMPLATE per nuovi tenant
├── tenants/
│   └── roberto-fisioterapista.json  # configurazione attività
├── vercel.json
└── README.md
```

Il tenant si sceglie con `?tenant=<slug>` (default: `roberto-fisioterapista`).

## Test (26/09/2026)

- ✅ `node --check app.js`
- ✅ JSON valido (`tenant.json`, `tenants/roberto-fisioterapista.json`)
- ✅ Test funzionali in Node: messaggio prenotazione conforme, `encodeURIComponent`
  corretto con caratteri speciali, slot orari (buffer 20 min), troncamento note
  a 300 caratteri, ID prenotazione formato `Pxxxx`, numero WhatsApp valido.

## Deploy

Sito statico — pubblicato su GitHub Pages da `main`.
