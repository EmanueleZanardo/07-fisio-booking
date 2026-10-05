'use strict';
/* =====================================================================
 * Fisio-booking — prenotazioni visite fisioterapiche via WhatsApp (wa.me).
 * Derivato dal template booking-system.
 * MAI inviare messaggi WhatsApp veri da qui: si apre solo wa.me con
 * testo precompilato; l'invio lo fa l'utente toccando "Invia" in WhatsApp.
 * ===================================================================== */

var DEFAULT_SLUG = 'roberta-fisioterapista';
var MAX_RIGHE_MSG = 25;
var MAX_NOTE_CHARS = 300;
var MAX_URL_LEN = 1800;
var ORDER_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // senza ambigui 0/O/1/I
var APERTURA_BUFFER_MIN = 20; // non proporre slot prima di ora + 20 min

function fmtEUR(n) {
  return '€ ' + Number(n).toFixed(2);
}

function genOrderId() {
  var s = 'P';
  for (var i = 0; i < 4; i++) {
    s += ORDER_ID_CHARS.charAt(Math.floor(Math.random() * ORDER_ID_CHARS.length));
  }
  return s;
}

/* Il numero è un segnaposto demo? (flag esplicito oppure 41000000000) */
function isPlaceholderNumber(t) {
  if (!t) return true;
  if (t.demo === true) return true;
  return /^410{9}$/.test(String(t.whatsapp || ''));
}

function validWhatsapp(t) {
  return /^[1-9]\d{7,14}$/.test(String(t.whatsapp || ''));
}

function truncateNote(note) {
  note = String(note || '').trim();
  if (note.length > MAX_NOTE_CHARS) return note.slice(0, MAX_NOTE_CHARS - 1) + '…';
  return note;
}

