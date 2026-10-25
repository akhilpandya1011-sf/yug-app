/* Yug Creation – live test client (Phase 1) */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Number(n || 0).toLocaleString('en-IN');
const m2tp = m => Math.round(m / 100 * 100) / 100;
const timeAgo = iso => { const s = (Date.now() - new Date(iso)) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };
const clock = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

// ---------- language (trader screens are bilingual, like the first mockup) ----------
const T = {
  en: { stock: 'Stock', room: 'Design Room', orders: 'My orders', liveStock: 'Live stock', liveSub: 'In TP and metres. Tap any design.', search: 'Search code or name (Y03, chain, firozi)', all: 'All', inStock: 'In stock only', matchings: 'matchings', inGodown: 'in godown', out: 'Out of stock', order: 'Order', askRate: 'Ask rate on WhatsApp', share: 'Share photo', madeInto: 'Made into', noMade: 'No finished-product photos yet.', metres: 'Metres', address: 'Delivery address', note: 'Note for office (optional)', place: 'Place order', only: 'Only {m} m in godown. Enter {m} m or less.', placed: 'Order sent. The office will accept it shortly.', newThisWeek: 'New this week', roomSub: 'Fresh arrivals with photos.', noOrders: 'No orders yet. Open a design and tap Order.', available: 'available', rateReq: 'Rate on request', tp: 'TP', status: { new: 'Waiting for office', accepted: 'Accepted · being packed', packed: 'Packed', dispatched: 'On the way', declined: 'Declined' } },
  gu: { stock: 'સ્ટોક', room: 'ડિઝાઇન રૂમ', orders: 'મારા ઓર્ડર', liveStock: 'લાઇવ સ્ટોક', liveSub: 'TP અને મીટરમાં. કોઈ પણ ડિઝાઇન પર ટેપ કરો.', search: 'કોડ કે નામ શોધો (Y03, chain, firozi)', all: 'બધું', inStock: 'ફક્ત સ્ટોકમાં', matchings: 'મેચિંગ', inGodown: 'ગોડાઉનમાં', out: 'સ્ટોક નથી', order: 'ઓર્ડર', askRate: 'WhatsApp પર રેટ પૂછો', share: 'ફોટો શેર', madeInto: 'તૈયાર પ્રોડક્ટ', noMade: 'હજી ફાઇનલ પ્રોડક્ટના ફોટા નથી.', metres: 'મીટર', address: 'ડિલિવરી એડ્રેસ', note: 'ઓફિસ માટે નોંધ (વૈકલ્પિક)', place: 'ઓર્ડર મોકલો', only: 'ગોડાઉનમાં ફક્ત {m} મીટર છે. {m} કે ઓછા લખો.', placed: 'ઓર્ડર મોકલાયો. ઓફિસ થોડી વારમાં સ્વીકારશે.', newThisWeek: 'આ અઠવાડિયે નવું', roomSub: 'નવી આવક, ફોટા સાથે.', noOrders: 'હજી કોઈ ઓર્ડર નથી. ડિઝાઇન ખોલી ઓર્ડર દબાવો.', available: 'ઉપલબ્ધ', rateReq: 'રેટ માટે પૂછો', tp: 'TP', status: { new: 'ઓફિસની રાહ', accepted: 'સ્વીકાર્યો · પેકિંગ', packed: 'પેક થયો', dispatched: 'રસ્તામાં', declined: 'નકાર્યો' } }
};
let lang = localStorage.getItem('yug_lang') || 'en';
const t = k => (T[lang][k] ?? T.en[k] ?? k);

// ---------- state ----------
let token = sessionStorage.getItem('yug_token') || localStorage.getItem('yug_token');
let me = null, S = null, route = { v: null }, es = null, online = true;
const seenOrders = new Set();
let firstLoad = true;

async function api(path, body) {
  const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401 && path !== '/api/login') logout(); throw new Error(j.error || 'Something went wrong'); }
  return j;
}
async function refresh() {
  try {
    const s = await api('/api/state');
    const prev = S; S = s; me = s.me;
    detectChanges(prev, s);
    render();
  } catch (e) { toast(e.message, 'err'); }
}
function detectChanges(prev, s) {
  if (!prev) { s.orders.forEach(o => seenOrders.add(o.id + ':' + o.status)); return; }
  for (const o of s.orders) {
    const key = o.id + ':' + o.status;
    if (seenOrders.has(key)) continue;
    seenOrders.add(key);
    if (me.role === 'office' && o.status === 'new') { beep(); toast(`New order ${o.no} from ${o.trader?.firm}`, 'good'); }
    if (me.role === 'godown' && o.status === 'accepted') { beep(); toast(`Pick list ready: ${o.no} · ${o.challan}`, 'good'); }
    if (me.role === 'trader') { if (o.status === 'accepted') { beep(); toast(`${o.no} accepted by office`, 'good'); } if (o.status === 'dispatched') { beep(); toast(`${o.no} is on the way`, 'good'); } if (o.status === 'declined') toast(`${o.no} declined`, 'err'); }
    if (me.role === 'owner' && o.status === 'new') toast(`New order ${o.no} from ${o.trader?.firm}`, 'good');
  }
}
function connect() {
  if (es) es.close();
  es = new EventSource('/api/events?token=' + encodeURIComponent(token));
  const onAny = () => { online = true; refresh(); };
  ['order', 'catalogue', 'traders', 'settings', 'presence'].forEach(ev => es.addEventListener(ev, onAny));
  es.addEventListener('reset', () => { seenOrders.clear(); toast('Data was reset by the owner'); refresh(); });
  es.onerror = () => { if (online) { online = false; render(); } };
  es.onopen = () => { if (!online) { online = true; refresh(); } };
}

// ---------- sound ----------
let actx = null;
function unlockAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {} }
function beep() {
  try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); if (!actx) return;
    [0, .18].forEach((d, i) => { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = i ? 1046 : 784; o.connect(g); g.connect(actx.destination); const t0 = actx.currentTime + d; g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.25, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + .16); o.start(t0); o.stop(t0 + .18); });
  } catch (e) {}
}
let toastTimer;
function toast(msg, kind) { const el = $('#toast'); el.textContent = msg; el.className = 'toast ' + (kind || ''); el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 3200); }

