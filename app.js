'use strict';
/* =====================================================================
 * Fisio-booking — prenotazioni visite fisioterapiche via WhatsApp (wa.me).
 * Derivato dal template booking-system (EmanueleZanardo/booking-system).
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
  L.push('TOTALE STIMATO: ' + fmtEUR(totale) + ' (40 €/ora)');
  L.push(DIV);
  L.push('Nome: ' + form.nome);
  L.push('Telefono: ' + form.telefono);
  L.push('Trattamento a domicilio');
  L.push('Indirizzo: ' + form.indirizzo);
  L.push('Fascia oraria preferita: ' + form.orario);
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
  document.title = 'Prenota da ' + tenant.nome;

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
  if (!slot.length) {
    var o = document.createElement('option');
    o.textContent = 'Nessuna fascia disponibile — scrivici in chat';
    o.disabled = true;
    sel.appendChild(o);
    return;
  }
  slot.forEach(function (s) {
    var o = document.createElement('option');
    o.value = s.etichetta;
    o.textContent = s.etichetta;
    sel.appendChild(o);
  });
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
  tRiga('Totale stimato (' + fmtEUR(40) + '/ora)', fmtEUR(sub), true);
}

function openDrawer() {
  $('drawer').hidden = false;
  $('drawer-sfondo').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  $('drawer').hidden = true;
  $('drawer-sfondo').hidden = true;
  document.body.style.overflow = '';
}

function bindUI() {
  $('cartbar').addEventListener('click', openDrawer);
  $('drawer-chiudi').addEventListener('click', closeDrawer);
  $('drawer-sfondo').addEventListener('click', closeDrawer);

  $('ordine-form').addEventListener('submit', onSubmit);
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

  var righe = cartRighe();
  if (!righe.length) { formError('Nessun trattamento selezionato: aggiungine uno.'); return; }

  var nome = $('f-nome').value.trim();
  var telefono = $('f-telefono').value.trim();
  var indirizzo = $('f-indirizzo').value.trim();
  var orario = $('f-orario').value;
  var note = $('f-note').value;

  if (!nome) { formError('Inserisci il tuo nome.'); $('f-nome').focus(); return; }
  if (!telefono) { formError('Inserisci il tuo numero di telefono.'); $('f-telefono').focus(); return; }
  if (!indirizzo) {
    formError('Inserisci l\u2019indirizzo dove ricevere il trattamento.');
    $('f-indirizzo').focus();
    return;
  }

  var orderId = genOrderId();
  var message = buildMessage(tenant, righe, {
    nome: nome, telefono: telefono,
    indirizzo: indirizzo, orario: orario, note: note, orderId: orderId
  });
  var url = buildWhatsUrl(tenant, message);

  if (url.length > MAX_URL_LEN) {
    formError('Prenotazione troppo lunga per WhatsApp: chiamaci al +' + tenant.whatsapp + ' per completarla.');
    return;
  }

  // Anti doppio-invio — disabilita 10 secondi
  var btn = $('btn-ordina');
  btn.disabled = true;
  var orig = btn.textContent;
  btn.textContent = 'Messaggio preparato — completalo in WhatsApp…';
  setTimeout(function () {
    btn.disabled = false;
    btn.textContent = orig;
  }, 10000);

  window.open(url, '_blank', 'noopener');
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