/* ---------- Orari / slot ---------- */
var GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
var GIORNI_NOME = { dom: 'domenica', lun: 'lunedì', mar: 'martedì', mer: 'mercoledì', gio: 'giovedì', ven: 'venerdì', sab: 'sabato' };

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function hhmmToMin(hhmm) {
  var p = hhmm.split(':');
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

function minToHhmm(m) {
  return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
}

/* Orari di un giorno come testo leggibile, es. "09:00–19:00" */
function orariGiornoTesto(tenant, date) {
  var fasce = (tenant.orari || {})[GIORNI[date.getDay()]];
  if (!fasce || !fasce.length) return 'chiuso';
  return fasce.map(function (f) { return f[0] + '–' + f[1]; }).join(' · ');
}

/* La data è in una chiusura straordinaria (YYYY-MM-DD)? */
function isChiusuraStraordinaria(tenant, date) {
  var iso = date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  return (tenant.chiusureStraordinarie || []).indexOf(iso) !== -1;
}

/* Slot prenotabili per oggi e domani, step = fasceOrarioMin (default 30).
 * Ritorna [{etichetta, valore}] es. "Oggi 10:30". */
function buildSlots(tenant, now) {
  now = now || new Date();
  var step = tenant.fasceOrarioMin || 30;
  var slot = [];
  for (var offset = 0; offset < 2; offset++) {
    var d = new Date(now.getTime());
    d.setDate(d.getDate() + offset);
    if (isChiusuraStraordinaria(tenant, d)) continue;
    var fasce = (tenant.orari || {})[GIORNI[d.getDay()]];
    if (!fasce || !fasce.length) continue;
    var giornoLabel = offset === 0 ? 'Oggi' : (offset === 1 ? 'Domani' : GIORNI_NOME[GIORNI[d.getDay()]]);
    var limiteMin = null;
    if (offset === 0) limiteMin = now.getHours() * 60 + now.getMinutes() + APERTURA_BUFFER_MIN;
    fasce.forEach(function (f) {
      var start = hhmmToMin(f[0]);
      var end = hhmmToMin(f[1]);
      for (var m = start; m + step <= end; m += step) {
        if (limiteMin !== null && m < limiteMin) continue;
        var hhmm = minToHhmm(m);
        slot.push({ etichetta: giornoLabel + ' ' + hhmm, valore: hhmm, giorno: giornoLabel });
      }
    });
  }
  return slot;
}

/* ---------- Messaggio WhatsApp (tipologia prenotazioni) ---------- */
function buildMessage(tenant, righe, form) {
  // righe: [{nome, qta, prezzo}]  form: {nome, telefono, indirizzo, orario, note, orderId}
  var L = [];
  var DIV = '--------------------------';
  L.push('*NUOVA PRENOTAZIONE* — ' + tenant.nome);
  L.push(DIV);

  var righeMsg = righe.slice(0, MAX_RIGHE_MSG);
  righeMsg.forEach(function (r) {
    L.push(r.qta + 'x ' + r.nome + ' — ' + fmtEUR(r.qta * r.prezzo));
  });
  if (righe.length > MAX_RIGHE_MSG) {
    L.push('…+ altre ' + (righe.length - MAX_RIGHE_MSG) + ' voci: dettagli in chat');
  }
  L.push(DIV);

  var totale = righe.reduce(function (s, r) { return s + r.qta * r.prezzo; }, 0);
  L.push('TOTALE STIMATO: ' + fmtEUR(totale) + ' (40 € / seduta da 45 min)');
  L.push(DIV);
  L.push('Nome: ' + form.nome);
  L.push('Telefono: ' + form.telefono);
  L.push('Trattamento a domicilio');
  L.push('Indirizzo: ' + form.indirizzo);
  L.push('Giorno e orario: ' + form.orario);
  L.push('Pagamento: di persona a fine trattamento');
  var note = truncateNote(form.note);
  if (note) L.push('Note: ' + note);
  L.push('Prenotazione #' + form.orderId + ' · inviata dal sito');
  return L.join('\n');
}

function buildWhatsUrl(tenant, message) {
  return 'https://wa.me/' + tenant.whatsapp + '?text=' + encodeURIComponent(message);
}

/* =====================================================================
 * UI (browser)
 * ===================================================================== */
var tenant = null;
var prodottiById = {};
var carrello = {};   // id -> 1 (una sola prenotazione alla volta)
var lastWhatsUrl = null; // ultimo wa.me generato (per "Riapri WhatsApp" dalla conferma)

/* squad-fisio-w1: popup sync + fallback — apre la finestra WhatsApp SUBITO,
 * nel call stack sincrono del gesto utente, prima di qualsiasi validazione
 * async: dopo una catena di fetch il browser bloccherebbe window.open come
 * popup. Restituisce il riferimento alla finestra oppure null. */
function apriWaWinSincrona() {
  try {
    var w = window.open('about:blank', '_blank', 'noopener');
    return w || null;
  } catch (e) {
    return null;
  }
}

function $(id) { return document.getElementById(id); }

function slugFromUrl() {
  try {
    var p = new URLSearchParams(window.location.search).get('tenant');
    return (p || DEFAULT_SLUG).replace(/[^a-z0-9-]/gi, '').toLowerCase() || DEFAULT_SLUG;
  } catch (e) { return DEFAULT_SLUG; }
}

function showError(msg) {
  var box = $('load-error');
  box.hidden = false;
  box.textContent = msg;
  $('t-nome').textContent = 'Errore';
}

function init() {
  var slug = slugFromUrl();
  fetch('tenants/' + encodeURIComponent(slug) + '.json')
    .then(function (res) {
      if (!res.ok) throw new Error('configurazione "' + slug + '" non trovata (HTTP ' + res.status + ')');
      return res.json();
    })
    .then(function (t) {
      tenant = t;
      if (!validWhatsapp(tenant)) {
        showError('Configurazione non valida: numero WhatsApp mancante o malformato nel JSON.');
        return;
      }
      applyTenant();
    })
    .catch(function (err) {
      showError('Impossibile caricare la configurazione: ' + err.message +
        '. Suggerimento: apri questa pagina con un server statico locale, non come file://.');
    });
}

function applyTenant() {
  // Colori dal tenant
  if (tenant.colori && tenant.colori.primario) {
    document.documentElement.style.setProperty('--primario', tenant.colori.primario);
  }
  if (tenant.colori && tenant.colori.sfondo) {
    document.documentElement.style.setProperty('--sfondo', tenant.colori.sfondo);
  }
  /* solidita: il <title> SEO è già ottimizzato in index.html — lo si
   * sovrascrive solo se il tenant ne definisce uno dedicato (seoTitle). */
  if (tenant.seoTitle) {
    document.title = tenant.seoTitle;
  }

  // Banner demo se numero segnaposto
  if (isPlaceholderNumber(tenant)) {
    $('demo-banner').hidden = false;
    $('demo-numero').textContent = '+' + tenant.whatsapp.replace(/(\d{2})(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  }

  $('t-nome').textContent = tenant.nome;
  $('t-desc').textContent = tenant.descrizione || '';
  if (tenant.zone) $('t-zone').textContent = '📍 ' + tenant.zone;

  var now = new Date();
  $('t-orari').textContent = 'Oggi (' + GIORNI_NOME[GIORNI[now.getDay()]] + '): ' + orariGiornoTesto(tenant, now) + ' · giorni e orari definitivi da concordare in chat';

  var slot = buildSlots(tenant, now);
  var stato = $('t-stato');
  if (slot.length > 0) {
    stato.textContent = '● Prenota ora — ti confermiamo su WhatsApp';
    stato.className = 'stato aperto';
  } else {
    stato.textContent = '● Nessuna fascia libera oggi/domani — scrivici comunque in chat';
    stato.className = 'stato chiuso';
    $('orario-avviso').hidden = false;
    $('orario-avviso').textContent = 'La fascia scelta è solo una preferenza: la conferma definitiva arriva in chat WhatsApp.';
  }

  renderMenu();
  renderOrarioSelect(slot);
  bindUI();
  renderCart();
  renderRecensioni(); // solidita: agganciato al caricamento tenant (niente polling)
}

function renderMenu() {
  var menu = $('menu');
  menu.innerHTML = '';
  (tenant.categorie || []).forEach(function (cat) {
    var prodotti = (tenant.prodotti || []).filter(function (p) { return p.categoria === cat.id; });
    if (!prodotti.length) return;
    var sec = document.createElement('section');
    sec.className = 'categoria';
    var h2 = document.createElement('h2');
    h2.textContent = cat.nome;
    sec.appendChild(h2);
    prodotti.forEach(function (p) {
      prodottiById[p.id] = p;
      var art = document.createElement('article');
      art.className = 'prodotto' + (p.disponibile === false ? ' non-disponibile' : '');
      var ICONE_TRATTAMENTI = { riabilitazione: '🏃', dolori: '💆', posturale: '🧘', massoterapia: '🤲' };
      var icon = document.createElement('div');
      icon.className = 'prod-icon';
      icon.textContent = ICONE_TRATTAMENTI[p.id] || '💚';
      icon.setAttribute('aria-hidden', 'true');
      art.appendChild(icon);
      var info = document.createElement('div');
      info.className = 'prodotto-info';
      var h3 = document.createElement('h3');
      h3.textContent = p.nome;
      info.appendChild(h3);
      if (p.descrizione) {
        var d = document.createElement('p');
        d.className = 'desc';
        d.textContent = p.descrizione;
        info.appendChild(d);
      }
      var pr = document.createElement('div');
      pr.className = 'prezzo';
      pr.textContent = fmtEUR(p.prezzo) + ' / seduta';
      info.appendChild(pr);
      art.appendChild(info);
      var azioni = document.createElement('div');
      azioni.className = 'prod-azioni';
      azioni.dataset.id = p.id;

      var meno = document.createElement('button');
      meno.className = 'btn-remove';
      meno.type = 'button';
      meno.textContent = '−';
      meno.setAttribute('aria-label', 'Rimuovi ' + p.nome + ' dalla prenotazione');
      meno.addEventListener('click', function () {
        delete carrello[p.id];
        renderCart();
      });

      var btn = document.createElement('button');
      btn.className = 'btn-add';
      btn.type = 'button';
      btn.textContent = '+';
      btn.setAttribute('aria-label', 'Aggiungi ' + p.nome + ' alla prenotazione');
      btn.addEventListener('click', function () {
        if (p.disponibile === false) return;
        var ids = Object.keys(carrello);
        if (ids.length && !carrello[p.id]) {
          menuAvviso('Puoi prenotare un solo trattamento alla volta: tocca − sul trattamento scelto per cambiarlo.');
          return;
        }
        menuAvviso(null);
        carrello[p.id] = 1;
        renderCart();
      });
      azioni.appendChild(meno);
      azioni.appendChild(btn);
      art.appendChild(azioni);
      sec.appendChild(art);
    });
    menu.appendChild(sec);
  });
}

function renderOrarioSelect(slot) {
  var sel = $('f-orario');
  sel.innerHTML = '';
  /* ux-mobile: errore inline per la fascia oraria (creato via JS, senza toccare index.html) */
  var errEl = $('f-orario-err');
  if (!errEl && sel.parentNode) {
    errEl = document.createElement('p');
    errEl.className = 'campo-err';
    errEl.id = 'f-orario-err';
    errEl.hidden = true;
    sel.parentNode.insertBefore(errEl, sel.nextSibling);
    sel.setAttribute('aria-describedby', 'f-orario-err');
  }
  if (!slot.length) {
    var o = document.createElement('option');
    o.textContent = 'Nessuna fascia disponibile — scrivici in chat';
    o.disabled = true;
    sel.appendChild(o);
    return;
  }
  /* ux-mobile: placeholder esplicito invece della prima fascia pre-selezionata,
   * così la scelta dell'orario è sempre consapevole (bugfix: prima veniva
   * inviata la prima fascia senza che l'utente la scegliesse davvero). */
  var ph = document.createElement('option');
  ph.value = '';
  ph.disabled = true;
  ph.selected = true;
  ph.textContent = 'Scegli la fascia oraria…';
  sel.appendChild(ph);
  slot.forEach(function (s) {
    var o = document.createElement('option');
    o.value = s.etichetta;
    o.textContent = s.etichetta;
    sel.appendChild(o);
  });
}

/* Errore inline dedicato alla select della fascia oraria */
function uxSetOrarioErrore(msg) {
  var sel = $('f-orario');
  var e = $('f-orario-err');
  if (!e) return;
  if (msg) {
    sel.classList.add('is-errore');
    sel.setAttribute('aria-invalid', 'true');
    e.hidden = false;
    e.textContent = msg;
  } else {
    sel.classList.remove('is-errore');
    sel.removeAttribute('aria-invalid');
    e.hidden = true;
    e.textContent = '';
  }
}

/* "Prima disponibilità" — riduce l'attrito: il cliente vede subito quando
 * Roberta può venire, senza scorrere le fasce. Usa la stessa logica di
 * buildSlots; la selezione del trattamento non cambia gli orari, ma il
 * ricalcolo gira anche a ogni cambio carrello (via renderCart) per sicurezza. */
function aggiornaSlotHint() {
  if (!tenant) return;
  var sel = $('f-orario');
  if (!sel) return;
  var hint = $('slot-hint');
  if (!hint) {
    hint = document.createElement('p');
    hint.id = 'slot-hint';
    hint.className = 'slot-hint'; // lo stile lo fa il Builder 3
    if (sel.parentNode) {
      if (sel.nextSibling) sel.parentNode.insertBefore(hint, sel.nextSibling);
      else sel.parentNode.appendChild(hint);
    }
  }
  var slot = buildSlots(tenant, new Date());
  if (!slot.length) {
    hint.hidden = true;
    return;
  }
  hint.hidden = false;
  var primo = slot[0];
  var offset = primo.giorno === 'Domani' ? 1 : 0;
  var d = new Date();
  d.setDate(d.getDate() + offset);
  var giornoNome = primo.giorno === 'Oggi' ? 'oggi' :
    (primo.giorno === 'Domani' ? 'domani' : GIORNI_NOME[GIORNI[d.getDay()]]);
  hint.textContent = 'Prima disponibilità: ' + giornoNome + ' ' + primo.valore;
}

function cartRighe() {
  return Object.keys(carrello).map(function (id) {
    var p = prodottiById[id];
    return { id: id, nome: p.nome, qta: carrello[id], prezzo: p.prezzo };
  });
}

function cartSubtotale() {
  return cartRighe().reduce(function (s, r) { return s + r.qta * r.prezzo; }, 0);
}

function menuAvviso(msg) {
  var e = $('menu-avviso');
  if (!msg) { e.hidden = true; e.textContent = ''; return; }
  e.hidden = false;
  e.textContent = msg;
}

/* Abilita/disabilita + e − sulle schede in base al carrello (un solo item) */
function refreshMenuButtons() {
  var ids = Object.keys(carrello);
  Array.prototype.forEach.call(document.querySelectorAll('.prod-azioni'), function (az) {
    var id = az.getAttribute('data-id');
    var inCart = !!carrello[id];
    var btnAdd = az.querySelector('.btn-add');
    var btnRem = az.querySelector('.btn-remove');
    btnAdd.disabled = !inCart && ids.length > 0;
    btnAdd.textContent = inCart ? '✓' : '+';
    btnAdd.classList.toggle('in-cart', inCart);
    btnRem.disabled = !inCart;
  });
}

function renderCart() {
  var righe = cartRighe();
  var count = righe.reduce(function (s, r) { return s + r.qta; }, 0);
  var totale = cartSubtotale();

  refreshMenuButtons();

  var bar = $('cartbar');
  if (count === 0) {
    bar.hidden = true;
  } else {
    bar.hidden = false;
    $('cartbar-testo').textContent = '🗓 ' + count + (count === 1 ? ' seduta' : ' sedute') + ' · ' + fmtEUR(totale);
  }

  // Drawer
  var box = $('righe');
  box.innerHTML = '';
  if (!righe.length) {
    box.innerHTML = '<p class="muted">Nessun trattamento selezionato. Tocca + sul trattamento per aggiungerlo (uno alla volta).</p>';
  }
  righe.forEach(function (r) {
    var div = document.createElement('div');
    div.className = 'riga';
    var nome = document.createElement('span');
    nome.className = 'r-nome';
    nome.textContent = r.nome;
    div.appendChild(nome);

    var prezzo = document.createElement('span');
    prezzo.className = 'r-prezzo';
    prezzo.textContent = fmtEUR(r.qta * r.prezzo);
    div.appendChild(prezzo);

    var rim = document.createElement('button');
    rim.type = 'button'; rim.className = 'r-rimuovi'; rim.textContent = '🗑';
    rim.setAttribute('aria-label', 'Rimuovi ' + r.nome);
    rim.addEventListener('click', function () {
      delete carrello[r.id];
      renderCart();
    });
    div.appendChild(rim);

    box.appendChild(div);
  });

  var sub = cartSubtotale();
  var tot = $('totali');
  tot.innerHTML = '';
  function tRiga(label, valore, forte) {
    var d = document.createElement('div');
    d.className = 't-riga' + (forte ? ' t-totale' : '');
    var a = document.createElement('span'); a.textContent = label;
    var b = document.createElement('span'); b.textContent = valore;
    d.appendChild(a); d.appendChild(b);
    tot.appendChild(d);
  }
  tRiga('Totale stimato (' + fmtEUR(40) + ' / seduta da 45 min)', fmtEUR(sub), true);

  aggiornaSlotHint();
}

function openDrawer() {
  $('drawer').hidden = false;
  $('drawer-sfondo').hidden = false;
  document.body.style.overflow = 'hidden';
  // ciclo2-ux-mobile: passo dello step indicator, focus iniziale, ESC + focus trap
  ciclo2LastFocus = document.activeElement;
  var haDati = ['f-nome', 'f-telefono', 'f-indirizzo', 'f-note'].some(function (id) {
    return $(id).value.trim() !== '';
  });
  ciclo2SetStep(haDati ? 2 : 1);
  $('drawer').focus();
  document.addEventListener('keydown', ciclo2Keydown);
}
function closeDrawer() {
  $('drawer').hidden = true;
  $('drawer-sfondo').hidden = true;
  document.body.style.overflow = '';
  // ciclo2-ux-mobile: rimuove i listener e ripristina il focus sul trigger
  document.removeEventListener('keydown', ciclo2Keydown);
  if (ciclo2LastFocus && typeof ciclo2LastFocus.focus === 'function') {
    try { ciclo2LastFocus.focus(); } catch (e) { /* focus opzionale */ }
  }
  ciclo2LastFocus = null;
}

function bindUI() {
  $('cartbar').addEventListener('click', openDrawer);
  $('drawer-chiudi').addEventListener('click', closeDrawer);
  $('drawer-sfondo').addEventListener('click', closeDrawer);

  $('conferma-chiudi').addEventListener('click', hideConferma);
  $('conferma-sfondo').addEventListener('click', hideConferma);
  $('conferma-riapri').addEventListener('click', function () {
    if (lastWhatsUrl) window.open(lastWhatsUrl, '_blank', 'noopener');
  });

  $('ordine-form').addEventListener('submit', onSubmit);

  // ux-mobile: l'errore sulla fascia oraria si cancella appena si sceglie un'opzione
  $('f-orario').addEventListener('change', function () {
    if ($('f-orario').value) {
      uxSetOrarioErrore(null);
      if ($('form-error').textContent.indexOf('fascia oraria') !== -1) formError(null);
    }
  });

  // ciclo2-ux-mobile: validazione live + passo 2 allo step indicator + scroll tastiera
  var form = $('ordine-form');
  Object.keys(CICLO2_CAMPI).forEach(function (id) {
    var input = $(id);
    input.addEventListener('blur', function () {
      ciclo2Touched[id] = true;
      ciclo2ValidaCampo(id);
    });
    input.addEventListener('input', function () {
      if (ciclo2Touched[id]) ciclo2ValidaCampo(id);
    });
  });
  form.addEventListener('focusin', function (ev) {
    var tag = ev.target && ev.target.tagName;
    if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return;
    ciclo2SetStep(2);
    // tiene il campo visibile sopra la tastiera mobile
    setTimeout(function () {
      try { ev.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* scroll opzionale */ }
    }, 350);
  });
}

/* Evento analytics (Vercel Web Analytics, senza cookie): mai bloccare la prenotazione */
function trackPrenotazione(orderId) {
  try {
    if (typeof window !== 'undefined' && typeof window.va === 'function') {
      window.va('event', { name: 'prenotazione_whatsapp', data: { orderId: orderId } });
    }
  } catch (e) { /* analytics opzionale */ }
}

/* Schermata di conferma post-prenotazione */
function showConferma(orderId) {
  $('conferma-id').textContent = '(' + orderId + ')';
  $('conferma').hidden = false;
  $('conferma-sfondo').hidden = false;
  document.body.style.overflow = 'hidden';
}
function hideConferma() {
  $('conferma').hidden = true;
  $('conferma-sfondo').hidden = true;
  document.body.style.overflow = '';
}

function formError(msg) {
  var e = $('form-error');
  if (!msg) { e.hidden = true; e.textContent = ''; return; }
  e.hidden = false;
  e.textContent = msg;
}

function onSubmit(ev) {
  ev.preventDefault();
  formError(null);

  /* ciclo2-ux-mobile: guardia anti-doppio-invio migliorata (non duplicata).
   * Flag + cooldown dopo l'invio riuscito: window.open è asincrona, quindi
   * riabilitare subito il bottone permetterebbe un secondo tap. */
  if (ciclo2InvioInCorso) return;
  ciclo2InvioInCorso = true;
  var btn = $('btn-ordina');
  btn.disabled = true;
  btn.classList.add('is-caricamento');
  var orig = btn.textContent;
  btn.textContent = 'Messaggio preparato — completalo in WhatsApp…';
  function sbloccaBtn(cooldownMs) {
    function riabilita() {
      btn.disabled = false;
      btn.classList.remove('is-caricamento');
      btn.textContent = orig;
      ciclo2InvioInCorso = false;
    }
    if (cooldownMs) setTimeout(riabilita, cooldownMs);
    else riabilita();
  }

  var righe = cartRighe();
  if (!righe.length) { formError('Nessun trattamento selezionato: aggiungine uno.'); sbloccaBtn(); return; }

  /* ciclo2-ux-mobile: validazione inline estesa (nome min 2 caratteri,
   * telefono con pattern IT/CH tollerante, indirizzo obbligatorio).
   * Focus automatico sul primo campo errato. */
  var ids = ['f-nome', 'f-telefono', 'f-indirizzo'];
  var primoErrore = null;
  ids.forEach(function (id) {
    ciclo2Touched[id] = true;
    if (!ciclo2ValidaCampo(id) && !primoErrore) primoErrore = id;
  });
  if (primoErrore) {
    formError('Controlla i campi evidenziati in rosso.');
    $(primoErrore).focus();
    sbloccaBtn();
    return;
  }

  ciclo2SetStep(3); // passo "Conferma su WhatsApp"

  var nome = $('f-nome').value.trim();
  var telefono = $('f-telefono').value.trim();
  var indirizzo = $('f-indirizzo').value.trim();
  var note = $('f-note').value;

  if (dispOnline) {
    /* Prenotazione con slot reale: giorno+orario scelti, verifica e occupa */
    if (!dispSlotSel) {
      dispSlotErrore('Scegli il giorno e l\u2019orario.');
      formError('Scegli il giorno e l\u2019orario.');
      sbloccaBtn();
      return;
    }
    dispSlotErrore(null);
    /* squad-fisio-w1: popup sync + fallback — la finestra si apre qui, nel
     * gesto utente sincrono; completaPrenotazione la navigherà a url dopo
     * la catena async (GET→PATCH→POST) senza chiamare window.open. */
    dispPrenotaSlot({
      nome: nome, telefono: telefono, indirizzo: indirizzo,
      note: note, righe: righe, sbloccaBtn: sbloccaBtn,
      waWin: apriWaWinSincrona()
    });
    return;
  }

  var orario = $('f-orario').value;

  /* ux-mobile: la fascia oraria va scelta davvero (placeholder vuoto di default) */
  if (!orario) {
    uxSetOrarioErrore('Scegli una fascia oraria preferita.');
    formError('Scegli una fascia oraria preferita.');
    $('f-orario').focus();
    sbloccaBtn();
    return;
  }
  uxSetOrarioErrore(null);

  completaPrenotazione({
    nome: nome, telefono: telefono, indirizzo: indirizzo,
    orario: orario, note: note, righe: righe, sbloccaBtn: sbloccaBtn,
    waWin: apriWaWinSincrona() /* squad-fisio-w1: popup sync + fallback */
  });
}

/* Coda finale comune: messaggio WhatsApp + conferma (usata da entrambi i flussi) */
function completaPrenotazione(d) {
  var orderId = genOrderId();
  var message = buildMessage(tenant, d.righe, {
    nome: d.nome, telefono: d.telefono,
    indirizzo: d.indirizzo, orario: d.orario, note: d.note, orderId: orderId
  });
  var url = buildWhatsUrl(tenant, message);

  if (url.length > MAX_URL_LEN) {
    formError('Prenotazione troppo lunga per WhatsApp: chiamaci al +' + tenant.whatsapp + ' per completarla.');
    /* squad-fisio-w1: popup sync + fallback — niente tab vuota orfana */
    if (d.waWin && !d.waWin.closed) { try { d.waWin.close(); } catch (e) { /* già chiusa */ } }
    d.sbloccaBtn();
    return;
  }

  lastWhatsUrl = url; // resta per "Riapri WhatsApp" dalla conferma
  /* squad-fisio-w1: popup sync + fallback — naviga la finestra aperta nel
   * gesto utente invece di window.open (bloccato dopo catene async). Se è
   * null/chiusa non fallire in silenzio: la conferma mostra il bottone
   * "Riapri WhatsApp" (target _blank, rel noopener) verso url e gli diamo focus. */
  var popupOk = false;
  if (d.waWin && !d.waWin.closed) {
    try { d.waWin.location.href = url; popupOk = true; }
    catch (e) { popupOk = false; }
  }
  d.sbloccaBtn(2500); // cooldown anti-doppio-tap (ciclo2-ux-mobile)
  trackPrenotazione(orderId);
  /* squad-fisio-w3: promemoria locale della richiesta (solo browser, nessun invio) */
  try {
    if (window.FisioReminders && typeof window.FisioReminders.registra === 'function') {
      var primoTratt = (d.righe && d.righe.length && d.righe[0] && d.righe[0].nome) ? d.righe[0].nome : '';
      window.FisioReminders.registra({ orderId: orderId, nome: d.nome, trattamento: primoTratt, quando: d.orario || '' });
    }
  } catch (eRem) { /* promemoria opzionale: mai bloccare la prenotazione */ }
  showConferma(orderId);
  if (!popupOk) {
    var btnRiapri = $('conferma-riapri');
    if (btnRiapri && typeof btnRiapri.focus === 'function') {
      try { btnRiapri.focus(); } catch (e2) { /* focus opzionale */ }
    }
  }
}

/* =====================================================================
 * ciclo2-ux-mobile — step indicator, validazione inline, ESC + focus trap
 * ===================================================================== */
var ciclo2LastFocus = null;    // elemento a cui restituire il focus alla chiusura
var ciclo2InvioInCorso = false; // guardia anti-doppio-invio migliorata

/* Passo attivo dello step indicator nel drawer (1 Riepilogo → 2 I tuoi
 * dati → 3 Conferma su WhatsApp), con aria-current per gli screen reader. */
function ciclo2SetStep(n) {
  var passi = document.querySelectorAll('#drawer-steps .ds-step');
  Array.prototype.forEach.call(passi, function (li) {
    var p = parseInt(li.getAttribute('data-passo'), 10);
    li.classList.toggle('is-attivo', p === n);
    li.classList.toggle('is-completato', p < n);
    if (p === n) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
  });
}

/* Validatori per campo: estendono (non rompono) i controlli esistenti. */
var CICLO2_CAMPI = {
  'f-nome': {
    err: 'f-nome-err',
    valida: function (v) {
      if (!v) return 'Inserisci il tuo nome.';
      if (v.length < 2) return 'Il nome deve avere almeno 2 caratteri.';
      return null;
    }
  },
  'f-telefono': {
    err: 'f-telefono-err',
    valida: function (v) {
      if (!v) return 'Inserisci il tuo numero di telefono.';
      var cifre = v.replace(/\D/g, '');
      // pattern IT/CH tollerante: +, spazi, punti, trattini, slash, parentesi
      var ok = /^[+(\s]{0,3}\d[\d\s.\-()/]*$/.test(v) && cifre.length >= 6 && cifre.length <= 15;
      if (!ok) return 'Numero non valido: usa un numero italiano o svizzero, es. 345 111 4337 o +41 91 123 45 67.';
      return null;
    }
  },
  'f-indirizzo': {
    err: 'f-indirizzo-err',
    valida: function (v) {
      if (!v) return 'Inserisci l\u2019indirizzo dove ricevere il trattamento.';
      if (v.length < 4) return 'Indirizzo troppo corto: indica via, numero civico e località.';
      return null;
    }
  }
};
var ciclo2Touched = {};

function ciclo2MostraErrore(id, msg) {
  var input = $(id);
  var e = $(CICLO2_CAMPI[id].err);
  if (msg) {
    input.classList.add('is-errore');
    input.setAttribute('aria-invalid', 'true');
    e.hidden = false;
    e.textContent = msg;
  } else {
    input.classList.remove('is-errore');
    input.removeAttribute('aria-invalid');
    e.hidden = true;
    e.textContent = '';
  }
}

function ciclo2ValidaCampo(id) {
  var msg = CICLO2_CAMPI[id].valida($(id).value.trim());
  ciclo2MostraErrore(id, msg);
  return !msg;
}

/* ESC chiude il drawer; Tab resta intrappolato nel drawer (focus trap leggera). */
function ciclo2Keydown(ev) {
  if ($('drawer').hidden) return;
  if (ev.key === 'Escape' || ev.key === 'Esc') {
    ev.preventDefault();
    closeDrawer();
    return;
  }
  if (ev.key !== 'Tab') return;
  if (!$('conferma').hidden) return; // la schermata di conferma ha la priorità
  var drawer = $('drawer');
  var focusables = drawer.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables.length) return;
  var first = focusables[0];
  var last = focusables[focusables.length - 1];
  if (ev.shiftKey && document.activeElement === first) {
    ev.preventDefault();
    last.focus();
  } else if (!ev.shiftKey && document.activeElement === last) {
    ev.preventDefault();
    first.focus();
  }
}

/* Avvio */
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

/* Esportato per test in Node (nessun effetto nel browser) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fmtEUR: fmtEUR,
    genOrderId: genOrderId,
    isPlaceholderNumber: isPlaceholderNumber,
    validWhatsapp: validWhatsapp,
    truncateNote: truncateNote,
    buildSlots: buildSlots,
    orariGiornoTesto: orariGiornoTesto,
    buildMessage: buildMessage,
    buildWhatsUrl: buildWhatsUrl,
    MAX_URL_LEN: MAX_URL_LEN,
    MAX_RIGHE_MSG: MAX_RIGHE_MSG
  };
}

// ciclo2-recensioni
function renderRecensioni() {
  var box = document.getElementById('recensioni-lista');
  if (!box) return;
  var recs = (typeof tenant !== 'undefined' && tenant && Array.isArray(tenant.recensioni)) ? tenant.recensioni : [];
  box.innerHTML = '';
  if (recs.length === 0) {
    var ph = document.createElement('div');
    ph.className = 'recensioni-placeholder';
    ph.textContent = 'Ancora nessuna recensione pubblicata.';
    box.appendChild(ph);
    return;
  }
  recs.forEach(function (r) {
    var art = document.createElement('article');
    art.className = 'recensione';
    var stelle = document.createElement('div');
    stelle.className = 'recensione-stelle';
    var n = Math.max(0, Math.min(5, parseInt(r.stelle, 10) || 0));
    stelle.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    stelle.setAttribute('aria-label', n + ' su 5 stelle');
    art.appendChild(stelle);
    var txt = document.createElement('p');
    txt.textContent = r.testo || '';
    art.appendChild(txt);
    var autore = document.createElement('p');
    autore.className = 'recensione-autore';
    autore.textContent = (r.nome || 'Paziente') + (r.data ? ' — ' + r.data : '');
    art.appendChild(autore);
    box.appendChild(art);
  });
}

/* solidita: renderRecensioni() è ora chiamato da applyTenant() a tenant
 * caricato — niente più polling. La funzione resta definita qui sopra. */

/* =====================================================================
 * Admin incassi (Roberta) — statistiche su Supabase condiviso.
 * Tabella fisio_incassi(id, data, trattamento, prezzo, note, created_at).
 * Le due costanti sotto sono placeholder: vanno compilate con URL e
 * anon key del progetto Supabase prima di usare il pannello.
 * ===================================================================== */
var SUPABASE_URL = 'https://poyodlfqxoprmictvmaj.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveW9kbGZxeG9wcm1pY3R2bWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NzM2ODEsImV4cCI6MjEwNjU0OTY4MX0.pcOHsGfrQwEQ3XwldYOoqviw_BMg55aPsJ4R6lF_Ks0';
var ADMIN_PIN = 'admin123';

var adminChartMesi = null;
var adminChartTratt = null;
var adminRows = [];
var adminTrattCache = null;

function sbConfigured() {
  return SUPABASE_URL && SUPABASE_URL.indexOf('__SUPABASE') !== 0 &&
         SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.indexOf('__SUPABASE') !== 0;
}

/* Helper REST Supabase: header apikey + Authorization Bearer */
function sb(path, opts) {
  opts = opts || {};
  var h = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  };
  if (opts.headers) Object.keys(opts.headers).forEach(function (k) { h[k] = opts.headers[k]; });
  return fetch(SUPABASE_URL + '/rest/v1/' + path, {
    method: opts.method || 'GET',
    headers: h,
    body: opts.body
  });
}

function adminAvviso(msg) {
  var e = $('admin-avviso');
  if (!msg) { e.hidden = true; e.textContent = ''; return; }
  e.hidden = false;
  e.textContent = msg;
}

/* ---------- PIN ---------- */
function adminOpenPin() {
  try {
    if (sessionStorage.getItem('fisio_admin') === '1') { adminShow(); return; }
  } catch (e) { /* sessionStorage opzionale */ }
  $('pin-panel').hidden = false;
  $('pin-sfondo').hidden = false;
  $('pin-err').hidden = true;
  $('pin-input').value = '';
  setTimeout(function () { try { $('pin-input').focus(); } catch (e) {} }, 50);
}

function adminClosePin() {
  $('pin-panel').hidden = true;
  $('pin-sfondo').hidden = true;
}

function onPinSubmit(ev) {
  ev.preventDefault();
  if ($('pin-input').value === ADMIN_PIN) {
    try { sessionStorage.setItem('fisio_admin', '1'); } catch (e) {}
    adminShow();
  } else {
    var e = $('pin-err');
    e.hidden = false;
    e.textContent = 'PIN errato.';
  }
}

/* ---------- Apertura pannello ---------- */
function adminShow() {
  adminClosePin();
  adminAvviso(null);
  $('admin-panel').hidden = false;
  $('admin-sfondo').hidden = false;
  document.body.style.overflow = 'hidden';
  var d = $('a-data');
  if (!d.value) d.value = new Date().toISOString().slice(0, 10); // default: oggi
  adminFillTrattamenti();
  if (!sbConfigured()) {
    adminAvviso('Database non collegato: le statistiche sono disattivate finché non vengono inserite le chiavi Supabase.');
    adminRenderRighe([]);
    return;
  }
  /* Chart.js caricato lazily dal CDN solo quando si apre l'admin */
  loadChartJs()
    .catch(function () {
      adminAvviso('Grafici non caricati (CDN non raggiungibile): tabella e KPI restano disponibili.');
    })
    .then(function () { adminReload(); });
}

function adminClose() {
  $('admin-panel').hidden = true;
  $('admin-sfondo').hidden = true;
  document.body.style.overflow = '';
}

var chartJsPromise = null;
function loadChartJs() {
  if (typeof window !== 'undefined' && window.Chart) return Promise.resolve();
  if (!chartJsPromise) {
    chartJsPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Chart.js non caricato')); };
      document.head.appendChild(s);
    });
  }
  return chartJsPromise;
}

