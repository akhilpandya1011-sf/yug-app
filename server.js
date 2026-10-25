// Yug Creation – live test server (Phase 1). Node.js 18+, no packages needed.
// Run:  node server.js      then open the printed address on phones on the same Wi-Fi.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { seed } = require('./seed');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');
const UPLOAD_DIR = path.join(ROOT, 'public', 'uploads');
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (e) {}

// ---------- data ----------
let db;
function load() {
  const alt = path.join(process.env.LOCALAPPDATA || process.env.APPDATA || os.homedir(), 'yug-live', 'data.json');
  for (const f of [DATA_FILE, alt]) {
    if (fs.existsSync(f)) {
      try { db = JSON.parse(fs.readFileSync(f, 'utf8')); dataPath = f; return; } catch (e) { console.log(f + ' unreadable, starting fresh'); }
    }
  }
  db = seed(); save();
}
let saveTimer = null;
let dataPath = DATA_FILE;
function writeData(file) {
  const json = JSON.stringify(db, null, 1);
  try { const tmp = file + '.tmp'; fs.writeFileSync(tmp, json); fs.renameSync(tmp, file); return true; } catch (e) {}
  try { fs.writeFileSync(file, json); return true; } catch (e) { return false; }
}
let warned = false;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      if (writeData(dataPath)) return;
      // Fall back to the user's AppData folder if this folder can't be written to
      const alt = path.join(process.env.LOCALAPPDATA || process.env.APPDATA || os.homedir(), 'yug-live');
      fs.mkdirSync(alt, { recursive: true });
      const altFile = path.join(alt, 'data.json');
      if (writeData(altFile)) { if (dataPath !== altFile) console.log('\n  Note: could not write data.json in the app folder, saving to ' + altFile + ' instead.\n'); dataPath = altFile; return; }
      if (!warned) { warned = true; console.log('\n  Warning: cannot save data.json anywhere. The app still works, but data is lost when you close this window.\n'); }
    } catch (e) { if (!warned) { warned = true; console.log('\n  Warning: cannot save data.json (' + e.message + '). The app still works, but data is lost when you close this window.\n'); } }
  }, 50);
}
const nextId = k => db.nextIds[k]++;
const now = () => new Date().toISOString();

// ---------- sessions ----------
const sessions = new Map(); // token -> user
function auth(req) {
  const h = req.headers['authorization'] || '';
  const t = h.replace(/^Bearer\s+/i, '') || new URL(req.url, 'http://x').searchParams.get('token');
  return t && sessions.get(t);
}

// ---------- live events (SSE) ----------
const clients = new Set(); // {res, user}
function broadcast(type, payload) {
  db.seq++;
  const msg = `event: ${type}\ndata: ${JSON.stringify({ seq: db.seq, ...payload })}\n\n`;
  for (const c of clients) { try { c.res.write(msg); } catch (e) { clients.delete(c); } }
  save();
}
setInterval(() => { for (const c of clients) { try { c.res.write(': ping\n\n'); } catch (e) { clients.delete(c); } } }, 20000);

// ---------- helpers ----------
const holdsFor = (matchingId, godownId) => db.orders
  .filter(o => o.status === 'accepted' || o.status === 'packed')
  .flatMap(o => o.items).filter(i => i.matchingId === matchingId && i.godownId === godownId)
  .reduce((s, i) => s + i.tp, 0);
const stockRow = (m, g) => db.stock.find(s => s.matchingId === m && s.godownId === g);
function availability(matchingId) {
  return db.godowns.map(g => {
    const s = stockRow(matchingId, g.id); const tp = s ? s.tp : 0; const held = holdsFor(matchingId, g.id);
    return { godownId: g.id, godown: g.name, tp, held, available: Math.max(0, tp - held) };
  });
}
function addMove(matchingId, godownId, tp, reason, by, orderId) {
  let s = stockRow(matchingId, godownId);
  if (!s) { s = { matchingId, godownId, tp: 0 }; db.stock.push(s); }
  s.tp = Math.round((s.tp + tp) * 100) / 100;
  db.moves.push({ id: nextId('move'), matchingId, godownId, tp, reason, by, orderId: orderId || null, at: now() });
}

