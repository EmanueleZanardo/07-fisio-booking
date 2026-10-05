/* =====================================================================
 * FisioReminders — promemoria prenotazioni (solo locale, nessun invio).
 * Salva ogni richiesta di prenotazione in localStorage e, alla visita
 * successiva, mostra un banner discreto con link "Aggiungi al calendario"
 * (file .ics generato al volo). Nessun dato lascia il browser.
 * Squad fisio 05/10/2026 [W3].
 * ===================================================================== */
(function () {
  'use strict';

  var CHIAVE = 'fisio_reminders_v1';
  var DISMISS = 'fisio_reminders_dismiss_v1';

  function leggi() {
    try {
      var raw = localStorage.getItem(CHIAVE);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function salva(arr) {
    try { localStorage.setItem(CHIAVE, JSON.stringify(arr.slice(-20))); }
    catch (e) { /* storage pieno o bloccato: niente promemoria */ }
  }

  /* Registra una richiesta appena inviata. Chiamato da app.js (completaPrenotazione). */
  function registra(d) {
    if (!d || !d.orderId) return;
    var arr = leggi();
    arr.push({
      orderId: d.orderId,
      nome: d.nome || '',
      trattamento: d.trattamento || '',
      quando: d.quando || '',
      ts: Date.now()
    });
    salva(arr);
  }

  /* Genera un .ics (data URI) per "aggiungi al calendario". */
  function icsUri(p) {
    function fmt(d) {
      function z(n) { return (n < 10 ? '0' : '') + n; }
      return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) +
        'T' + z(d.getHours()) + z(d.getMinutes()) + '00';
    }
    var inizio = p.ts ? new Date(p.ts) : new Date();
    var fine = new Date(inizio.getTime() + 45 * 60000); // seduta da 45 min
    var righe = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fisio Roberta//IT',
      'BEGIN:VEVENT',
      'UID:' + p.orderId + '@fisio-roberta.vercel.app',
      'DTSTAMP:' + fmt(new Date()),
      'DTSTART:' + fmt(inizio),
      'DTEND:' + fmt(fine),
      'SUMMARY:Fisioterapia a domicilio — ' + (p.trattamento || 'seduta'),
      'DESCRIPTION:Richiesta ' + p.orderId + ' — conferma definitiva in chat WhatsApp.',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(righe);
  }

  function mostraBanner() {
    var arr = leggi();
    if (!arr.length) return;
    var ultima = arr[arr.length - 1];
    try {
      if (localStorage.getItem(DISMISS) === ultima.orderId) return;
    } catch (e) { /* ignora */ }
    // Banner discreto in cima al body, una sola volta per richiesta
    var bar = document.createElement('div');
    bar.id = 'fisio-reminder-bar';
    bar.setAttribute('role', 'status');
    var txt = document.createElement('span');
    var dataTxt = ultima.quando ? ' (' + ultima.quando + ')' : '';
    txt.textContent = '📅 Hai una richiesta di prenotazione' + dataTxt +
      (ultima.trattamento ? ' — ' + ultima.trattamento : '') + '. ';
    var link = document.createElement('a');
    link.href = icsUri(ultima);
    link.download = 'promemoria-seduta.ics';
    link.textContent = 'Aggiungi al calendario';
    var chiudi = document.createElement('button');
    chiudi.type = 'button';
    chiudi.textContent = '✕';
    chiudi.setAttribute('aria-label', 'Nascondi promemoria');
    chiudi.addEventListener('click', function () {
      try { localStorage.setItem(DISMISS, ultima.orderId); } catch (e) {}
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    });
    bar.appendChild(txt);
    bar.appendChild(link);
    bar.appendChild(chiudi);
    var css = '#fisio-reminder-bar{position:sticky;top:0;z-index:60;background:#0E7C6B;color:#fff;' +
      'padding:10px 14px;font-size:14px;display:flex;gap:10px;align-items:center;justify-content:center;' +
      'flex-wrap:wrap}#fisio-reminder-bar a{color:#fff;font-weight:700;text-decoration:underline}' +
      '#fisio-reminder-bar button{background:none;border:1px solid #fff;color:#fff;border-radius:6px;' +
      'padding:2px 8px;cursor:pointer}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
    document.body.insertBefore(bar, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mostraBanner);
  } else {
    mostraBanner();
  }

  window.FisioReminders = { registra: registra };
})();