/* ---------- Form: trattamenti dal tenant ---------- */
function adminFillTrattamenti() {
  var sel = $('a-trattamento');
  if (sel.options.length && adminTrattCache) return;
  sel.innerHTML = '';
  var prods = (typeof tenant !== 'undefined' && tenant && tenant.prodotti) ? tenant.prodotti : [];
  adminTrattCache = {};
  prods.filter(function (p) { return p.disponibile !== false; }).forEach(function (p) {
    adminTrattCache[p.nome] = p.prezzo;
    var o = document.createElement('option');
    o.value = p.nome;
    o.textContent = p.nome + ' — ' + fmtEUR(p.prezzo);
    sel.appendChild(o);
  });
  if (!sel.options.length) {
    var o = document.createElement('option');
    o.value = '';
    o.disabled = true;
    o.textContent = 'Nessun trattamento disponibile';
    sel.appendChild(o);
  }
  adminSyncPrezzo();
}

function adminSyncPrezzo() {
  var sel = $('a-trattamento');
  var p = adminTrattCache && adminTrattCache[sel.value];
  if (p !== undefined && p !== null) $('a-prezzo').value = Number(p).toFixed(2);
}

/* ---------- Lettura righe ---------- */
function adminReload() {
  adminAvviso(null);
  sb('fisio_incassi?select=id,data,trattamento,prezzo,note&order=data.desc,created_at.desc')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (rows) {
      adminRows = rows || [];
      adminRenderRighe(adminRows);
      adminRenderKpi(adminRows);
      adminRenderCharts(adminRows);
    })
    .catch(function (err) {
      adminAvviso('Impossibile caricare gli incassi: ' + err.message);
    });
}