function stateFor(user) {
  const designs = db.designs.map(d => ({
    ...d,
    matchings: db.matchings.filter(m => m.designId === d.id).map(m => ({ ...m, godowns: availability(m.id) }))
  }));
  const base = { seq: db.seq, godowns: db.godowns, designs, settings: { officeWhatsApp: db.settings.officeWhatsApp, businessName: db.settings.businessName }, me: pub(user), serverTime: now() };
  const orderView = o => ({ ...o, trader: db.traders.find(t => t.id === o.traderId), address: db.addresses.find(a => a.id === o.addressId) });
  if (user.role === 'trader') {
    base.orders = db.orders.filter(o => o.traderId === user.traderId).map(orderView);
    base.addresses = db.addresses.filter(a => a.traderId === user.traderId);
  } else {
    base.orders = db.orders.map(orderView);
    base.traders = db.traders;
    base.addresses = db.addresses;
  }
  if (user.role === 'owner') {
    base.users = db.users.map(u => ({ id: u.id, name: u.name, role: u.role, traderId: u.traderId || null }));
    base.moves = db.moves.slice(-200).reverse();
    base.connected = [...clients].map(c => ({ role: c.user.role, name: c.user.name }));
  }
  return base;
}
const pub = u => u && { id: u.id, name: u.name, role: u.role, traderId: u.traderId || null };

// ---------- API ----------
const api = {};

const failures = new Map(); // ip -> {n, until}
api['POST /api/login'] = (b, user, req) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const f = failures.get(ip) || { n: 0, until: 0 };
  if (f.until > Date.now()) throw err(429, 'Too many wrong attempts. Try again in a few minutes.');
  const u = db.users.find(x => x.id.toLowerCase() === String(b.id || '').trim().toLowerCase() && x.password === String(b.password || ''));
  if (!u) { f.n++; if (f.n >= 8) { f.until = Date.now() + 10 * 60 * 1000; f.n = 0; } failures.set(ip, f); throw err(401, 'Wrong ID or password'); }
  failures.delete(ip);
  if (u.role === 'trader') { const t = db.traders.find(t => t.id === u.traderId); if (!t || !t.active) throw err(403, 'This trader login is disabled'); }
  const token = crypto.randomBytes(16).toString('hex');
  sessions.set(token, u);
  return { token, user: pub(u) };
};

api['GET /api/state'] = (b, user) => stateFor(user);

api['POST /api/order'] = (b, user) => {
  need(user, 'trader');
  const items = (b.items || []).map(i => ({ matchingId: Number(i.matchingId), metres: Number(i.metres) }));
  if (!items.length) throw err(400, 'No items');
  const out = [];
  for (const i of items) {
    const m = db.matchings.find(x => x.id === i.matchingId); if (!m) throw err(400, 'Unknown matching');
    const d = db.designs.find(x => x.id === m.designId);
    if (!(i.metres > 0)) throw err(400, 'Metres must be more than 0');
    const tp = i.metres / 100;
    const av = availability(m.id).reduce((s, g) => s + g.available, 0);
    if (tp > av) throw err(409, `Only ${fmt(av * 100)} m of ${d.code} ${m.name} in godown. Enter ${fmt(av * 100)} m or less.`);
    out.push({ matchingId: m.id, designCode: d.code, designName: d.name, matchingName: m.name, img: m.img, metres: i.metres, tp, godownId: null });
  }
  const addr = db.addresses.find(a => a.id === Number(b.addressId) && a.traderId === user.traderId);
  if (!addr) throw err(400, 'Choose a delivery address');
  const o = { id: nextId('order'), no: null, traderId: user.traderId, addressId: addr.id, items: out, note: String(b.note || '').slice(0, 300), status: 'new', createdAt: now(), history: [{ status: 'new', at: now(), by: user.name }] };
  o.no = 'YO-' + String(o.id).padStart(4, '0');
  db.orders.push(o);
  broadcast('order', { orderId: o.id, status: 'new', traderName: user.name });
  return { order: o };
};

api['POST /api/order/accept'] = (b, user) => {
  need(user, 'office', 'owner');
  const o = getOrder(b.orderId); if (o.status !== 'new') throw err(409, 'Order is not new any more');
  const choices = b.godowns || {}; // {matchingId: godownId}
  for (const it of o.items) {
    const av = availability(it.matchingId);
    let gid = Number(choices[it.matchingId]) || null;
    if (!gid) { const best = av.slice().sort((a, c) => c.available - a.available)[0]; gid = best.godownId; }
    const g = av.find(x => x.godownId === gid);
    if (!g || g.available < it.tp) throw err(409, `${it.designCode} ${it.matchingName}: only ${fmt(g ? g.available * 100 : 0)} m free in ${g ? g.godown : 'that godown'}. Choose another godown.`);
    it.godownId = gid;
  }
  o.status = 'accepted'; o.challan = 'CH-' + String(nextId('challan')).padStart(4, '0'); o.acceptedAt = now();
  o.history.push({ status: 'accepted', at: now(), by: user.name });
  broadcast('order', { orderId: o.id, status: 'accepted', traderId: o.traderId });
  return { order: o };
};

