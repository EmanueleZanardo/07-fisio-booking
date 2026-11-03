#!/usr/bin/env node
/* Smoke test del frontend fisio con Supabase finto (nessuna rete reale):
 * prenotazione tramite rpc/fisio_prenota, login admin con Supabase Auth,
 * richieste admin con il token. Uso: node test/smoke-prenotazione.js
 * (serve Playwright: npm i -D playwright). */
// Server statico minimo (cartella del repo)
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TIPI = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
function avvia(root) {
  const srv = http.createServer((req, res) => {
    let f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (e) {}
    fs.readFile(f, (err, d) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TIPI[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ url: 'http://127.0.0.1:' + srv.address().port, chiudi: () => new Promise(r => srv.close(r)) })));
}
const { chromium } = require('playwright');
(async () => {
  const srv = await avvia(ROOT);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'it-IT', timezoneId: 'Europe/Zurich' });
  const log = []; const tokens = new Set();
  const oggi = new Date(); const g = n => { const d = new Date(oggi); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const slot = [1, 2, 3].map((n, i) => ({ id: 10 + i, data: g(n), ora_inizio: '09:00', ora_fine: '10:00', stato: 'libero' }));
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,apikey,content-type,prefer', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,PUT,OPTIONS' };
  await ctx.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith(srv.url)) return r.continue();
    if (!u.includes('supabase.co')) return r.abort();
    const m = r.request().method();
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    const auth = r.request().headers().authorization || '';
    log.push(m + ' ' + u.replace(/^https:\/\/[^/]+/, '').slice(0, 90) + (tokens.has(auth.slice(7)) ? ' [admin]' : ''));
    const j = (s, d) => r.fulfill({ status: s, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: JSON.stringify(d) });
    if (u.includes('/auth/v1/token')) { const t = 'tok_fisio'; tokens.add(t); return j(200, { access_token: t, expires_in: 3600 }); }
    if (u.includes('/rpc/fisio_prenota')) { const p = JSON.parse(r.request().postData()); const s = slot.find(x => x.id === p.p_slot); if (!s || s.stato !== 'libero') return j(400, { message: 'occupato' }); s.stato = 'occupato'; return j(200, { id: s.id, data: s.data, ora_inizio: s.ora_inizio, ora_fine: s.ora_fine }); }
    if (u.includes('/fisio_slot')) { if (m === 'GET') { const id = (u.match(/id=eq\.(\d+)/) || [])[1]; return j(200, id ? slot.filter(s => String(s.id) === id) : slot); } return r.fulfill({ status: 204, headers: CORS }); }
    if (u.includes('/fisio_prenotazioni') || u.includes('/fisio_incassi')) { if (!tokens.has(auth.slice(7))) return j(200, []); return j(200, []); }
    return j(404, { message: 'x' });
  });
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', e => err.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) err.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto(srv.url + '/'); await p.waitForLoadState('networkidle').catch(() => {});
  console.log('titolo:', await p.title());
  // prenotazione: scelgo il primo slot libero dalla lista come farebbe il paziente
  const r = await p.evaluate(async (id) => { dispSlotSel = id; try { const righe = (typeof cartRighe === 'function' && cartRighe().length) ? cartRighe() : [{ nome: 'Massoterapia', qta: 1, prezzo: 60 }]; dispPrenotaSlot({ nome: 'Paziente Prova', telefono: '+41791234567', indirizzo: 'Via Test 1, Lugano', note: 'test', righe, sbloccaBtn: function () {}, waWin: null }); return 'ok'; } catch (e) { return 'errore ' + e.message; } }, slot[0].id);
  await p.waitForTimeout(500);
  console.log('prenotazione:', r, '| slot 10 ora:', slot[0].stato);
  // login admin con email e password
  await p.evaluate(() => adminOpenPin());
  await p.fill('#pin-email', 'emanuele1998zanardo@gmail.com'); await p.fill('#pin-input', 'password-di-prova');
  await p.evaluate(() => document.getElementById('pin-form').requestSubmit());
  await p.waitForTimeout(800);
  console.log('pannello admin aperto:', await p.evaluate(() => !document.getElementById('pin-panel') || document.getElementById('pin-panel').hidden));
  console.log('richieste:\n  ' + log.join('\n  '));
  console.log('errori JS:', err);
  const ok = r === 'ok' && slot[0].stato === 'occupato' && err.length === 0 && log.some(x => x.startsWith('POST /rest/v1/rpc/fisio_prenota'));
  console.log(ok ? 'ESITO: OK' : 'ESITO: FALLITO');
  process.exitCode = ok ? 0 : 1;
  await b.close(); await srv.chiudi();
})();