/* ---------- Tabella righe ---------- */
function adminRenderRighe(rows) {
  var box = $('admin-righe');
  box.innerHTML = '';
  if (!rows.length) {
    box.innerHTML = '<p class="muted">Nessuna seduta registrata.</p>';
    return;
  }
  var wrap = document.createElement('div');
  wrap.className = 'admin-tab-wrap';
  var t = document.createElement('table');
  t.className = 'admin-tab';
  var thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Data</th><th>Trattamento</th><th>Prezzo</th><th>Note</th><th></th></tr>';
  t.appendChild(thead);
  var tb = document.createElement('tbody');
  rows.forEach(function (r) {
    var tr = document.createElement('tr');
    var d = new Date(String(r.data) + 'T12:00:00');
    var dataTxt = isNaN(d.getTime()) ? String(r.data) : d.toLocaleDateString('it-IT');
    var td1 = document.createElement('td'); td1.textContent = dataTxt;
    var td2 = document.createElement('td'); td2.textContent = r.trattamento;
    var td3 = document.createElement('td'); td3.className = 'num'; td3.textContent = fmtEUR(r.prezzo);
    var td4 = document.createElement('td'); td4.textContent = r.note || '';
    var td5 = document.createElement('td');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'admin-del'; b.textContent = '🗑';
    b.setAttribute('aria-label', 'Elimina riga ' + dataTxt + ' ' + r.trattamento);
    (function (id) {
      b.addEventListener('click', function () { adminDel(id); });
    })(r.id);
    td5.appendChild(b);
    [td1, td2, td3, td4, td5].forEach(function (td) { tr.appendChild(td); });
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  wrap.appendChild(t);
  box.appendChild(wrap);
}

function adminDel(id) {
  if (!confirm('Eliminare questa riga?')) return;
  adminAvviso(null);
  sb('fisio_incassi?id=eq.' + encodeURIComponent(id), { method: 'DELETE' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      adminReload();
    })
    .catch(function (err) {
      adminAvviso('Eliminazione non riuscita: ' + err.message);
    });
}

/* ---------- Aggiungi riga ---------- */
function onAdminAdd(ev) {
  ev.preventDefault();
  adminAvviso(null);
  var data = $('a-data').value;
  var trattamento = $('a-trattamento').value;
  var prezzo = parseFloat(String($('a-prezzo').value).replace(',', '.'));
  var note = $('a-note').value.trim();
  if (!data) { adminAvviso('Scegli la data della seduta.'); return; }
  if (!trattamento) { adminAvviso('Scegli il trattamento.'); return; }
  if (isNaN(prezzo) || prezzo < 0) { adminAvviso('Prezzo non valido.'); return; }
  var btn = $('admin-aggiungi');
  btn.disabled = true;
  function fatto() { btn.disabled = false; }
  sb('fisio_incassi', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify({ data: data, trattamento: trattamento, prezzo: prezzo, note: note })
  })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function () {
      $('a-note').value = '';
      adminReload();
      fatto();
    }, function (err) {
      adminAvviso('Salvataggio non riuscito: ' + err.message);
      fatto();
    });
}