api['POST /api/order/decline'] = (b, user) => {
  need(user, 'office', 'owner');
  const o = getOrder(b.orderId); if (o.status !== 'new') throw err(409, 'Order is not new any more');
  o.status = 'declined'; o.declineReason = String(b.reason || '').slice(0, 200);
  o.history.push({ status: 'declined', at: now(), by: user.name, note: o.declineReason });
  broadcast('order', { orderId: o.id, status: 'declined', traderId: o.traderId });
  return { order: o };
};

api['POST /api/order/packed'] = (b, user) => {
  need(user, 'godown', 'owner');
  const o = getOrder(b.orderId); if (o.status !== 'accepted') throw err(409, 'Order is not accepted');
  o.status = 'packed'; o.history.push({ status: 'packed', at: now(), by: user.name });
  broadcast('order', { orderId: o.id, status: 'packed', traderId: o.traderId });
  return { order: o };
};

api['POST /api/order/dispatch'] = (b, user) => {
  need(user, 'godown', 'owner');
  const o = getOrder(b.orderId); if (!['accepted', 'packed'].includes(o.status)) throw err(409, 'Order is not ready');
  for (const it of o.items) addMove(it.matchingId, it.godownId, -it.tp, 'dispatch', user.name, o.id);
  o.status = 'dispatched'; o.driver = String(b.driver || '').slice(0, 60); o.vehicle = String(b.vehicle || '').slice(0, 30); o.dispatchedAt = now();
  o.history.push({ status: 'dispatched', at: now(), by: user.name });
  broadcast('order', { orderId: o.id, status: 'dispatched', traderId: o.traderId });
  return { order: o };
};