// ---------- navigation ----------
function go(v, p) { route = Object.assign({ v }, p || {}); window.scrollTo(0, 0); render(); }
const START = { trader: 'stock', office: 'inbox', godown: 'pick', owner: 'today' };
function logout() { token = null; sessionStorage.removeItem('yug_token'); localStorage.removeItem('yug_token'); me = null; S = null; if (es) es.close(); route = { v: null }; render(); }

// ---------- helpers on state ----------
const design = id => S.designs.find(d => d.id === Number(id));
const matching = id => { for (const d of S.designs) { const m = d.matchings.find(x => x.id === Number(id)); if (m) return { ...m, design: d }; } return null; };
const avail = m => m.godowns.reduce((s, g) => s + g.available, 0);
const onHand = m => m.godowns.reduce((s, g) => s + g.tp, 0);
const dTotal = d => d.matchings.reduce((s, m) => s + avail(m), 0);
const firstImg = d => (d.matchings.find(m => m.img) || {}).img;
const dot = cols => `<span class="dot" style="${cols.length > 1 ? `background:linear-gradient(90deg,${cols[0]} 50%,${cols[1]} 50%)` : `background:${cols[0]}`}"></span>`;
const img = (src, alt, cls = 'sw') => src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">` : `<div class="${cls} ph">${esc(alt).slice(0, 5)}</div>`;
const waLink = (num, text) => `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
const stTag = st => `<span class="tag st-${st}">${esc(me.role === 'trader' ? T[lang].status[st] : st)}</span>`;
const timeline = o => { const steps = ['new', 'accepted', 'packed', 'dispatched']; const i = steps.indexOf(o.status); return `<div class="time">${steps.map((s, k) => `<span class="${o.status === 'declined' ? 'dec' : (k <= i ? 'on' : '')}"></span>`).join('')}</div>`; };

// ---------- render ----------
function render() {
  if (!token || !me || !S) return renderLogin();
  const nav = NAV[me.role];
  if (!route.v) route = { v: START[me.role] };
  const view = VIEWS[route.v] || VIEWS[START[me.role]];
  const newCount = S.orders.filter(o => o.status === 'new').length;
  const pickCount = S.orders.filter(o => ['accepted', 'packed'].includes(o.status)).length;
  app.innerHTML = `
    <header class="top">
      <div class="logo">Yug Creation<small>${esc(me.role)} · ${esc(me.name)}</small></div><div class="sp"></div>
      ${me.role === 'trader' ? `<button data-a="lang">${lang === 'en' ? 'ગુજરાતી' : 'English'}</button>` : ''}
      <span class="pill ${online ? '' : 'off'}">${online ? 'LIVE' : 'OFFLINE'}</span>
      <button data-a="logout">Exit</button>
    </header>
    ${online ? '' : '<div class="offline">Lost connection to the laptop. Check Wi-Fi; it will reconnect.</div>'}
    ${view()}
    <nav class="nav"><div class="in">${nav.map(n => `<button data-a="go" data-v="${n.v}" class="${(route.tab || route.v) === n.v ? 'on' : ''}">${ICON[n.i]}${esc(n.l())}${n.v === 'inbox' && newCount ? `<span class="badge">${newCount}</span>` : ''}${n.v === 'pick' && pickCount ? `<span class="badge">${pickCount}</span>` : ''}${n.v === 'today' && newCount ? `<span class="badge">${newCount}</span>` : ''}</button>`).join('')}</div></nav>`;
  restoreFocus();
}
let focusState = null;
function restoreFocus() { if (!focusState) return; const el = app.querySelector(`[data-k="${focusState.k}"]`); if (el) { el.focus(); try { el.setSelectionRange(focusState.s, focusState.e); } catch (e) {} } focusState = null; }
function keepFocus(el) { if (el && el.dataset.k) focusState = { k: el.dataset.k, s: el.selectionStart, e: el.selectionEnd }; }

const ICON = {
  stock: '<svg viewBox="0 0 24 24"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
  room: '<svg viewBox="0 0 24 24"><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6L7.1 18.2l.9-5.5-4-3.9L9.5 8z"/></svg>',
  orders: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  inbox: '<svg viewBox="0 0 24 24"><path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l2 3h4l2-3h5"/></svg>',
  pick: '<svg viewBox="0 0 24 24"><path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-8h10v8"/></svg>',
  done: '<svg viewBox="0 0 24 24"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  today: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',
  designs: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><path d="M17 13v8M13 17h8"/></svg>',
  traders: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5c3 0 5 1.7 5.5 4.5"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>'
};
const NAV = {
  trader: [{ v: 'stock', i: 'stock', l: () => t('stock') }, { v: 'room', i: 'room', l: () => t('room') }, { v: 'orders', i: 'orders', l: () => t('orders') }],
  office: [{ v: 'inbox', i: 'inbox', l: () => 'New orders' }, { v: 'allorders', i: 'orders', l: () => 'All orders' }, { v: 'stock', i: 'stock', l: () => 'Stock' }],
  godown: [{ v: 'pick', i: 'pick', l: () => 'Pick list' }, { v: 'done', i: 'done', l: () => 'Dispatched' }, { v: 'stock', i: 'stock', l: () => 'Stock' }],
  owner: [{ v: 'today', i: 'today', l: () => 'Today' }, { v: 'designs', i: 'designs', l: () => 'Designs' }, { v: 'traders', i: 'traders', l: () => 'Traders' }, { v: 'settings', i: 'settings', l: () => 'Settings' }]
};

// ---------- LOGIN ----------
function renderLogin() {
  app.innerHTML = `<div class="login">
    <div class="brand"><div class="y">Y</div><h1>Yug Creation</h1><p>Trader app · Pilot</p></div>
    <div class="box">
      <label class="f">Login ID</label><input class="in" id="lid" autocapitalize="off" autocomplete="username" placeholder="Your ID">
      <label class="f">Password</label><input class="in" id="lpw" type="password" autocomplete="current-password" placeholder="Password">
      <div id="lerr"></div>
      <button class="btn" data-a="login">Log in</button>
      <p class="tiny" style="margin-top:10px">Use the ID and password Yug Creation gave you. Lost it? Ask the office.</p>
    </div>
    <p class="footnote">Pilot version for Yug Creation traders and staff. Stock figures come from the 16 Oct 2026 stock sheet (1 TP = 100 m).</p>
  </div>`;
}
async function doLogin(id, pw) {
  unlockAudio();
  try { const r = await api('/api/login', { id, password: pw }); token = r.token; localStorage.setItem('yug_token', token); me = r.user; seenOrders.clear(); await refresh(); connect(); }
  catch (e) { const el = $('#lerr'); if (el) el.innerHTML = `<div class="warn">${esc(e.message)}</div>`; }
}

// ---------- shared screens ----------
let q = '', filt = 'all';
function stockList(opts = {}) {
  const layouts = [...new Set(S.designs.map(d => d.layout).filter(Boolean))];
  let list = S.designs.filter(d => {
    const hay = (d.code + ' ' + d.name + ' ' + d.layout + ' ' + d.matchings.map(m => m.name).join(' ')).toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (filt === 'in' && dTotal(d) <= 0) return false;
    if (filt !== 'all' && filt !== 'in' && d.layout !== filt) return false;
    return true;
  });
  return `<div class="bar"><h2>${esc(opts.title || t('liveStock'))}<small>${esc(opts.sub || t('liveSub'))}</small></h2></div>
  <div class="body">
    <input class="search" data-k="q" data-a="q" value="${esc(q)}" placeholder="${esc(t('search'))}">
    <div class="chips">${[['all', t('all')], ['in', t('inStock')]].concat(layouts.map(l => [l, l])).map(([k, l]) => `<button class="chip ${filt === k ? 'on' : ''}" data-a="filt" data-f="${esc(k)}">${esc(l)}</button>`).join('')}</div>
    <div class="list">${list.map(d => { const tot = dTotal(d); return `<div class="card tap row" data-a="go" data-v="design" data-id="${d.id}">
      ${img(firstImg(d), d.code)}
      <div class="sp"><div class="row"><span class="code">${esc(d.code)}</span>${d.isNew ? '<span class="tag new">NEW</span>' : ''}</div>
        <div class="muted">${esc(d.name || d.layout)}${d.name ? ' · ' + esc(d.layout) : ''}</div>
        <div class="tiny">${d.matchings.length} ${t('matchings')} · ${d.matchings.map(m => dot(m.colours)).join('')}</div></div>
      <div style="text-align:right">${tot > 0 ? `<div class="num" style="font-size:17px">${fmt(tot)} TP</div><div class="tiny">${fmt(tot * 100)} m</div>` : `<span class="tag out">${esc(t('out'))}</span>`}</div>
    </div>`; }).join('') || `<div class="card muted">Nothing matches.</div>`}</div>
  </div>`;
}

function designView() {
  const d = design(route.id); if (!d) return stockList();
  const sel = d.matchings.find(m => m.id === Number(route.m)) || d.matchings.find(m => avail(m) > 0) || d.matchings[0];
  const av = sel ? avail(sel) : 0;
  const back = me.role === 'trader' ? (route.from || 'stock') : 'stock';
  const rate = me.role === 'trader' ? `<a class="btn wa" href="${waLink(S.settings.officeWhatsApp, `Yug Creation: rate for ${d.code} ${sel?.name || ''} (${d.layout}). From ${me.name}.`)}" target="_blank" rel="noopener">${esc(t('askRate'))}</a>` : '';
  return `<div class="bar"><button class="back" data-a="go" data-v="${back}">‹</button><h2>${esc(d.code)} ${esc(d.name)}<small>${esc(d.layout)} · ${d.matchings.length} ${t('matchings')}</small></h2>${d.isNew ? '<span class="tag new">NEW</span>' : ''}</div>
  <div class="body">
    ${img(sel?.img || firstImg(d), d.code, 'hero')}
    <div class="chips">${d.matchings.map(m => `<button class="chip ${sel && m.id === sel.id ? 'sel' : ''}" data-a="go" data-v="design" data-id="${d.id}" data-m="${m.id}" data-from="${esc(back)}">${dot(m.colours)}${esc(m.name)}${avail(m) <= 0 ? ' · 0' : ''}</button>`).join('')}</div>
    ${sel ? `<div class="card">
      <div class="row"><div class="sp"><div class="h3">${dot(sel.colours)}${esc(sel.name)}</div><div class="muted">${esc(t('rateReq'))}</div></div>
        <div style="text-align:right">${av > 0 ? `<div class="big">${fmt(av)} <span style="font-size:14px">TP</span></div><div class="tiny">${fmt(av * 100)} m ${esc(t('inGodown'))}</div>` : `<span class="tag out">${esc(t('out'))}</span>`}</div></div>
      ${me.role !== 'trader' ? `<hr class="hr">${sel.godowns.map(g => `<div class="kv"><span>${esc(g.godown)}</span><b>${fmt(g.tp)} TP${g.held ? ` <span class="tiny">(${fmt(g.held)} held)</span>` : ''}</b></div>`).join('')}` : ''}
      ${me.role === 'trader' ? `<button class="btn" data-a="go" data-v="order" data-m="${sel.id}" ${av > 0 ? '' : 'disabled'}>${esc(t('order'))} · ${esc(sel.name)}</button>${rate}
        ${sel.img ? `<a class="btn ghost" href="${esc(sel.img)}" target="_blank" rel="noopener">${esc(t('share'))}</a>` : ''}` : ''}
      ${me.role === 'owner' ? `<button class="btn sec" data-a="go" data-v="adjust" data-m="${sel.id}">Stock in / adjust · ${esc(sel.name)}</button>` : ''}
    </div>` : ''}
    <div class="h3" style="margin:6px 0 4px">${esc(t('madeInto'))}</div>
    ${d.made.length ? `<div class="gal">${d.made.map(u => `<img src="${esc(u)}" alt="finished product">`).join('')}</div>` : `<div class="muted">${esc(t('noMade'))}</div>`}
    ${me.role === 'owner' ? `<button class="btn ghost" data-a="go" data-v="add" data-id="${d.id}">Add matching / finished photo to ${esc(d.code)}</button>` : ''}
  </div>`;
}

// ---------- TRADER ----------
let ord = { metres: 100, addressId: null, note: '', err: '' };
function orderView() {
  const m = matching(route.m); if (!m) return stockList();
  const av = avail(m) * 100;
  if (!ord.addressId && S.addresses.length) ord.addressId = S.addresses[0].id;
  const over = ord.metres > av;
  return `<div class="bar"><button class="back" data-a="go" data-v="design" data-id="${m.design.id}" data-m="${m.id}">‹</button><h2>${esc(t('order'))}<small>${esc(m.design.code)} · ${esc(m.name)}</small></h2></div>
  <div class="body">
    <div class="card row">${img(m.img, m.design.code)}<div class="sp"><div class="h3">${esc(m.design.code)} ${esc(m.design.name)}</div><div class="muted">${dot(m.colours)}${esc(m.name)} · ${esc(m.design.layout)}</div><div class="tiny">${fmt(av)} m ${esc(t('available'))}</div></div></div>
    <label class="f">${esc(t('metres'))}</label>
    <div class="stepper"><button data-a="step" data-d="-100">−</button><input data-k="metres" data-a="metres" type="number" inputmode="numeric" step="100" min="0" value="${ord.metres}"><button data-a="step" data-d="100">+</button></div>
    <div class="tiny" style="margin-top:4px">= ${fmt(m2tp(ord.metres))} ${t('tp')}</div>
    ${over ? `<div class="warn">${esc(t('only').replace(/\{m\}/g, fmt(av)))}</div>` : ''}
    <label class="f">${esc(t('address'))}</label>
    <select class="in" data-a="addr">${S.addresses.map(a => `<option value="${a.id}" ${a.id === ord.addressId ? 'selected' : ''}>${esc(a.label)} · ${esc(a.text)}</option>`).join('')}</select>
    <label class="f">${esc(t('note'))}</label>
    <textarea class="in" data-k="note" data-a="note" placeholder="…">${esc(ord.note)}</textarea>
    ${ord.err ? `<div class="warn">${esc(ord.err)}</div>` : ''}
    <button class="btn rani" data-a="place" data-m="${m.id}" ${over || !(ord.metres > 0) ? 'disabled' : ''}>${esc(t('place'))} · ${fmt(ord.metres)} m</button>
  </div>`;
}
function roomView() {
  const list = S.designs.filter(d => d.isNew);
  return `<div class="bar"><h2>${esc(t('room'))}<small>${esc(t('roomSub'))}</small></h2></div><div class="body">
    ${list.map(d => `<div class="card tap" data-a="go" data-v="design" data-id="${d.id}" data-from="room">${img(firstImg(d), d.code, 'hero')}
      <div class="row" style="margin-top:8px"><span class="code" style="font-size:17px">${esc(d.code)}</span><span class="tag new">${esc(t('newThisWeek'))}</span><span class="sp"></span><span class="num">${fmt(dTotal(d))} TP</span></div>
      <div class="muted">${esc(d.name || '')}${d.name ? ' · ' : ''}${esc(d.layout)} · ${d.matchings.map(m => dot(m.colours) + esc(m.name)).join(', ')}</div></div>`).join('') || '<div class="card muted">Nothing new this week.</div>'}
  </div>`;
}
function myOrders() {
  const list = S.orders.slice().reverse();
  return `<div class="bar"><h2>${esc(t('orders'))}<small>${list.length} total</small></h2></div><div class="body">
    ${list.map(o => orderCard(o)).join('') || `<div class="card muted">${esc(t('noOrders'))}</div>`}</div>`;
}
function orderCard(o, showTrader) {
  return `<div class="card tap" data-a="go" data-v="orderd" data-id="${o.id}">
    <div class="row"><span class="code">${esc(o.no)}</span>${stTag(o.status)}<span class="sp"></span><span class="tiny">${timeAgo(o.createdAt)}</span></div>
    ${showTrader ? `<div class="h3" style="margin-top:4px">${esc(o.trader?.firm || '')} <span class="muted" style="font-weight:400">· ${esc(o.trader?.city || '')}</span></div>` : ''}
    ${o.items.map(i => `<div class="row" style="margin-top:6px">${img(i.img, i.designCode)}<div class="sp"><b>${esc(i.designCode)}</b> ${esc(i.designName)} <div class="muted">${esc(i.matchingName)}${i.godownId ? ' · ' + esc(S.godowns.find(g => g.id === i.godownId)?.name || '') : ''}</div></div><div style="text-align:right"><div class="num">${fmt(i.metres)} m</div><div class="tiny">${fmt(i.tp)} TP</div></div></div>`).join('')}
    ${timeline(o)}${o.challan ? `<div class="tiny">Challan ${esc(o.challan)}${o.driver ? ' · ' + esc(o.driver) : ''}</div>` : ''}
  </div>`;
}

// ---------- ORDER DETAIL (all roles) ----------
let accPick = {};
function orderDetail() {
  const o = S.orders.find(x => x.id === Number(route.id)); if (!o) return VIEWS[START[me.role]]();
  const back = route.back || START[me.role];
  const addr = o.address;
  const r = me.role;
  let actions = '';
  if ((r === 'office' || r === 'owner') && o.status === 'new') {
    actions = `<div class="card"><div class="h3">Accept and send to godown</div>
      ${o.items.map(i => { const m = matching(i.matchingId); const gs = m ? m.godowns : []; const pick = accPick[i.matchingId] || gs.slice().sort((a, b) => b.available - a.available)[0]?.godownId;
        return `<label class="f">${esc(i.designCode)} ${esc(i.matchingName)} · ${fmt(i.tp)} TP from</label><select class="in" data-a="accpick" data-m="${i.matchingId}">${gs.map(g => `<option value="${g.godownId}" ${g.godownId === pick ? 'selected' : ''} ${g.available < i.tp ? 'disabled' : ''}>${esc(g.godown)} · ${fmt(g.available)} TP free</option>`).join('')}</select>`; }).join('')}
      <button class="btn" data-a="accept" data-id="${o.id}">Accept · hold stock</button>
      <button class="btn ghost" data-a="decline" data-id="${o.id}">Decline</button></div>`;
  }
  if ((r === 'godown' || r === 'owner') && (o.status === 'accepted' || o.status === 'packed')) {
    actions = `<div class="card"><div class="h3">Pick and load</div>
      ${o.items.map(i => `<div class="kv"><span>${esc(i.designCode)} ${esc(i.matchingName)}</span><b>${fmt(i.tp)} TP · ${esc(S.godowns.find(g => g.id === i.godownId)?.name || '')}</b></div>`).join('')}
      <div class="kv"><span>Challan</span><b>${esc(o.challan)}</b></div>
      ${o.status === 'accepted' ? `<button class="btn gold" data-a="packed" data-id="${o.id}">Mark packed</button>` : `<div class="ok">Packed. Load the tempo.</div>`}
      <label class="f">Driver</label><input class="in" data-k="driver" id="drv" placeholder="Driver name">
      <label class="f">Vehicle</label><input class="in" data-k="veh" id="veh" placeholder="GJ 05 …">
      ${addr ? `<a class="btn wa" href="${waLink('', `Yug Creation dispatch ${o.no} · ${o.challan}\n${o.trader?.firm}\n${addr.text}\nContact ${addr.contact}`)}" target="_blank" rel="noopener">Send address to driver on WhatsApp</a>` : ''}
      <button class="btn" data-a="dispatch" data-id="${o.id}">Dispatched · reduce stock</button></div>`;
  }
  return `<div class="bar"><button class="back" data-a="go" data-v="${esc(back)}">‹</button><h2>${esc(o.no)} ${stTag(o.status)}<small>${esc(o.trader?.firm || '')} · ${clock(o.createdAt)} · ${timeAgo(o.createdAt)}</small></h2></div>
  <div class="body">
    ${orderCard(o, r !== 'trader').replace('class="card tap"', 'class="card"')}
    <div class="card"><div class="kv"><span>Deliver to</span><b>${esc(addr?.label || '')}</b></div><div class="muted">${esc(addr?.text || '')}<br>Contact ${esc(addr?.contact || '')}</div>
      ${o.note ? `<div class="note">Note: ${esc(o.note)}</div>` : ''}${o.declineReason ? `<div class="warn">Declined: ${esc(o.declineReason)}</div>` : ''}</div>
    ${actions}
    <div class="card"><div class="h3" style="margin-bottom:4px">History</div>${o.history.map(h => `<div class="kv"><span>${esc(h.status)} <span class="tiny">by ${esc(h.by)}</span></span><b>${clock(h.at)}</b></div>`).join('')}</div>
  </div>`;
}

// ---------- OFFICE ----------
function inbox() {
  const list = S.orders.filter(o => o.status === 'new').slice().reverse();
  return `<div class="bar"><h2>New orders<small>${list.length} waiting · tap to accept</small></h2></div><div class="body">${list.map(o => orderCard(o, true)).join('') || '<div class="card muted">No new orders. Keep this screen open; it beeps when one arrives.</div>'}</div>`;
}
function allOrders() {
  const list = S.orders.slice().reverse();
  return `<div class="bar"><h2>All orders<small>${list.length} total</small></h2></div><div class="body">${list.map(o => orderCard(o, true)).join('') || '<div class="card muted">No orders yet.</div>'}</div>`;
}

// ---------- GODOWN ----------
function pickList() {
  const list = S.orders.filter(o => ['accepted', 'packed'].includes(o.status));
  return `<div class="bar"><h2>Pick list<small>${list.length} to pack and load</small></h2></div><div class="body">${list.map(o => orderCard(o, true)).join('') || '<div class="card muted">Nothing to pick. Accepted orders appear here with a beep.</div>'}</div>`;
}
function doneList() {
  const list = S.orders.filter(o => o.status === 'dispatched').slice().reverse();
  return `<div class="bar"><h2>Dispatched<small>${list.length} sent</small></h2></div><div class="body">${list.map(o => orderCard(o, true)).join('') || '<div class="card muted">Nothing dispatched yet.</div>'}</div>`;
}

// ---------- OWNER ----------
function today() {
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const td = S.orders.filter(o => new Date(o.createdAt) >= d0);
  const disp = S.orders.filter(o => o.status === 'dispatched' && new Date(o.dispatchedAt) >= d0).flatMap(o => o.items).reduce((s, i) => s + i.metres, 0);
  const waiting = S.orders.filter(o => o.status === 'new');
  const low = S.designs.flatMap(d => d.matchings.map(m => ({ d, m, a: avail(m) }))).filter(x => x.a > 0 && x.a <= 5).sort((a, b) => a.a - b.a);
  const totalTP = S.designs.reduce((s, d) => s + d.matchings.reduce((t2, m) => t2 + onHand(m), 0), 0);
  const pres = {}; (S.connected || []).forEach(c => { pres[c.role] = (pres[c.role] || 0) + 1; });
  return `<div class="bar"><h2>Today<small>${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</small></h2></div><div class="body">
    <div class="grid2">
      <div class="stat r"><div class="big">${waiting.length}</div><div class="l">orders waiting for office</div></div>
      <div class="stat"><div class="big">${td.length}</div><div class="l">orders today</div></div>
      <div class="stat"><div class="big">${fmt(disp)}</div><div class="l">metres dispatched today</div></div>
      <div class="stat"><div class="big">${fmt(totalTP)}</div><div class="l">TP in godowns (${fmt(totalTP * 100)} m)</div></div>
    </div>
    <div class="card"><div class="h3">Phones connected now</div><div class="pres" style="margin-top:6px">${Object.keys(pres).length ? Object.entries(pres).map(([r, n]) => `<span>${esc(r)} × ${n}</span>`).join('') : '<span class="muted">Only you</span>'}</div></div>
    ${waiting.length ? `<div class="h3" style="margin:6px 0">Waiting for office</div>${waiting.map(o => orderCard(o, true)).join('')}` : ''}
    <div class="h3" style="margin:6px 0">Low stock (5 TP or less)</div>
    ${low.slice(0, 12).map(x => `<div class="card tap row" data-a="go" data-v="design" data-id="${x.d.id}" data-m="${x.m.id}">${img(x.m.img, x.d.code)}<div class="sp"><b>${esc(x.d.code)}</b> ${esc(x.d.name)}<div class="muted">${dot(x.m.colours)}${esc(x.m.name)}</div></div><div class="num" style="color:var(--rani)">${fmt(x.a)} TP</div></div>`).join('') || '<div class="card muted">Nothing low.</div>'}
    <div class="h3" style="margin:6px 0">Recent stock moves</div>
    ${(S.moves || []).filter(mv => mv.by !== 'seed').slice(0, 10).map(mv => { const m = matching(mv.matchingId); return `<div class="kv"><span>${esc(m?.design.code || '')} ${esc(m?.name || '')} <span class="tiny">${esc(mv.reason)} · ${esc(mv.by)} · ${clock(mv.at)}</span></span><b style="color:${mv.tp < 0 ? 'var(--rani)' : 'var(--teal)'}">${mv.tp > 0 ? '+' : ''}${fmt(mv.tp)} TP</b></div>`; }).join('')}
  </div>`;
}
function designsView() {
  return stockList({ title: 'Designs', sub: `${S.designs.length} designs · tap to open, or add new` }).replace('<div class="list">', `<button class="btn" data-a="go" data-v="add" style="margin:0 0 10px">+ Add design</button><div class="list">`);
}
let adj = { godownId: 1, tp: '', reason: 'stock in' };
function adjustView() {
  const m = matching(route.m); if (!m) return designsView();
  return `<div class="bar"><button class="back" data-a="go" data-v="design" data-id="${m.design.id}" data-m="${m.id}">‹</button><h2>Stock in / adjust<small>${esc(m.design.code)} · ${esc(m.name)}</small></h2></div><div class="body">
    <div class="card">${m.godowns.map(g => `<div class="kv"><span>${esc(g.godown)}</span><b>${fmt(g.tp)} TP on hand${g.held ? ` · ${fmt(g.held)} held` : ''} · ${fmt(g.available)} free</b></div>`).join('')}</div>
    <label class="f">Godown</label><select class="in" data-a="adjg">${S.godowns.map(g => `<option value="${g.id}" ${g.id === adj.godownId ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
    <label class="f">TP to add (use minus to remove, e.g. −2)</label><input class="in" data-k="adjtp" data-a="adjtp" type="number" inputmode="decimal" step="0.5" value="${esc(adj.tp)}" placeholder="e.g. 10">
    <label class="f">Reason</label><select class="in" data-a="adjr">${['stock in', 'count correction', 'damage', 'return'].map(r => `<option ${adj.reason === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
    <button class="btn" data-a="adjsave" data-m="${m.id}">Save stock move</button>
  </div>`;
}
let nd = null;
function blankDesign(existing) { return { id: existing?.id || null, code: existing?.code || '', name: existing?.name || '', layout: existing?.layout || '2-side daman', isNew: existing ? existing.isNew : true, matchings: [{ name: '', colour: '#1FA3A6', tp: {}, photo: null }], madePhoto: null }; }
function addView() {
  const existing = route.id ? design(route.id) : null;
  if (!nd || nd.id !== (existing?.id || null) || nd._for !== (route.id || 'new')) { nd = blankDesign(existing); nd._for = route.id || 'new'; }
  const layouts = ['2-side daman', '1-side daman', 'Allover', 'Butta', 'Patta', 'Gola', 'Corner butta', 'Toran', 'Daman', 'Daman, patta, butta'];
  return `<div class="bar"><button class="back" data-a="go" data-v="${existing ? 'design' : 'designs'}" data-id="${existing?.id || ''}">‹</button><h2>${existing ? 'Add to ' + esc(existing.code) : 'Add design'}<small>Shows in Stock${nd.isNew ? ' and Design Room' : ''}</small></h2></div><div class="body">
    ${existing ? '' : `<label class="f">Code</label><input class="in" data-k="code" data-a="nd" data-f="code" value="${esc(nd.code)}" placeholder="Y172" autocapitalize="characters">
    <label class="f">Name (optional)</label><input class="in" data-k="name" data-a="nd" data-f="name" value="${esc(nd.name)}" placeholder="e.g. Mor">
    <label class="f">Layout</label><div class="chips">${layouts.map(l => `<button class="chip ${nd.layout === l ? 'on' : ''}" data-a="ndlayout" data-l="${esc(l)}">${esc(l)}</button>`).join('')}</div>`}
    <label class="f">Matchings and opening stock (TP)</label>
    <div class="row tiny"><span class="sp">Colour name</span><span style="width:70px">Godown 1</span><span style="width:70px">Godown 2</span></div>
    ${nd.matchings.map((m, i) => `<div class="matchrow"><div class="row"><input type="color" data-a="ndm" data-i="${i}" data-f="colour" value="${esc(m.colour)}" style="width:34px;height:34px;border:0;background:none;padding:0"><input class="in" data-k="mn${i}" data-a="ndm" data-i="${i}" data-f="name" value="${esc(m.name)}" placeholder="Firozi"></div>
      <input class="in" data-k="m1${i}" data-a="ndm" data-i="${i}" data-f="tp1" type="number" inputmode="decimal" value="${esc(m.tp[1] ?? '')}" placeholder="0"><input class="in" data-k="m2${i}" data-a="ndm" data-i="${i}" data-f="tp2" type="number" inputmode="decimal" value="${esc(m.tp[2] ?? '')}" placeholder="0">
      <div class="row" style="grid-column:1/-1"><label class="btn ghost sm" style="margin:0">${m.photo ? '✓ Cut photo' : 'Cut photo (camera)'}<input type="file" accept="image/*" capture="environment" data-a="ndphoto" data-i="${i}" hidden></label>${m.photo ? `<img src="${m.photo}" class="sw" style="width:40px;height:40px">` : ''}<span class="sp"></span>${nd.matchings.length > 1 ? `<button class="tiny" data-a="ndrm" data-i="${i}" style="color:var(--rani);font-weight:700">Remove</button>` : ''}</div></div>`).join('')}
    <button class="btn ghost" data-a="ndadd">+ Add matching</button>
    <label class="f">Finished-product photo (optional)</label>
    <label class="btn ghost sm" style="margin:0">${nd.madePhoto ? '✓ Photo chosen' : 'Choose or take photo'}<input type="file" accept="image/*" data-a="ndmade" hidden></label>
    ${existing ? '' : `<label class="cb"><input type="checkbox" data-a="ndnew" ${nd.isNew ? 'checked' : ''}> Show in Design Room this week</label>`}
    <button class="btn" data-a="ndsave">Save ${existing ? 'to ' + esc(existing.code) : 'design'}</button>
  </div>`;
}
let nt = { firm: '', city: '', mobile: '', gstin: '', address: '', loginId: '', password: '' };
function tradersView() {
  return `<div class="bar"><h2>Traders<small>Logins and addresses</small></h2></div><div class="body">
    ${S.traders.map(tr => { const u = S.users.find(x => x.traderId === tr.id); const n = S.orders.filter(o => o.traderId === tr.id).length; return `<div class="card"><div class="row"><div class="sp"><div class="h3">${esc(tr.firm)}</div><div class="muted">${esc(tr.city)} · ${esc(tr.mobile)} · ${n} orders</div><div class="tiny">Login ID <span class="mono">${esc(u?.id || '—')}</span></div></div>
      <div style="display:flex;flex-direction:column;gap:6px"><button class="btn ${tr.active ? 'ghost' : 'sec'} sm" data-a="ttoggle" data-id="${tr.id}">${tr.active ? 'Disable' : 'Enable'}</button>${u ? `<button class="btn ghost sm" data-a="tpw" data-login="${esc(u.id)}">New password</button>` : ''}</div></div></div>`; }).join('')}
    <div class="card"><div class="h3">Add a trader</div>
      <label class="f">Firm name</label><input class="in" data-k="tfirm" data-a="nt" data-f="firm" value="${esc(nt.firm)}">
      <div class="grid2"><div><label class="f">City</label><input class="in" data-k="tcity" data-a="nt" data-f="city" value="${esc(nt.city)}"></div><div><label class="f">Mobile</label><input class="in" data-k="tmob" data-a="nt" data-f="mobile" inputmode="tel" value="${esc(nt.mobile)}"></div></div>
      <label class="f">GSTIN</label><input class="in" data-k="tgst" data-a="nt" data-f="gstin" value="${esc(nt.gstin)}">
      <label class="f">Delivery address</label><input class="in" data-k="taddr" data-a="nt" data-f="address" value="${esc(nt.address)}">
      <div class="grid2"><div><label class="f">Login ID</label><input class="in" data-k="tlog" data-a="nt" data-f="loginId" autocapitalize="off" value="${esc(nt.loginId)}"></div><div><label class="f">Password</label><input class="in" data-k="tpw" data-a="nt" data-f="password" value="${esc(nt.password)}"></div></div>
      <button class="btn" data-a="tsave">Create login</button>
      <div class="tiny" style="margin-top:6px">Then send the ID and password to the trader on WhatsApp.</div></div>
  </div>`;
}
function settingsView() {
  return `<div class="bar"><h2>Settings<small>Test controls</small></h2></div><div class="body">
    <div class="card"><div class="h3">Office WhatsApp number</div><div class="tiny">With country code, digits only. The trader’s “Ask rate” button opens this number.</div>
      <input class="in" data-k="wa" id="wa" inputmode="tel" value="${esc(S.settings.officeWhatsApp)}" style="margin-top:6px"><button class="btn sm" data-a="wasave" style="margin-top:8px">Save</button></div>
    <div class="card"><div class="h3">App address</div><div class="muted">Send traders this link: <span class="mono">${esc(location.origin)}</span><br>On Android Chrome they can use ⋮ → “Add to Home screen” to keep it like an app.</div></div>
    <div class="card"><div class="h3">Reset test data</div><div class="tiny">Puts stock back to the 16 Oct PDF figures and deletes all orders, new designs and new traders. Passwords go back to the original ones. Every phone updates at once.</div><button class="btn rani" data-a="reset">Reset everything</button></div>
    <p class="footnote">Pilot version. Orders here are for testing the flow; confirm real orders by phone until go-live.</p>
  </div>`;
}

const VIEWS = { stock: () => stockList(), design: designView, order: orderView, room: roomView, orders: myOrders, orderd: orderDetail, inbox, allorders: allOrders, pick: pickList, done: doneList, today, designs: designsView, add: addView, adjust: adjustView, traders: tradersView, settings: settingsView };

// ---------- events ----------
function readFile(file) { return new Promise(res => { if (!file) return res(null); const img0 = new Image(); const fr = new FileReader(); fr.onload = () => { img0.onload = () => { const c = document.createElement('canvas'); const s = Math.min(1, 1000 / Math.max(img0.width, img0.height)); c.width = img0.width * s; c.height = img0.height * s; c.getContext('2d').drawImage(img0, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .82)); }; img0.src = fr.result; }; fr.readAsDataURL(file); }); }

app.addEventListener('input', e => {
  const el = e.target, a = el.dataset.a; if (!a) return;
  if (a === 'q') { q = el.value; keepFocus(el); render(); }
  if (a === 'metres') { ord.metres = Math.max(0, Number(el.value) || 0); ord.err = ''; keepFocus(el); render(); }
  if (a === 'note') ord.note = el.value;
  if (a === 'nd') nd[el.dataset.f] = el.dataset.f === 'code' ? el.value.toUpperCase() : el.value;
  if (a === 'ndm') { const m = nd.matchings[Number(el.dataset.i)]; const f = el.dataset.f; if (f === 'tp1') m.tp[1] = el.value; else if (f === 'tp2') m.tp[2] = el.value; else m[f] = el.value; }
  if (a === 'nt') nt[el.dataset.f] = el.value;
  if (a === 'adjtp') adj.tp = el.value;
});
app.addEventListener('change', async e => {
  const el = e.target, a = el.dataset.a; if (!a) return;
  if (a === 'addr') ord.addressId = Number(el.value);
  if (a === 'accpick') accPick[Number(el.dataset.m)] = Number(el.value);
  if (a === 'adjg') adj.godownId = Number(el.value);
  if (a === 'adjr') adj.reason = el.value;
  if (a === 'ndnew') nd.isNew = el.checked;
  if (a === 'ndphoto') { nd.matchings[Number(el.dataset.i)].photo = await readFile(el.files[0]); render(); }
  if (a === 'ndmade') { nd.madePhoto = await readFile(el.files[0]); render(); }
});
app.addEventListener('click', async e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a; unlockAudio();
  try {
    if (a === 'login') return doLogin($('#lid').value, $('#lpw').value);
    if (a === 'logout') return logout();
    if (a === 'lang') { lang = lang === 'en' ? 'gu' : 'en'; localStorage.setItem('yug_lang', lang); return render(); }
    if (a === 'go') { const v = b.dataset.v; if (v === 'order') { ord = { metres: 100, addressId: ord.addressId, note: '', err: '' }; } if (v === 'adjust') adj = { godownId: 1, tp: '', reason: 'stock in' }; if (['stock', 'designs'].includes(v) && route.v !== v) { q = ''; filt = 'all'; } return go(v, { id: b.dataset.id, m: b.dataset.m, from: b.dataset.from, back: v === 'orderd' ? (route.v === 'orderd' ? route.back : route.v) : undefined }); }
    if (a === 'filt') { filt = b.dataset.f; return render(); }
    if (a === 'step') { ord.metres = Math.max(0, (Number(ord.metres) || 0) + Number(b.dataset.d)); ord.err = ''; return render(); }
    if (a === 'place') { b.disabled = true; try { await api('/api/order', { items: [{ matchingId: Number(b.dataset.m), metres: ord.metres }], addressId: ord.addressId, note: ord.note }); toast(t('placed'), 'good'); ord = { metres: 100, addressId: ord.addressId, note: '', err: '' }; await refresh(); go('orders'); } catch (err) { ord.err = err.message; b.disabled = false; await refresh(); } return; }
    if (a === 'accept') { const o = S.orders.find(x => x.id === Number(b.dataset.id)); const godowns = {}; o.items.forEach(i => { if (accPick[i.matchingId]) godowns[i.matchingId] = accPick[i.matchingId]; }); await api('/api/order/accept', { orderId: o.id, godowns }); accPick = {}; toast(`Accepted. Stock held and ${o.trader?.firm} notified.`, 'good'); await refresh(); return go(me.role === 'owner' ? 'today' : 'inbox'); }
    if (a === 'decline') { const reason = prompt('Reason for declining (shown to the trader):', ''); if (reason === null) return; await api('/api/order/decline', { orderId: Number(b.dataset.id), reason }); toast('Declined'); await refresh(); return go(me.role === 'owner' ? 'today' : 'inbox'); }
    if (a === 'packed') { await api('/api/order/packed', { orderId: Number(b.dataset.id) }); toast('Marked packed', 'good'); return refresh(); }
    if (a === 'dispatch') { const drv = $('#drv')?.value || '', veh = $('#veh')?.value || ''; if (!drv) { toast('Enter the driver name', 'err'); return; } await api('/api/order/dispatch', { orderId: Number(b.dataset.id), driver: drv, vehicle: veh }); toast('Dispatched. Stock reduced and trader notified.', 'good'); await refresh(); return go(me.role === 'owner' ? 'today' : 'done'); }
    if (a === 'ndlayout') { nd.layout = b.dataset.l; return render(); }
    if (a === 'ndadd') { nd.matchings.push({ name: '', colour: '#E9A21B', tp: {}, photo: null }); return render(); }
    if (a === 'ndrm') { nd.matchings.splice(Number(b.dataset.i), 1); return render(); }
    if (a === 'ndsave') { const payload = { id: nd.id, code: nd.code, name: nd.name, layout: nd.layout, isNew: nd.isNew, madePhoto: nd.madePhoto, matchings: nd.matchings.filter(m => m.name.trim()).map(m => ({ name: m.name, colour: m.colour, tp: { 1: m.tp[1], 2: m.tp[2] }, photo: m.photo })) }; if (!nd.id && !payload.matchings.length) throw new Error('Add at least one matching'); const r = await api('/api/design', payload); toast(`Saved. ${r.design.code} is now in Stock${r.design.isNew ? " and this week's Design Room" : ''}.`, 'good'); nd = null; await refresh(); return go('design', { id: r.design.id }); }
    if (a === 'adjsave') { await api('/api/stock', { matchingId: Number(b.dataset.m), godownId: adj.godownId, tp: Number(adj.tp), reason: adj.reason }); toast('Stock updated on every phone', 'good'); const m = matching(b.dataset.m); await refresh(); return go('design', { id: m.design.id, m: m.id }); }
    if (a === 'tsave') { await api('/api/trader', nt); toast(`Login created: ${nt.loginId} / ${nt.password}`, 'good'); nt = { firm: '', city: '', mobile: '', gstin: '', address: '', loginId: '', password: '' }; return refresh(); }
    if (a === 'tpw') { const pw = prompt(`New password for ${b.dataset.login} (at least 6 characters):`, ''); if (!pw) return; await api('/api/trader/password', { loginId: b.dataset.login, password: pw }); toast(`Password changed for ${b.dataset.login}`, 'good'); return; }
    if (a === 'ttoggle') { await api('/api/trader/toggle', { traderId: Number(b.dataset.id) }); return refresh(); }
    if (a === 'wasave') { await api('/api/settings', { officeWhatsApp: $('#wa').value }); toast('Saved', 'good'); return refresh(); }
    if (a === 'reset') { if (!confirm('Reset all test data? Orders and new designs will be deleted on every phone.')) return; await api('/api/reset', {}); toast('Reset done', 'good'); return refresh(); }
  } catch (err) { toast(err.message, 'err'); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && token) { refresh(); if (!es || es.readyState === 2) connect(); } });

// ---------- start ----------
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
if (token) { refresh().then(() => { if (me) connect(); else logout(); }); } else render();
})();