/* ---------- KPI ---------- */
function adminRenderKpi(rows) {
  var tot = rows.reduce(function (s, r) { return s + Number(r.prezzo || 0); }, 0);
  var n = rows.length;
  $('kpi-totale').textContent = fmtEUR(tot);
  $('kpi-n').textContent = String(n);
  $('kpi-media').textContent = n ? fmtEUR(tot / n) : '—';
  var perT = {};
  rows.forEach(function (r) { perT[r.trattamento] = (perT[r.trattamento] || 0) + Number(r.prezzo || 0); });
  var top = null, topV = 0;
  Object.keys(perT).forEach(function (k) { if (perT[k] > topV) { topV = perT[k]; top = k; } });
  $('kpi-top').textContent = top ? (top + ' (' + fmtEUR(topV) + ')') : '—';
}

/* ---------- Grafici ---------- */
var MESI_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
var CHART_COLORS = ['#0E7C6B', '#25D366', '#0A5F52', '#2AA198', '#66BB6A', '#81C784', '#26A69A', '#00897B', '#A5D6A7', '#C8E6C9'];

function adminRenderCharts(rows) {
  if (typeof Chart === 'undefined') return;
  /* Bar: incassi per mese, ultimi 12 mesi */
  var now = new Date();
  var mesi = [];
  for (var i = 11; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    mesi.push({
      key: d.getFullYear() + '-' + (d.getMonth() + 1),
      label: MESI_IT[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2),
      tot: 0
    });
  }
  var idx = {};
  mesi.forEach(function (x, j) { idx[x.key] = j; });
  rows.forEach(function (r) {
    if (!r.data) return;
    var p = String(r.data).split('-');
    if (p.length < 2) return;
    var k = parseInt(p[0], 10) + '-' + parseInt(p[1], 10);
    if (idx[k] !== undefined) mesi[idx[k]].tot += Number(r.prezzo || 0);
  });
  if (adminChartMesi) adminChartMesi.destroy();
  adminChartMesi = new Chart(document.getElementById('chart-mesi'), {
    type: 'bar',
    data: {
      labels: mesi.map(function (x) { return x.label; }),
      datasets: [{
        label: 'Incassi (€)',
        data: mesi.map(function (x) { return Math.round(x.tot * 100) / 100; }),
        backgroundColor: '#0E7C6B'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Incassi per mese (ultimi 12 mesi)' }
      },
      scales: { y: { beginAtZero: true } }
    }
  });
  /* Doughnut: incassi per trattamento */
  var perT = {};
  rows.forEach(function (r) { perT[r.trattamento] = (perT[r.trattamento] || 0) + Number(r.prezzo || 0); });
  var labels = [], vals = [];
  Object.keys(perT).forEach(function (k) {
    labels.push(k);
    vals.push(Math.round(perT[k] * 100) / 100);
  });
  if (adminChartTratt) adminChartTratt.destroy();
  adminChartTratt = null;
  if (labels.length) {
    adminChartTratt = new Chart(document.getElementById('chart-trattamenti'), {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{ data: vals, backgroundColor: CHART_COLORS.slice(0, labels.length) }]
      },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: 'Incassi per trattamento' } }
      }
    });
  }
}