api['POST /api/design'] = (b, user) => {
  need(user, 'owner');
  const code = String(b.code || '').trim().toUpperCase().replace(/^#/, '');
  if (!code) throw err(400, 'Design code is needed');
  let d = b.id ? db.designs.find(x => x.id === Number(b.id)) : null;
  if (!d) {
    if (db.designs.some(x => x.code === code)) throw err(409, `${code} already exists`);
    d = { id: nextId('design'), code, name: '', layout: '', isNew: false, made: [], createdAt: now() };
    db.designs.push(d);
  }
  d.name = String(b.name || '').trim(); d.layout = String(b.layout || '').trim(); d.isNew = !!b.isNew;
  if (b.madePhoto) d.made.push(saveImage(b.madePhoto, code + '-made'));
  for (const m of (b.matchings || [])) {
    const name = String(m.name || '').trim(); if (!name) continue;
    const row = { id: nextId('matching'), designId: d.id, name, colours: [m.colour || '#9AA7A5'].concat(m.colour2 ? [m.colour2] : []), img: m.photo ? saveImage(m.photo, code + '-' + name) : null };
    db.matchings.push(row);
    db.godowns.forEach(g => { db.stock.push({ matchingId: row.id, godownId: g.id, tp: 0 }); const tp = Number((m.tp || {})[g.id]) || 0; if (tp > 0) addMove(row.id, g.id, tp, 'opening', user.name); });
  }
  broadcast('catalogue', { designId: d.id });
  return { design: d };
};

api['POST /api/stock'] = (b, user) => {
  need(user, 'owner');
  const m = db.matchings.find(x => x.id === Number(b.matchingId)); if (!m) throw err(400, 'Unknown matching');
  const tp = Number(b.tp); if (!tp) throw err(400, 'Enter TP to add or remove');
  const g = db.godowns.find(x => x.id === Number(b.godownId)); if (!g) throw err(400, 'Choose a godown');
  const av = availability(m.id).find(x => x.godownId === g.id);
  if (tp < 0 && av.available + tp < 0) throw err(409, `Only ${av.available} TP free in ${g.name} (${av.held} TP held for orders)`);
  addMove(m.id, g.id, tp, b.reason || (tp > 0 ? 'stock in' : 'adjust'), user.name);
  broadcast('catalogue', { matchingId: m.id });
  return { ok: true };
};

api['POST /api/trader'] = (b, user) => {
  need(user, 'owner');
  const firm = String(b.firm || '').trim(); if (!firm) throw err(400, 'Firm name is needed');
  const loginId = String(b.loginId || '').trim().toLowerCase(); if (!loginId) throw err(400, 'Login ID is needed');
  if (db.users.some(u => u.id === loginId)) throw err(409, 'That login ID is taken');
  if (String(b.password || '').length < 6) throw err(400, 'Password must be at least 6 characters');
  const t = { id: nextId('trader'), firm, city: String(b.city || ''), mobile: String(b.mobile || ''), gstin: String(b.gstin || ''), active: true };
  db.traders.push(t);
  if (b.address) db.addresses.push({ id: nextId('address'), traderId: t.id, label: 'Shop', text: String(b.address), contact: t.mobile });
  db.users.push({ id: loginId, password: String(b.password), name: firm, role: 'trader', traderId: t.id });
  broadcast('traders', { traderId: t.id });
  return { trader: t };
};

api['POST /api/trader/password'] = (b, user) => {
  need(user, 'owner');
  const u = db.users.find(x => x.id === String(b.loginId || '').toLowerCase()); if (!u) throw err(400, 'Unknown login');
  const pw = String(b.password || ''); if (pw.length < 6) throw err(400, 'Password must be at least 6 characters');
  u.password = pw; for (const [tk, su] of sessions) if (su.id === u.id && su !== user) sessions.delete(tk);
  save(); return { ok: true };
};

api['POST /api/trader/toggle'] = (b, user) => {
  need(user, 'owner');
  const t = db.traders.find(x => x.id === Number(b.traderId)); if (!t) throw err(400, 'Unknown trader');
  t.active = !t.active; broadcast('traders', { traderId: t.id }); return { trader: t };
};

api['POST /api/settings'] = (b, user) => {
  need(user, 'owner');
  if (b.officeWhatsApp !== undefined) db.settings.officeWhatsApp = String(b.officeWhatsApp).replace(/\D/g, '');
  broadcast('settings', {}); return { settings: db.settings };
};

api['POST /api/reset'] = (b, user) => {
  need(user, 'owner');
  db = seed(); save();
  try { for (const f of fs.readdirSync(UPLOAD_DIR)) fs.unlinkSync(path.join(UPLOAD_DIR, f)); } catch (e) {}
  broadcast('reset', {}); return { ok: true };
};

// ---------- utilities ----------
function err(status, message) { const e = new Error(message); e.status = status; return e; }
function need(user, ...roles) { if (!user || !roles.includes(user.role)) throw err(403, 'Not allowed for this login'); }
function getOrder(id) { const o = db.orders.find(x => x.id === Number(id)); if (!o) throw err(404, 'Order not found'); return o; }
function fmt(n) { return Number(n).toLocaleString('en-IN'); }
function saveImage(dataUrl, hint) {
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(dataUrl || ''); if (!m) return null;
  const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
  const name = hint.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + Date.now() + '.' + ext;
  try { fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(m[2], 'base64')); } catch (e) { throw err(500, 'Could not save the photo in the app folder: ' + e.message); }
  return '/uploads/' + name;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, 'public', p));
  if (!file.startsWith(path.join(ROOT, 'public'))) { res.writeHead(403); return res.end(); }
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': p.startsWith('/img/') || p.startsWith('/uploads/') ? 'public, max-age=86400' : 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = ''; req.on('data', c => { d += c; if (d.length > 12e6) { reject(err(413, 'Too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(err(400, 'Bad JSON')); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/events') {
    const user = auth(req); if (!user) { res.writeHead(401); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`event: hello\ndata: ${JSON.stringify({ seq: db.seq })}\n\n`);
    const c = { res, user }; clients.add(c);
    broadcast('presence', {});
    req.on('close', () => { clients.delete(c); broadcast('presence', {}); });
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    const key = `${req.method} ${url.pathname}`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const fn = api[key]; if (!fn) throw err(404, 'No such API');
      const user = auth(req);
      if (key !== 'POST /api/login' && !user) throw err(401, 'Please log in again');
      const body = req.method === 'POST' ? await readBody(req) : {};
      res.end(JSON.stringify(fn(body, user, req)));
    } catch (e) {
      res.statusCode = e.status || 500; res.end(JSON.stringify({ error: e.message }));
      if (!e.status) console.error(e);
    }
    return;
  }
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY');
  serveStatic(req, res);
});

process.on('uncaughtException', e => console.error('Unexpected error (app keeps running):', e.message));
load();
server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log('\n  Yug Creation live test server is running.\n');
  console.log('  On this laptop:   http://localhost:' + PORT);
  ips.forEach(ip => console.log('  On phones (same Wi-Fi):   http://' + ip + ':' + PORT));
  console.log('\n  Logins (all passwords 1234): chirag (owner) · office · godown · ambica (trader) · mahalaxmi (trader)');
  console.log('  Press Ctrl+C to stop. Data is saved in ' + dataPath + '\n');
});