/* ---------- Bind ---------- */
function adminBind() {
  var link = $('admin-link');
  if (link) link.addEventListener('click', adminOpenPin);
  $('pin-sfondo').addEventListener('click', adminClosePin);
  $('pin-annulla').addEventListener('click', adminClosePin);
  $('pin-form').addEventListener('submit', onPinSubmit);
  $('admin-chiudi').addEventListener('click', adminClose);
  $('admin-sfondo').addEventListener('click', adminClose);
  $('admin-form').addEventListener('submit', onAdminAdd);
  $('a-trattamento').addEventListener('change', adminSyncPrezzo);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' || ev.key === 'Esc') {
      if (!$('admin-panel').hidden) adminClose();
      else if (!$('pin-panel').hidden) adminClosePin();
    }
  });
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', adminBind);
}

/* =====================================================================
 * Disponibilità reali (Supabase: fisio_slot / fisio_prenotazioni).
 * Prenotazione: giorno → slot libero → form → conferma → slot occupato.
 * Se le tabelle non esistono ancora: nessun crash, si usa la vecchia
 * select delle fasce come preferenza (dispFallback).
 * ===================================================================== */
var dispOnline = false;
var dispSlots = [];
var dispGiornoSel = null;
var dispSlotSel = null;

function isoData(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function parseISODate(iso) {
  var p = iso.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
function fmtDataBreve(iso) {
  var d = parseISODate(iso);
  return GIORNI_NOME[GIORNI[d.getDay()]].slice(0, 3) + ' ' + pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1);
}
function fmtDataLunga(iso) {
  var d = parseISODate(iso);
  return GIORNI_NOME[GIORNI[d.getDay()]] + ' ' + pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
}
function fmtOra(hms) { return String(hms).slice(0, 5); }

function dispLoad() {
  if (!sbConfigured()) { dispFallback('Database non collegato: scegli una fascia come preferenza.'); return; }
  var oggi = isoData(new Date());
  var fra60 = isoData(new Date(Date.now() + 60 * 864e5));
  sb('fisio_slot?select=id,data,ora_inizio,ora_fine,stato&data=gte.' + oggi + '&data=lte.' + fra60 + '&order=data.asc,ora_inizio.asc', {})
    .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
    .then(function (rows) {
      dispOnline = true;
      dispSlots = rows || [];
      dispMostraPicker();
      dispAggiornaHint();
    })
    .catch(function () { dispFallback('Disponibilità online non configurate: scegli una fascia come preferenza.'); });
}

function dispFallback(msg) {
  dispOnline = false;
  var picker = $('slot-picker'), fb = $('fascia-fallback');
  if (picker) picker.hidden = true;
  if (fb) fb.hidden = false;
  var av = $('orario-avviso');
  if (msg && av) { av.hidden = false; av.textContent = msg; }
}

function dispMostraPicker() {
  var picker = $('slot-picker'), fb = $('fascia-fallback');
  if (!picker || !fb) return;
  picker.hidden = false;
  fb.hidden = true;
  dispGiornoSel = null;
  dispSlotSel = null;
  dispRenderGiorni();
  dispRenderSlot();
}

function dispSlotLiberi() {
  return dispSlots.filter(function (s) { return s.stato === 'libero'; });
}

function dispGiorniDisponibili() {
  var perData = {};
  dispSlotLiberi().forEach(function (s) { (perData[s.data] = perData[s.data] || []).push(s); });
  var out = [], oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  for (var i = 0; i < 30; i++) {
    var iso = isoData(new Date(oggi.getTime() + i * 864e5));
    if (perData[iso] && perData[iso].length) out.push({ iso: iso, n: perData[iso].length });
  }
  return out;
}

function dispRenderGiorni() {
  var strip = $('day-strip');
  if (!strip) return;
  strip.innerHTML = '';
  var giorni = dispGiorniDisponibili();
  var av = $('slot-avviso');
  if (!giorni.length) {
    if (av) { av.hidden = false; av.textContent = 'Nessuna disponibilità nei prossimi 30 giorni — scrivici in chat WhatsApp.'; }
    return;
  }
  if (av) av.hidden = true;
  giorni.forEach(function (g) {
    var d = parseISODate(g.iso);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'day-btn' + (g.iso === dispGiornoSel ? ' sel' : '');
    b.setAttribute('role', 'option');
    b.setAttribute('aria-selected', g.iso === dispGiornoSel ? 'true' : 'false');
    b.innerHTML = '<span class="day-dow">' + GIORNI_NOME[GIORNI[d.getDay()]].slice(0, 3) + '</span>' +
                  '<span class="day-num">' + pad2(d.getDate()) + '</span>' +
                  '<span class="day-mon">' + pad2(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2) + '</span>';
    b.title = g.n + ' slot liberi';
    b.addEventListener('click', function () {
      dispGiornoSel = g.iso;
      dispSlotSel = null;
      dispRenderGiorni();
      dispRenderSlot();
      dispSlotErrore(null);
    });
    strip.appendChild(b);
  });
}

function dispRenderSlot() {
  var box = $('slot-chips');
  if (!box) return;
  box.innerHTML = '';
  if (!dispGiornoSel) {
    box.innerHTML = '<p class="muted small">Prima scegli il giorno.</p>';
    return;
  }
  var slot = dispSlotLiberi().filter(function (s) { return s.data === dispGiornoSel; });
  if (!slot.length) {
    box.innerHTML = '<p class="muted small">Nessun orario libero questo giorno.</p>';
    return;
  }
  slot.forEach(function (s) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot-chip' + (s.id === dispSlotSel ? ' sel' : '');
    b.setAttribute('role', 'option');
    b.setAttribute('aria-selected', s.id === dispSlotSel ? 'true' : 'false');
    b.textContent = fmtOra(s.ora_inizio) + '–' + fmtOra(s.ora_fine);
    b.addEventListener('click', function () {
      dispSlotSel = s.id;
      dispRenderSlot();
      dispSlotErrore(null);
    });
    box.appendChild(b);
  });
}

function dispSlotErrore(msg) {
  var e = $('f-slot-err');
  if (!e) return;
  if (msg) { e.hidden = false; e.textContent = msg; }
  else { e.hidden = true; e.textContent = ''; }
}

function dispAggiornaHint() {
  var hint = $('slot-hint');
  if (!hint || !dispOnline) return;
  var liberi = dispSlotLiberi();
  if (!liberi.length) { hint.hidden = true; return; }
  var s = liberi[0];
  hint.hidden = false;
  hint.textContent = 'Prima disponibilità: ' + fmtDataBreve(s.data) + ' ore ' + fmtOra(s.ora_inizio);
}

/* Conferma con slot reale: occupazione atomica (PATCH condizionale) + rollback */
/* squad-fisio-w2: booking atomico + rollback */
function dispPrenotaSlot(d) {
  sb('fisio_slot?select=id,stato,data,ora_inizio,ora_fine&id=eq.' + dispSlotSel, {})
    .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
    .then(function (rows) {
      var s = (rows || [])[0];
      if (!s || s.stato !== 'libero') throw new Error('occupato');
      /* squad-fisio-w2: PATCH condizionale sullo stato=libero — è il vero gate
         atomico (la GET sopra è solo fast-path). Se l'array restituito è vuoto,
         un altro utente ha occupato lo slot nel frattempo (race). */
      return sb('fisio_slot?id=eq.' + s.id + '&stato=eq.libero', {
        method: 'PATCH',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({ stato: 'occupato' })
      }).then(function (r2) {
        if (!r2.ok) throw new Error('patch ' + r2.status);
        return r2.json();
      }).then(function (upd) {
        if (!(upd || []).length) throw new Error('occupato');
        return s;
      });
    })
    .then(function (s) {
      return sb('fisio_prenotazioni', {
        method: 'POST',
        body: JSON.stringify({
          slot_id: s.id, nome: d.nome, telefono: d.telefono,
          note: (d.note || '').slice(0, 320)
        })
      }).then(function (r3) {
        if (!r3.ok) {
          /* squad-fisio-w2: POST fallita DOPO la PATCH — rollback compensativo:
             libera lo slot. Se fallisce anche il rollback, log e errore comunque. */
          return sb('fisio_slot?id=eq.' + s.id, {
            method: 'PATCH',
            body: JSON.stringify({ stato: 'libero' })
          }).then(function (rr) {
            /* squad-fisio-w2: rollback fallito anche solo a livello HTTP → log */
            if (!rr.ok) console.error('Rollback slot ' + s.id + ' fallito: http ' + rr.status);
          }, function (rbErr) {
            console.error('Rollback slot ' + s.id + ' fallito:', rbErr);
          }).then(function () { throw new Error('pren ' + r3.status); });
        }
        return s;
      });
    })
    .then(function (s) {
      var orarioTxt = fmtDataLunga(s.data) + ' · ' + fmtOra(s.ora_inizio) + '–' + fmtOra(s.ora_fine);
      dispSlotSel = null;
      dispLoad(); // ricarica disponibilità per il prossimo utente
      completaPrenotazione({
        nome: d.nome, telefono: d.telefono, indirizzo: d.indirizzo,
        orario: orarioTxt, note: d.note, righe: d.righe, sbloccaBtn: d.sbloccaBtn,
        waWin: d.waWin /* squad-fisio-w1: popup sync + fallback */
      });
    })
    .catch(function (e) {
      dispSlotErrore(e && e.message === 'occupato'
        ? 'Questo orario è stato appena occupato: scegline un altro.'
        : 'Errore di rete: riprova tra poco.');
      formError('Non è stato possibile riservare lo slot: riprova.');
      /* squad-fisio-w1: popup sync + fallback — niente tab vuota orfana */
      if (d.waWin && !d.waWin.closed) { try { d.waWin.close(); } catch (e2) { /* già chiusa */ } }
      dispLoad();
      d.sbloccaBtn();
    });
}

/* =====================================================================
 * Admin — gestione disponibilità (stesso PIN admin123, sessione esistente)
 * ===================================================================== */
function dispAdminErr(msg) {
  var e = $('admin-avviso');
  if (!msg) { e.hidden = true; e.textContent = ''; return; }
  e.hidden = false;
  e.textContent = msg;
}

function dispAdminDataVista() {
  var v = $('d-vista');
  if (v && !v.value) v.value = isoData(new Date());
  return v ? v.value : isoData(new Date());
}

function dispAdminReload() {
  if (!sbConfigured()) { dispAdminErr('Database non collegato.'); return; }
  var giorno = dispAdminDataVista();
  sb('fisio_slot?select=id,data,ora_inizio,ora_fine,stato&data=eq.' + giorno + '&order=ora_inizio.asc', {})
    .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
    .then(function (rows) { dispAdminRenderLista(rows || [], giorno); })
    .catch(function () { dispAdminErr('Impossibile caricare gli slot (tabella fisio_slot mancante? Esegui supabase-fisio-schema.sql).'); });
  sb('fisio_prenotazioni?select=id,slot_id,nome,telefono,note,created_at&order=created_at.desc&limit=50', {})
    .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
    .then(function (rows) { dispAdminRenderPrenotazioni(rows || []); })
    .catch(function () {
      /* bugfix 03/10: mai restare bloccati su "Caricamento…" — mostra l'errore */
      var box = $('disp-prenotazioni');
      if (box) box.innerHTML = '<p class="muted">Impossibile caricare le prenotazioni (tabella fisio_prenotazioni mancante? Esegui supabase-fisio-schema.sql).</p>';
    });
}

function dispAdminRenderLista(rows, giorno) {
  var box = $('disp-lista');
  if (!box) return;
  if (!rows.length) { box.innerHTML = '<p class="muted">Nessuno slot per questo giorno.</p>'; return; }
  var html = '<div class="disp-righe">';
  rows.forEach(function (s) {
    var cls = s.stato === 'libero' ? 'ok' : (s.stato === 'occupato' ? 'occ' : 'blocc');
    html += '<div class="disp-riga">' +
      '<span class="disp-ora">' + fmtOra(s.ora_inizio) + '–' + fmtOra(s.ora_fine) + '</span>' +
      '<span class="disp-stato ' + cls + '">' + s.stato + '</span>' +
      '<span class="disp-azioni">' +
      (s.stato === 'libero'
        ? '<button type="button" data-az="blocca" data-id="' + s.id + '">Blocca</button>'
        : (s.stato === 'bloccato'
          ? '<button type="button" data-az="sblocca" data-id="' + s.id + '">Sblocca</button>'
          : '<button type="button" data-az="libera" data-id="' + s.id + '">Libera</button>')) +
      ' <button type="button" data-az="elimina" data-id="' + s.id + '">✕</button>' +
      '</span></div>';
  });
  box.innerHTML = html + '</div>';
  Array.prototype.forEach.call(box.querySelectorAll('button[data-az]'), function (b) {
    b.addEventListener('click', function () { dispAdminAzione(b.getAttribute('data-az'), +b.getAttribute('data-id')); });
  });
}

function dispAdminAzione(az, id) {
  var done = function () { dispAdminReload(); dispLoad(); };
  if (az === 'elimina') {
    if (!confirm('Eliminare questo slot?')) return;
    sb('fisio_slot?id=eq.' + id, { method: 'DELETE' })
      .then(function (r) { if (!r.ok) throw new Error(); done(); })
      .catch(function () { dispAdminErr('Eliminazione fallita.'); });
    return;
  }
  var nuovo = az === 'blocca' ? 'bloccato' : 'libero';
  sb('fisio_slot?id=eq.' + id, { method: 'PATCH', body: JSON.stringify({ stato: nuovo }) })
    .then(function (r) { if (!r.ok) throw new Error(); done(); })
    .catch(function () { dispAdminErr('Operazione fallita.'); });
}

function dispAdminRenderPrenotazioni(rows) {
  var box = $('disp-prenotazioni');
  if (!box) return;
  if (!rows.length) { box.innerHTML = '<p class="muted">Nessuna prenotazione registrata.</p>'; return; }
  var html = '<div class="disp-righe">';
  rows.forEach(function (p) {
    var quando = p.created_at ? p.created_at.slice(0, 16).replace('T', ' ') : '';
    html += '<div class="disp-riga"><span><strong>' + escHtml(p.nome) + '</strong> · ' + escHtml(p.telefono) +
      (p.note ? ' · <em>' + escHtml(p.note) + '</em>' : '') +
      '</span><span class="muted small">' + quando + '</span></div>';
  });
  box.innerHTML = html + '</div>';
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function onDispAdd(ev) {
  ev.preventDefault();
  var data = $('d-data').value, ini = $('d-inizio').value, fin = $('d-fine').value;
  if (!data || !ini || !fin) { dispAdminErr('Compila data, ora inizio e ora fine.'); return; }
  if (ini >= fin) { dispAdminErr('L\u2019ora di fine deve essere dopo l\u2019inizio.'); return; }
  sb('fisio_slot', { method: 'POST', body: JSON.stringify({ data: data, ora_inizio: ini, ora_fine: fin, stato: 'libero' }) })
    .then(function (r) { if (!r.ok) throw new Error(); $('d-vista').value = data; dispAdminReload(); dispLoad(); dispAdminErr(null); })
    .catch(function () { dispAdminErr('Inserimento fallito (tabella mancante?).'); });
}

/* Genera slot da 45 min dagli orari standard del tenant per un intervallo date */
function onDispGenera() {
  var da = $('d-gen-da').value, a = $('d-gen-a').value;
  if (!da || !a || da > a) { dispAdminErr('Scegli un intervallo di date valido.'); return; }
  var STEP = 45, nuovi = [];
  var d0 = parseISODate(da), d1 = parseISODate(a);
  for (var t = d0.getTime(); t <= d1.getTime(); t += 864e5) {
    var d = new Date(t), iso = isoData(d);
    var fasce = (tenant.orari || {})[GIORNI[d.getDay()]];
    if (!fasce || !fasce.length) continue;
    fasce.forEach(function (f) {
      var start = hhmmToMin(f[0]), end = hhmmToMin(f[1]);
      for (var m = start; m + STEP <= end; m += STEP) {
        nuovi.push({ data: iso, ora_inizio: minToHhmm(m), ora_fine: minToHhmm(m + STEP), stato: 'libero' });
      }
    });
  }
  if (!nuovi.length) { dispAdminErr('Nessuno slot generabile in questo intervallo.'); return; }
  if (!confirm('Creare ' + nuovi.length + ' slot liberi dal ' + da + ' al ' + a + '?')) return;
  dispAdminErr(null);
  /* bugfix 03/10: niente duplicati se la generazione viene ripetuta sullo
   * stesso intervallo — si creano solo gli slot che non esistono già. */
  sb('fisio_slot?select=data,ora_inizio&data=gte.' + da + '&data=lte.' + a, {})
    .then(function (r) { if (!r.ok) throw new Error('read ' + r.status); return r.json(); })
    .then(function (rows) {
      var visti = {};
      (rows || []).forEach(function (s) { visti[s.data + '|' + String(s.ora_inizio).slice(0, 5)] = 1; });
      var daCreare = nuovi.filter(function (n) { return !visti[n.data + '|' + n.ora_inizio]; });
      if (!daCreare.length) { dispAdminErr('Tutti gli slot di questo intervallo esistono già: nessun duplicato creato.'); return null; }
      return sb('fisio_slot', { method: 'POST', body: JSON.stringify(daCreare) })
        .then(function (r2) {
          if (!r2.ok) throw new Error('write ' + r2.status);
          $('d-vista').value = da;
          dispAdminReload();
          dispLoad();
          dispAdminErr(null);
        });
    })
    .catch(function () { dispAdminErr('Generazione fallita (tabella mancante?).'); });
}

function dispAdminBind() {
  var f = $('disp-form');
  if (f) f.addEventListener('submit', onDispAdd);
  var g = $('d-genera');
  if (g) g.addEventListener('click', onDispGenera);
  var v = $('d-vista');
  if (v) v.addEventListener('change', dispAdminReload);
}

/* Avvio disponibilità: dopo il tenant, e ricarica quando si apre l'admin */
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    dispAdminBind();
    // dispLoad parte dopo initTenant: se tenant già pronto lo chiama subito
    var attese = 0;
    var timer = setInterval(function () {
      attese++;
      if ((typeof tenant !== 'undefined' && tenant) || attese > 40) {
        clearInterval(timer);
        dispLoad();
      }
    }, 250);
    // ricarica admin ogni volta che si apre il pannello
    var _adminShow = (typeof adminShow !== 'undefined') ? adminShow : null;
    if (_adminShow) {
      adminShow = function () {
        _adminShow();
        dispAdminReload();
      };
    }
  });
}
