'use strict';
const PL = window.PLACES, AREAS = window.AREAS, PR = window.PRADO, HOTEL = window.HOTEL;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem('nms.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('nms.' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('nms.' + k); } catch (e) {} }
};
const MADRID = [40.4168, -3.7038];
let pos = null, wx = LS.get('wx', null), wmode = LS.get('wmode', 'auto'), askCtx = null, deferredInstall = null;
let mood = LS.get('mood', 'vse'), tired = LS.get('tired', false), budget = LS.get('budget', 120), focus = null, factI = 0;
let ideaFor = [], ideaCats = [], ideaIn = false, ideaOpen = false, ideaArea = 'vse', ideaQ = '', mapFocusId = null;
const norm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/* search: own words match anywhere; keywords expand to related words (word start) */
const KW = [
  ['pasta', 'paste ', 'testenin', 'spaget', 'lazanj', 'lasagn', 'makaron', 'njok', 'ravioli', 'kanelon', 'carbonara', 'noodle'],
  ['pica ', 'pice ', 'pic ', 'pizza', 'pizze', 'picerij', 'pizzer', 'margherit', 'marinara'],
  ['italij', 'italian', 'neapelj', 'napolet', 'pizza', 'pica ', 'pice ', 'pasta', 'testenin', 'lazanj', 'tiramisu', 'burrat'],
  ['burger', 'hamburg', 'burguer', 'hot dog', 'hotdog', 'krompircek', 'pomfri', 'fries', 'amerisk'],
  ['susi', 'sushi', 'sasimi', 'japon', 'japan', 'maki ', 'gyoz', 'ramen', 'taiyaki'],
  ['rib', 'fish', 'morske sadez', 'morski sadez', 'morskih sadez', 'seafood', 'kozic', 'losos', 'tuna ', 'tune ', 'tuno ', 'tuni ', 'lignj', 'kalamar', 'calamar', 'hobotnic', 'skoljk', 'ostrig', 'polenov', 'trsk', 'bacalao', 'bakaljar', 'sardel', 'sardon', 'incun', 'mariscad', 'marisqu', 'brancin', 'merluz', 'jastog', 'rakci', 'rarog'],
  ['paell', 'riz ', 'riza ', 'rizem', 'arroz', 'fideua'],
  ['tapas', 'tapa ', 'tapase', 'pintx', 'pincho', 'kroket', 'croquet', 'vermut', 'taverna', 'taverni'],
  ['tortil', 'omlet', 'jajc', 'huevos', 'egg'],
  ['meso', 'mesn', 'odojek', 'odojk', 'zrezek', 'jagnj', 'steak', 'rebrc', 'zara ', 'zaru ', 'piscan', 'chicken', 'cocido', 'albondig'],
  ['vegetar', 'vegan', 'brez mesa', 'zelenjav'],
  ['zajtrk', 'breakfast', 'brunch', 'desayun', 'palacink', 'pancake', 'vaflj', 'waffle', 'toast', 'tostad', 'rogljic', 'croissant', 'acai'],
  ['palacink', 'pancake', 'crepe', 'vaflj', 'vafelj', 'waffle'],
  ['churro', 'porras', 'cokolad', 'chocolat', 'kakav'],
  ['sladoled', 'helado', 'ice cream', 'icecream', 'gelat', 'glu ', 'taiyaki'],
  ['sladic', 'sladk', 'sweet', 'dessert', 'torte', 'torta', 'pecivo', 'peciva', 'slascic', 'pasteler', 'tiramisu', 'bonbon', 'turron', 'marcipan', 'cokolad', 'churro'],
  ['milkshake', 'shake', 'smuti', 'smoothie'],
  ['kava ', 'kave ', 'kavo ', 'kavarn', 'cafe ', 'coffee', 'cafeteria'],
  ['mehis', 'mexic', 'tacos', 'taco ', 'nachos', 'burrito', 'guacamol'],
  ['hrana', 'hrano', 'food', 'kosilo', 'vecerj', 'restavr', 'restaurant', 'gostiln', 'trznic', 'mercado', 'market', 'lunch', 'dinner'],
  ['mack', 'macj', 'gatotec', 'cats '],
  ['zival', 'animal', 'zoo ', 'akvarij', 'aquarium', 'pingvin', 'delfin', 'morski lev', 'morske leve'],
  ['nogomet', 'football', 'futbol', 'soccer', 'stadion', 'real madrid', 'atletico', 'bernabeu', 'metropolitano', 'dres'],
  ['igr', 'play', 'igral', 'igrisc', 'playground', 'zabav', 'escape', 'uganke'],
  ['razgled', 'view', 'terasa', 'terase', 'rooftop', 'mirador', 'skywalk', 'soncni zahod', 'sunset'],
  ['muzej', 'museo', 'museum', 'galerij', 'razstav', 'umetn'],
  ['park', 'vrt ', 'vrtov', 'garden', 'jardin'],
  ['trgovin', 'shop', 'nakup', 'tienda', 'store'],
  ['cudez', 'magic', 'carov', 'harry', 'iluzij', 'illusion', 'pravljic', 'princes'],
  ['dez', 'rain', 'pod streho', 'notri', 'indoor'],
  ['zastonj', 'brezplac', 'free', 'gratis'],
  ['wellness', 'welness', 'spa ', 'masaz', 'massage', 'hammam', 'kopel', 'savn', 'sauna', 'relaks', 'sprostit'],
  ['flamenco', 'tablao', 'ples', 'dance', 'baile', 'balet', 'ballet', 'sevillan', 'kitar']
];
const KWI = KW.map(g => g.map(norm));
const KWPH = KWI.flatMap(g => g.filter(t => t.trim().includes(' ')).map(t => [t.trim(), t.trim().replace(/ /g, '_')]));
const STX = new Map();
const searchText = p => {
  let t = STX.get(p.id);
  if (t == null) {
    t = ' ' + norm([p.name, p.q, p.what, p.kidWhy, p.mamaWhy, CATS[p.cat] && CATS[p.cat][1], p.fb ? 'nogomet football' : '', p.set === 'in' ? 'pod streho notri' : '', p.free ? 'zastonj brezplacno' : '', areaOf(p).name, areaOf(p).short, p.food && Object.values(p.food).join(' '), (p.tags || []).join(' ')].join(' ')).replace(/[^a-z0-9]+/g, ' ') + ' ';
    STX.set(p.id, t);
  }
  return t;
};
// a query word expands to a keyword group when it is the start of a keyword (ribe -> rib..., palacinke -> palacink...)
const qWords = q => {
  let s = ' ' + norm(q).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  KWPH.forEach(([ph, tok]) => { s = s.split(' ' + ph + ' ').join(' ' + tok + ' '); });
  return s.trim().split(' ').filter(Boolean).map(w0 => {
    const w = w0.replace(/_/g, ' '), alt = new Set(), stems = [w];
    if (w.length >= 4) stems.push(w.replace(/[aeiou]+$/, ''));
    KWI.forEach(g => { if (g.some(t => { t = t.trim(); return (w.length >= 3 && t.startsWith(w)) || stems.some(c => c.length >= 3 && t.startsWith(c) && t.length <= c.length + 2); })) g.forEach(t => alt.add(t)); });
    return { w, alt: [...alt] };
  });
};
const matchWords = (p, ws) => { const t = searchText(p); return ws.every(({ w, alt }) => t.includes(' ' + w) || alt.some(a => t.includes(' ' + a))); };
const matchQ = (p, q) => matchWords(p, qWords(q));
// relevance: where it matches (name > description/food > rest) and how (whole word / keyword > only the start of a longer word, e.g. pica in Picasso)
const fieldTx = x => ' ' + norm(x).replace(/[^a-z0-9]+/g, ' ') + ' ';
const SFX = new Map();
const fieldsOf = p => { let f = SFX.get(p.id); if (!f) { f = [[fieldTx(p.name), 4], [fieldTx([p.what, p.q, p.food && Object.values(p.food).join(' '), CATS[p.cat] && CATS[p.cat][1]].join(' ')), 2], [searchText(p), 1]]; SFX.set(p.id, f); } return f; };
const scoreQ = (p, ws) => ws.reduce((sum, { w, alt }) => {
  const whole = new RegExp(' ' + w + '[a-z]{0,2} ');
  let best = 0;
  for (const [t, wt] of fieldsOf(p)) {
    if (whole.test(t)) best = Math.max(best, 3 * wt);
    else if (alt.some(a => t.includes(' ' + a))) best = Math.max(best, 2.5 * wt);
    else if (t.includes(' ' + w)) best = Math.max(best, 0.5 * wt);
  }
  return sum + best + (fieldsOf(p)[0][0].includes(' ' + w) ? 1 : 0);
}, 0);
let skip = LS.get('skip', { at: 0, ids: [] }); if (Date.now() - skip.at > 3 * 3600000) skip = { at: Date.now(), ids: [] };

/* ---------- helpers ---------- */
const WD = ['nedelja', 'ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota'];
const hhmm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const fmtT = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const fmtDur = m => m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
function dist(a, b) { const R = 6371000, r = x => x * Math.PI / 180; const dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
const fmtDist = m => m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
const walkMin = m => Math.max(1, Math.round(m * 1.3 / 75));
const maps = (ll, name) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name ? name + ', Madrid' : ll.join(','));
const route = (ll, mode) => 'https://www.google.com/maps/dir/?api=1&destination=' + ll.join(',') + '&travelmode=' + (mode || 'walking');
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2400); }
function copy(txt) {
  const ok = () => toast('Kopirano');
  const fb = () => { const a = document.createElement('textarea'); a.value = txt; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Kopiranje ni uspelo'); } a.remove(); };
  try { navigator.clipboard.writeText(txt).then(ok, fb); } catch (e) { fb(); }
}
function speak(txt) { try { const u = new SpeechSynthesisUtterance(txt); u.lang = 'es-ES'; u.rate = .9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { toast('Branje ni podprto'); } }
function getPos() {
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => { pos = { lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy), at: Date.now() }; res(pos); },
      () => res(null), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}
const GEN = () => ({ id: '_splosno', name: 'Kviz potovanja', quiz: window.QUIZ_GENERAL || [] });
const byId = id => id === '_splosno' ? GEN() : PL.find(p => p.id === id);

/* ---------- where are we ---------- */
const gpsInMadrid = () => pos && dist([pos.lat, pos.lon], MADRID) < 40000;
function here() {
  if (gpsInMadrid()) return { ll: [pos.lat, pos.lon], src: 'gps' };
  const a = AREAS.find(x => x.id === LS.get('area', null));
  if (a) return { ll: a.ll, src: 'area', area: a };
  return { ll: HOTEL.ll, src: 'default', area: AREAS[0] };
}
function landmark(ll) {
  let best = null;
  PL.forEach(p => { if (p.cat === 'hrana' || p.cat === 'sladko' || p.cat === 'trgovina') return; const d = dist(ll, p.ll); if (!best || d < best.d) best = { p, d }; });
  return best;
}
function whereText() {
  const h = here();
  if (h.src === 'area' || h.src === 'default') return h.area.id === 'hotel' ? 'pri hotelu' : 'v okolici: ' + h.area.name;
  const lm = landmark(h.ll);
  if (h.src === 'gps') return lm && lm.d < 1500 ? (lm.d < 120 ? 'pri: ' + lm.p.name : 'okoli ' + fmtDist(lm.d) + ' od: ' + lm.p.name) : 'GPS ' + h.ll.map(x => x.toFixed(3)).join(', ');
  return 'pri hotelu';
}
function areaOf(p) {
  let best = null; AREAS.forEach(a => { if (a.id === 'hotel') return; const d = dist(a.ll, p.ll); if (!best || d < best.d) best = { a, d }; });
  if (best && best.d < 2500) return best.a;
  return dist(HOTEL.ll, p.ll) < 1200 ? AREAS[0] : { id: 'drugo', short: 'Drugje', name: 'izven centra' };
}
const hotelDist = () => { const h = here(); return dist(h.ll, HOTEL.ll); };
function hotelBtn(big) {
  const d = hotelDist(), far = walkMin(d) > 20;
  if (d < 150) return '';
  return `<div class="hotelbar"><span>🏨 <b>Hotel</b> ${far ? '' : walkMin(d) + ' min peš · '}${fmtDist(d)}</span><a class="btn ${big ? 'primary' : ''}" target="_blank" rel="noopener" href="${route(HOTEL.ll, far ? 'transit' : 'walking')}">${far ? '🚇 Pot v hotel' : '🚶 Pot v hotel'}</a><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${HOTEL.ll.join(',')}&travelmode=driving">🚕</a></div>`;
}

/* ---------- weather ---------- */
const WMO = { 0: ['☀️', 'jasno'], 1: ['🌤️', 'pretežno jasno'], 2: ['⛅', 'delno oblačno'], 3: ['☁️', 'oblačno'], 45: ['🌫️', 'megla'], 48: ['🌫️', 'megla'], 51: ['🌦️', 'rosenje'], 53: ['🌦️', 'rosenje'], 55: ['🌧️', 'rosenje'], 61: ['🌧️', 'rahel dež'], 63: ['🌧️', 'dež'], 65: ['🌧️', 'močan dež'], 80: ['🌦️', 'plohe'], 81: ['🌧️', 'plohe'], 82: ['⛈️', 'močne plohe'], 95: ['⛈️', 'nevihta'], 96: ['⛈️', 'nevihta'] };
const wmo = c => WMO[c] || ['🌡️', 'spremenljivo'];
async function loadWeather(force) {
  if (!force && wx && Date.now() - wx.at < 30 * 60000) return;
  const c = gpsInMadrid() ? [pos.lat, pos.lon] : MADRID;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${c[0].toFixed(2)}&longitude=${c[1].toFixed(2)}&current=temperature_2m,apparent_temperature,weather_code&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunset&timezone=Europe%2FMadrid&forecast_days=5`;
  try { const r = await fetch(url); if (!r.ok) throw 0; wx = { at: Date.now(), d: await r.json() }; LS.set('wx', wx); render(true); } catch (e) {}
}
function wxNext(n) {
  if (!wx) return [];
  const h = wx.d.hourly, now = Date.now(), out = [];
  for (let i = 0; i < h.time.length && out.length < n; i++) { const t = new Date(h.time[i]); if (t.getTime() + 3600000 > now) out.push({ t, temp: h.temperature_2m[i], pop: h.precipitation_probability[i], code: h.weather_code[i] }); }
  return out;
}
function rainSoon() { const n = wxNext(3).filter(h => h.pop >= 50 || h.code >= 61); return n.length ? n[0] : null; }
const autoWet = () => !!rainSoon() || !!(wx && Date.now() - wx.at < 3 * 3600000 && wx.d.current.weather_code >= 51);
const isWet = () => wmode === 'rain' ? true : wmode === 'sun' ? false : autoWet();
function sunsetMin() {
  if (wx) { const today = new Date().toISOString().slice(0, 10), i = wx.d.daily.time.indexOf(today); if (i >= 0) return toMin(wx.d.daily.sunset[i].slice(11)); }
  return 17 * 60 + 58;
}
function wxCard() {
  if (!wx) return `<p style="margin:6px 0 0">Napoved se naloži ob prvi povezavi. <a href="https://www.aemet.es/en/eltiempo/prediccion/municipios/madrid-id28079" target="_blank" rel="noopener">AEMET</a></p>`;
  const hrs = wxNext(12), dl = wx.d.daily;
  return `<div class="hours">${hrs.map(h => `<div class="h ${h.pop >= 40 ? 'wet' : ''}"><span>${String(h.t.getHours()).padStart(2, '0')}h</span><b>${wmo(h.code)[0]}</b><span class="num">${Math.round(h.temp)}°</span><span class="num">${h.pop}%</span></div>`).join('')}</div>
    <div class="days">${dl.time.slice(0, 4).map((t, i) => `<div class="dd"><b>${WD[new Date(t + 'T12:00').getDay()].slice(0, 3)}</b>${wmo(dl.weather_code[i])[0]} <span class="num">${Math.round(dl.temperature_2m_min[i])}–${Math.round(dl.temperature_2m_max[i])}°</span><br><span class="num">dež ${dl.precipitation_probability_max[i]}%</span></div>`).join('')}</div>`;
}
const wxSeg = () => `<div class="seg wseg">${[['sun', '☀️ Lepo'], ['auto', 'Po napovedi'], ['rain', '☔ Dežuje']].map(([k, l]) => `<button class="${wmode === k ? 'on' : ''}" data-wmode="${k}">${l}</button>`).join('')}</div>`;
function wxFull() {
  const age = wx ? Math.round((Date.now() - wx.at) / 60000) : 0, r = rainSoon();
  const seg = '';
  const _unused = `<div class="seg wseg">${[['sun', '☀️ Lepo vreme'], ['auto', 'Po napovedi'], ['rain', '☔ Dežuje']].map(([k, l]) => `<button class="${wmode === k ? 'on' : ''}" data-wmode="${k}">${l}</button>`).join('')}</div>`;
  const note = `<p class="wnote">${isWet() ? '☔ Predlagam stvari pod streho.' : '☀️ Predlagam tudi parke in sprehode.'}${wmode === 'auto' ? ' Samodejno po napovedi.' : ' Ročno izbrano.'}</p>`;
  if (!wx) return `<div class="card"><div class="body"><span class="eyebrow">Vreme</span><p style="margin:6px 0 0">Napoved se naloži ob prvi povezavi. <a href="https://www.aemet.es/en/eltiempo/prediccion/municipios/madrid-id28079" target="_blank" rel="noopener">AEMET</a></p>${seg}${note}</div></div>`;
  const c = wx.d.current, [ic, txt] = wmo(c.weather_code);
  return `<div class="card"><div class="body">
    <div class="kick"><span class="eyebrow">Vreme v Madridu</span><button class="tag" data-act="wx">osveži · ${age < 2 ? 'zdaj' : 'pred ' + (age < 60 ? age + ' min' : Math.round(age / 60) + ' h')}</button></div>
    <div class="wx"><div class="ic">${ic}</div><div class="t num">${Math.round(c.temperature_2m)}°</div><div class="d">${txt} · občutek ${Math.round(c.apparent_temperature)}° · sonce zaide ${fmtT(sunsetMin())}</div></div>
    ${r ? `<div class="notice" style="margin-top:10px"><span>🌧️</span><div><b>Dež okoli ${String(r.t.getHours()).padStart(2, '0')}h (${r.pop}%).</b></div></div>` : ''}
    ${wxCard()}${note}
  </div></div>`;
}
function wxLine() {
  const age = wx ? Math.round((Date.now() - wx.at) / 60000) : 0;
  const head = wx ? `${wmo(wx.d.current.weather_code)[0]} <b class="num">${Math.round(wx.d.current.temperature_2m)}°</b> ${wmo(wx.d.current.weather_code)[1]} · sonce zaide ${fmtT(sunsetMin())}` : '🌡️ Vreme še ni naloženo';
  const r = rainSoon();
  return `<details class="card wxline"><summary><span>${head}</span>${r ? `<span class="tag" style="background:var(--sky-soft);color:var(--sky)">dež ${String(r.t.getHours()).padStart(2, '0')}h</span>` : ''}</summary><div class="body" style="padding-top:0">${wxCard()}<div class="actions"><button class="btn" data-act="wx">Osveži${wx ? ' · pred ' + (age < 60 ? age + ' min' : Math.round(age / 60) + ' h') : ''}</button></div></div></details>`;
}

/* ---------- opening hours ---------- */
function hoursToday(p, d) {
  if (!p.h) return { always: true };
  const k = d.getDay(), v = p.h[k] !== undefined ? p.h[k] : p.h.d;
  if (v == null) return { closed: true };
  if (v === '24h') return { always: true, text: 'odprto 24 ur' };
  const segs = v.split(',').map(s => s.trim().split('-').map(toMin)).map(([a, b]) => [a, b <= a ? b + 1440 : b]);
  return { segs, text: v.replace(/-/g, '–').replace(/,/g, ', ') };
}
function openState(p, d) {
  const dm = x => x.split('-').reverse().slice(0, 2).map(Number).join('. ') + '.';
  if (p.from && d < new Date(p.from + 'T00:00')) return { open: false, text: (p.cat === 'dogodek' ? 'od ' : 'odpre se ') + dm(p.from) };
  if (p.to && d > new Date(p.to + 'T23:59')) return { open: false, text: 'končano ' + dm(p.to) };
  const h = hoursToday(p, d);
  if (h.always) return { open: true, left: 9999, text: h.text || '' };
  if (h.closed) return { open: false, text: 'danes zaprto' };
  const m = d.getHours() * 60 + d.getMinutes();
  for (const [a, b] of h.segs) if (m >= a && m < b) return { open: true, left: b - m, text: 'danes ' + h.text };
  const nx = h.segs.find(([a]) => a > m);
  return { open: false, opensIn: nx ? nx[0] - m : null, text: 'danes ' + h.text };
}

/* ---------- fixed points (local only) ---------- */
function anchors() { return LS.get('anchors', []).map(a => ({ ...a, t: new Date(a.at) })).filter(a => !isNaN(a.t)).sort((a, b) => a.t - b.t); }
function nextAnchor() { const now = Date.now(); return anchors().find(a => a.t.getTime() > now - 30 * 60000) || null; }

/* ---------- suggestion engine ---------- */
const CATS = { ogled: ['🏛️', 'Ogled'], muzej: ['🖼️', 'Muzej'], nogomet: ['⚽', 'Nogomet'], igra: ['🛝', 'Igra in park'], razgled: ['🌇', 'Razgled'], hrana: ['🍽️', 'Hrana'], zajtrk: ['☕', 'Zajtrk in kava'], sladko: ['🍦', 'Sladko'], trgovina: ['🛍️', 'Trgovina'], dogodek: ['🎟️', 'Dogodek'] };
const FOR = {
  zelje: { l: '⭐ Želje', ok: (p, want) => want.includes(p.id) },
  mama: { l: '💐 Za mamo', ok: p => (p.mama || 0) >= 2 },
  otrok: { l: '🧒 Za otroka', ok: p => (p.kid || 0) >= 3 }
};
const MOODS = [['vse', '✨', 'Presenetite nas'], ['jesti', '🍽️', 'Lačni smo'], ['zajtrk', '☕', 'Zajtrk in kava'], ['sladko', '🍦', 'Nekaj sladkega'], ['nogomet', '⚽', 'Nogomet'], ['igra', '🛝', 'Igra in tek'], ['streha', '☔', 'Pod streho'], ['ogled', '🏛️', 'Ogledi'], ['dogodek', '🎟️', 'Dogodki'], ['mama', '💐', 'Za mamo']];
const moodOk = (p, md) => ({ vse: true, jesti: p.cat === 'hrana', zajtrk: p.cat === 'zajtrk', dogodek: p.cat === 'dogodek', mama: (p.mama || 0) >= 2, sladko: p.cat === 'sladko', nogomet: !!p.fb, igra: p.cat === 'igra' || (p.tags || []).includes('igra'), ogled: ['ogled', 'muzej', 'razgled'].includes(p.cat), streha: p.set === 'in' }[md]);
function suggest(md = mood) {
  const now = new Date(), m = now.getHours() * 60 + now.getMinutes(), h = here(), wet = isWet(), sun = sunsetMin();
  const done = new Set(LS.get('done', [])), want = new Set(LS.get('want', []));
  const lim = tired ? 12 : 22, an = nextAnchor();
  const toLeave = an ? (an.t.getTime() - (an.lead || 60) * 60000 - now.getTime()) / 60000 : Infinity;
  const lunch = m >= 750 && m <= 885, dinner = m >= 1110 && m <= 1260, snack = m >= 960 && m <= 1140;
  const out = [];
  PL.forEach(p => {
    if (skip.ids.includes(p.id) || !moodOk(p, md)) return;
    const st = openState(p, now);
    const ev = p.cat === 'dogodek';
    if (!st.open && !(st.opensIn != null && st.opensIn <= (ev ? 150 : 40))) return;
    if (ev && st.open && hoursToday(p, now).segs && st.left < p.dur * 0.7) return;
    const d = dist(h.ll, p.ll), w = walkMin(d), far = w > lim;
    const travel = far ? Math.min(40, 12 + Math.round(d / 1000 * 2.5)) : w;
    if (ev && !st.open && st.opensIn < travel) return;
    const stay = Math.min(p.dur, budget);
    if (st.open && !ev && st.left < travel + Math.min(p.dur, 40) * 0.6) return;
    if (toLeave > -30 && toLeave < travel + Math.min(p.dur, 40) + 10) return;
    let s = p.kid * 12; const why = [];
    why.push(far ? `🚕 ~${travel} min s taksijem ali metrojem` : `🚶 ${w} min peš`);
    s -= far ? 18 + travel * 0.6 : w * 1.1;
    if (md !== 'vse') s += 10;
    if (md === 'vse') {
      if (p.cat === 'hrana') s += (lunch || dinner) ? 12 : -30;
      if (p.cat === 'sladko') s += snack ? 10 : -14;
      if (p.cat === 'trgovina') s -= 8;
      if (p.cat === 'zajtrk') s += m >= 450 && m <= 660 ? 22 : -30;
      if (p.cat === 'dogodek') s += 6;
      if ((p.kid || 0) <= 1 && (p.mama || 0) < 3) s -= 6;
    }
    if (md === 'mama') s += (p.mama || 0) * 8 - p.kid * 6;
    if (md === 'zajtrk' && m >= 450 && m <= 660) why.push('☕ čas za zajtrk');
    if ((lunch || dinner) && p.cat === 'hrana') why.push('🕐 čas za obrok');
    if (wet) { if (p.set === 'in') { s += 18; why.push('☔ pod streho'); } else if (p.set === 'out') s -= 45; else s -= 12; }
    else if (m < sun + 20 && p.set !== 'in') { s += wmode === 'sun' ? 16 : 8; if (wmode === 'sun') why.push('☀️ zunaj'); }
    if (m > sun + 20 && p.set === 'out' && !(p.tags || []).includes('noc')) s -= 22;
    if (p.cat === 'razgled' && m < sun && sun - m < 80) { s += far ? 4 : 12; why.push('🌇 kmalu sončni zahod'); }
    if (tired) { if (p.dur > 90) s -= 18; if ((p.tags || []).includes('sedi')) { s += 10; why.push('🪑 sedite'); } }
    if (p.dur > budget + 30) s -= 25;
    if (want.has(p.id) && !done.has(p.id)) { if (!far && w <= 15) { s += 60; why.unshift('⭐ vaša želja, čisto blizu'); } else { s += 22; why.push('⭐ na seznamu želja'); } }
    if (done.has(p.id)) { s -= 70; why.push('že obiskano'); }
    if (p.fb) why.push('⚽ nogometna zgodba');
    if (p.quiz && p.quiz.length) why.push('❓ kviz');
    if ((p.mama || 0) >= 3) why.push('💐 tudi za mamo');
    if (p.free) why.push('brezplačno');
    if (!st.open) { s -= ev ? 0 : 6; why.push(ev ? `🎟️ začne ob ${fmtT(m + st.opensIn)}` : `⏳ začne čez ${st.opensIn} min`); }
    else if (st.left < 100) why.push(`odprto še ${fmtDur(st.left)}`);
    out.push({ p, s, d, w, far, travel, stay, why, st });
  });
  out.sort((a, b) => b.s - a.s);
  const chain = r => r.p.name.split(' (')[0].toLowerCase(), seenC = new Set();
  for (let i = 0; i < out.length; i++) { const c = chain(out[i]); if (seenC.has(c)) { out.splice(i, 1); i--; } else seenC.add(c); }
  if (focus) { const i = out.findIndex(r => r.p.id === focus); if (i > 0) out.unshift(out.splice(i, 1)[0]); }
  if (md === 'vse' && out.length > 3) { // variety: no two of the same kind in the top three
    const top = [out[0]];
    for (const r of out.slice(1)) { if (top.length >= 3) break; if (!top.some(t => t.p.cat === r.p.cat)) top.push(r); }
    for (const r of out) { if (top.length >= 3) break; if (!top.includes(r)) top.push(r); }
    return top.concat(out.filter(r => !top.includes(r)));
  }
  return out;
}

/* ---------- day plan from wishes ---------- */
const todayKey = () => new Date().toISOString().slice(0, 10);
function skipToday() { const x = LS.get('skipday', { d: '', ids: [] }); return x.d === todayKey() ? x.ids : []; }
const travelMin = (a, b) => { const d = dist(a, b), w = walkMin(d); return w <= 20 ? { min: w, mode: 'walking' } : { min: Math.min(40, 12 + Math.round(d / 1000 * 2.5)), mode: 'transit' }; };
function segsToday(p, d) {
  const st = openState(p, d);
  if (/^(odpre se|od |končano)/.test(st.text || '')) return [];
  const h = hoursToday(p, d);
  if (h.always) return [[0, 1440 + 120]];
  if (h.closed) return [];
  return h.segs;
}
function dayPlan() {
  const now = new Date(), nowM = now.getHours() * 60 + now.getMinutes();
  let t = Math.ceil(Math.max(nowM, 9 * 60 + 30) / 5) * 5;
  const h = here(), startLL = (nowM < 10 * 60 + 30 && h.src !== 'gps') ? HOTEL.ll : h.ll;
  const done = new Set(LS.get('done', [])), sk = new Set(skipToday()), wet = isWet(), rest = LS.get('rest', true);
  const an = anchors().find(a => a.t.toDateString() === now.toDateString() && a.t > now);
  const endM = an ? an.t.getHours() * 60 + an.t.getMinutes() - (an.lead || 60) : 21 * 60 + 30;
  const wishes = LS.get('want', []).map(byId).filter(p => p && p.id !== '_splosno' && !done.has(p.id));
  const notToday = [];
  let pool = wishes.filter(p => !sk.has(p.id)).filter(p => { if (!segsToday(p, now).length) { notToday.push({ p, why: openState(p, now).text || 'danes zaprto' }); return false; } return true; });
  const span = p => segsToday(p, now).reduce((x, [a, b]) => x + Math.min(b, 1440) - a, 0);
  const isFixed = p => p.cat === 'dogodek' || span(p) <= 300;
  const fits = (p, arr, limit) => { for (const [a, b] of segsToday(p, now)) { const at = Math.max(arr, a); if (p.cat === 'dogodek' && arr > a + 10) continue; const d = Math.min(p.dur, 90); if (b - at >= Math.min(p.dur, 45) && at + d <= Math.min(endM + 10, limit ?? 9999)) return at; } return null; };
  // phase 1: lock time-bound wishes
  const fixed = [];
  pool.filter(isFixed).sort((x, y) => segsToday(x, now)[0][0] - segsToday(y, now)[0][0]).forEach(p => {
    for (const [a, b] of segsToday(p, now)) {
      let at = Math.max(a, t + travelMin(startLL, p.ll).min);
      if (p.cat === 'dogodek' && at > a + 10) continue;
      while (fixed.some(f => at < f.end + 20 && at + p.dur + 20 > f.at) && at < b) at += 15;
      if (at + Math.min(p.dur, 45) <= b && at + p.dur <= endM + 10) { fixed.push({ p, at, end: at + p.dur }); return; }
    }
  });
  fixed.sort((x, y) => x.at - y.at);
  pool = pool.filter(p => !fixed.some(f => f.p === p));
  const out = [];
  let cur = startLL, lunch = t > 14 * 60 + 30, rested = !rest || t > 16 * 60 + 30, guard = 0;
  const nextF = () => fixed[0];
  const tryRest = () => {
    if (rested || !lunch || t >= 16 * 60) return;
    const tr = travelMin(cur, HOTEL.ll), nf2 = nextF(), back = nf2 ? travelMin(HOTEL.ll, nf2.p.ll).min : 0;
    const len = Math.min(90, nf2 ? nf2.at - back - (t + tr.min) - 5 : 90);
    if (len >= 45) { out.push({ rest: true, at: t + tr.min, end: t + tr.min + len, tr }); t += tr.min + len; cur = HOTEL.ll; }
    rested = true;
  };
  const pushFixed = () => { const f = fixed.shift(), tr = travelMin(cur, f.p.ll), at = Math.max(f.at, t + tr.min), dur = f.p.cat === 'hrana' ? Math.min(f.p.dur, 70) : f.p.dur; out.push({ p: f.p, at, end: at + dur, tr, wish: true, fixed: true, lunch: f.p.cat === 'hrana' && at >= 12 * 60 && at <= 15 * 60, wet: wet && f.p.set === 'out' }); t = at + dur; cur = f.p.ll; if (f.p.cat === 'hrana' && at >= 12 * 60 && at <= 15 * 60) { lunch = true; tryRest(); } };
  while (guard++ < 30) {
    const nf = nextF(), limit = nf ? nf.at - travelMin(cur, nf.p.ll).min - 5 : null;
    if (!lunch && t >= 12 * 60 + 45) {
      const lim = nf ? nf.at - 15 : 9999;
      const opts = pool.filter(p => p.cat === 'hrana').map(p => ({ p, tr: travelMin(cur, p.ll), wish: true }))
        .concat(PL.filter(p => p.cat === 'hrana' && p.kid >= 2 && !done.has(p.id) && !pool.includes(p)).map(p => ({ p, tr: travelMin(cur, p.ll), wish: false })).filter(x => x.tr.mode === 'walking' && x.tr.min <= 12))
        .map(x => ({ ...x, at: fits(x.p, t + x.tr.min, lim) })).filter(x => x.at != null).sort((a, b) => (a.wish ? -20 : 0) + a.tr.min - ((b.wish ? -20 : 0) + b.tr.min));
      const pick = opts[0];
      if (pick && (!nf || pick.at + 50 <= nf.at)) { const dur = Math.min(pick.p.dur, 70, nf ? nf.at - pick.at - 10 : 70); out.push({ p: pick.p, at: pick.at, end: pick.at + dur, tr: pick.tr, lunch: true, wish: pick.wish }); t = pick.at + dur; cur = pick.p.ll; pool = pool.filter(x => x !== pick.p); lunch = true; }
      else if (!nf || t + 60 > nf.at) { lunch = !nf ? true : lunch; if (nf) { pushFixed(); continue; } }
      tryRest();
      continue;
    }
    const cands = pool.map(p => {
      const tr = travelMin(cur, p.ll), at = fits(p, t + tr.min, limit); if (at == null) return null;
      if (!lunch && at < 12 * 60 + 45 && at + p.dur > 14 * 60 && p.cat !== 'hrana') return null;
      return { p, tr, at, cost: (at - t) * 1.2 + (wet && p.set === 'out' ? 25 : 0) - (p.kid * 10 + (p.fb ? 8 : 0)) };
    }).filter(Boolean).sort((a, b) => a.cost - b.cost);
    if (!cands.length) {
      if (!lunch && t < 12 * 60 + 45 && (!nf || nf.at > 12 * 60 + 45)) { t = 12 * 60 + 45; continue; }
      if (nf) { pushFixed(); continue; }
      break;
    }
    const c = cands[0];
    out.push({ p: c.p, at: c.at, end: c.at + c.p.dur, tr: c.tr, wish: true, wet: wet && c.p.set === 'out' });
    t = c.at + c.p.dur; cur = c.p.ll; pool = pool.filter(x => x !== c.p);
    if (c.p.cat === 'hrana' && c.at >= 12 * 60 && c.at <= 14 * 60 + 30) { lunch = true; tryRest(); }
  }
  fixed.forEach(f => pool.push(f.p));
  pool.forEach(p => notToday.push({ p, why: an && t >= endM - 30 ? 'ne izide se pred: ' + an.name : 'danes ne gre več v čas' }));
  return { out, notToday, skipped: wishes.filter(p => sk.has(p.id)), an, endM, wishes, wet };
}

/* ---------- AI prompts ---------- */
const ASKS = [
  { id: 'tu', ic: '🔎', label: 'Kaj je tukaj?', q: 'Kaj je tukaj okoli zanimivega? Povej zgodbo kraja, kakšno nogometno zanimivost, če obstaja, in kaj bi bilo otroku zabavno pogledati v 10 minutah hoje. Predlagaj tudi kaj, česar moja aplikacija nima na seznamu.' },
  { id: 'hrana', ic: '🍽️', label: 'Kje jemo zdaj?', q: 'Kje lahko zdaj blizu dobro in hitro jemo, sede? Upoštevaj, kdo je z nami.' },
  { id: 'dez', ic: '☔', label: 'Dežuje, kam?', q: 'Dežuje. Kam lahko blizu gremo pod streho za uro ali dve, da bo otroku zanimivo?' },
  { id: 'sladko', ic: '🍦', label: 'Nekaj sladkega', q: 'Kje je blizu dober sladoled, churrosi ali slaščičarna?' },
  { id: 'zgodba', ic: '📖', label: 'Zgodba za otroka', q: 'Povej kratko, napeto zgodbo ali tri zanimivosti o kraju, kjer smo, primerno za 7-letnika. Kratki stavki, da jih lahko prebere sam.' },
  { id: 'igrisce', ic: '🛝', label: 'Igrišče blizu', q: 'Kje je najbližje otroško igrišče ali park, kjer se lahko otrok izdivja?' },
  { id: 'wc', ic: '🚻', label: 'Stranišče', q: 'Kje je najbližje javno stranišče ali lokal oz. trgovski center, kjer lahko uporabimo stranišče?' },
  { id: 'lekarna', ic: '💊', label: 'Lekarna', q: 'Kje je najbližja odprta lekarna (tudi dežurna)?' }
];
function buildPrompt(q) {
  const now = new Date(), done = LS.get('done', []).map(id => byId(id)?.name).filter(Boolean);
  const sug = suggest().slice(0, 4).map(r => r.p.name);
  const w = wx ? ` Vreme: ${Math.round(wx.d.current.temperature_2m)} °C, ${wmo(wx.d.current.weather_code)[1]}${rainSoon() ? ', kmalu dež' : ''}.` : '';
  const an = nextAnchor();
  return `Sem v Madridu, ${whereText()}. Ura je ${hhmm(now)}, ${WD[now.getDay()]}.${w}
Smo družina: dva odrasla in 7-letni otrok. Otrok ne mara dolge hoje, obožuje nogomet (navija za Barcelono in Lamineja Yamala) in ima rad preprosto hrano (pica, burger, testenine, sladice). En odrasel ne je mesa, je pa ribe in morske sadeže. Ne maramo pekoče hrane.
Zdaj želimo: ${MOODS.find(x => x[0] === mood)[2].toLowerCase()}. ${tired ? 'Otrok je utrujen, največ 10 minut hoje.' : 'Hodimo lahko do 20 minut.'} Časa imamo okoli ${fmtDur(budget)}.${an ? ` Ob ${hhmm(an.t)} moramo biti na: ${an.name}.` : ''}
${done.length ? 'Danes in prej smo že bili: ' + done.join(', ') + '.\n' : ''}Moja aplikacija zdaj predlaga: ${sug.join(', ') || 'nič posebnega'}.

${q}

Odgovori v slovenščini in kratko: 3–5 konkretnih predlogov, za vsakega ime, zakaj je dober za nas, koliko je hoje, ali je zdaj odprto, in povezavo na Google Maps. Če česa ne veš zanesljivo, to povej.`;
}
function askPanel() {
  if (!askCtx) return '';
  const p = buildPrompt(askCtx.q);
  return `<div class="card" id="askpanel"><div class="body">
    <div class="kick"><span class="eyebrow">Vprašaj chat</span><button class="tag" data-act="askclose">zapri</button></div>
    <p style="margin:4px 0 0;font-weight:800">${esc(askCtx.label || 'Tvoje vprašanje')}</p>
    <p style="margin:4px 0 0;font-size:13px;color:var(--muted)">Pošlje se, kje ste (${esc(whereText())}), ura, vreme, kaj ste že videli in kaj predlaga aplikacija. Imen in nastanitve ni.</p>
    <div class="actions">
      <a class="btn green" target="_blank" rel="noopener" href="https://chatgpt.com/?q=${encodeURIComponent(p)}">ChatGPT</a>
      <a class="btn primary" target="_blank" rel="noopener" href="https://claude.ai/new?q=${encodeURIComponent(p)}">Claude</a>
      <button class="btn" data-act="copyprompt">Kopiraj</button>
    </div>
    <details class="sec"><summary>Kaj se pošlje</summary><pre style="white-space:pre-wrap;font:13px/1.45 var(--body);margin:8px 0 0">${esc(p)}</pre></details>
  </div></div>`;
}
function askBlock() {
  return `<div class="card"><div class="body"><span class="eyebrow">Vprašaj ChatGPT ali Claude za tukaj in zdaj</span><p style="margin:4px 0 0;font-size:13px;color:var(--muted)">Ko v aplikaciji ni pravega predloga, chat poišče še kaj drugega v bližini.</p>
    <div class="grid2" style="margin-top:10px">${ASKS.map(a => `<button class="ask" data-ask="${a.id}"><span>${a.ic}</span>${esc(a.label)}</button>`).join('')}</div>
    <textarea id="myq" rows="2" placeholder="Svoje vprašanje, npr. kje je tu igrišče?" style="margin-top:10px"></textarea>
    <div class="actions" style="margin-top:8px"><button class="btn" data-act="askmine">Pripravi vprašanje</button></div>
  </div></div>${askPanel()}`;
}

/* ---------- quizzes ---------- */
const qzKey = (id, i) => id + '#' + i;
const qzDone = () => LS.get('qz', {});
function quizBlock(p, open) {
  if (!p.quiz || !p.quiz.length) return '';
  const done = qzDone(), n = p.quiz.filter((_, i) => done[qzKey(p.id, i)]).length;
  return `<details class="sec quizsec" ${open ? 'open' : ''} data-id="qz-${p.id}"><summary>❓ Kviz za otroka <span class="tag gold">${n}/${p.quiz.length}</span></summary>
    ${p.quiz.map((q, i) => { const ok = done[qzKey(p.id, i)]; return `<div class="qz"><p><b>${esc(q.q)}</b></p>${ok ? `<p class="qok">⚽ Gol! ${esc(q.ok || '')}</p>` : `<div class="opts">${q.o.map((o, j) => `<button class="opt" data-qz="${p.id}|${i}|${j}">${esc(o)}</button>`).join('')}</div>`}</div>`; }).join('')}
  </details>`;
}
function quizGoals() { return Object.keys(qzDone()).length; }

/* ---------- place rendering ---------- */
function band(p) { return `<div class="band c-${p.cat}"><span>${CATS[p.cat][0]}</span></div>`; }
function details(p, qOpen) {
  return `${quizBlock(p, qOpen)}${p.mamaWhy ? `<p class="mamawhy"><b>Za mamo:</b> ${esc(p.mamaWhy)}</p>` : ''}${p.facts && p.facts.length ? `<details class="sec"><summary>Zanimivosti${p.facts.some(f => f.startsWith('⚽')) ? ' · ⚽' : ''}</summary><ul class="facts">${p.facts.map(f => `<li class="${f.startsWith('⚽') ? 'fb' : ''}">${esc(f.replace(/^⚽ /, ''))}</li>`).join('')}</ul></details>` : ''}
    ${p.food ? `<details class="sec" ${p.cat === 'hrana' ? 'open' : ''}><summary>Kaj jesti tukaj</summary><div class="food"><div class="f">${p.food.what ? esc(p.food.what) : ''}<div class="who">${p.food.nomeat ? `<span class="nm">brez mesa: ${esc(p.food.nomeat)}</span>` : ''}${p.food.kid ? `<span class="kd">otrok: ${esc(p.food.kid)}</span>` : ''}${p.food.note ? `<span>${esc(p.food.note)}</span>` : ''}</div></div></div></details>` : ''}
    ${p.tip ? `<details class="sec"><summary>Praktično</summary><ul class="facts">${[].concat(p.tip).map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>` : ''}
    ${p.unv && p.unv.length ? `<p class="unv">Ni zanesljivo preverjeno (${esc(p.unv.map(u => ({ hours: 'ure', price: 'cena', price_adult: 'cena', price_child7: 'cena', ll: 'lokacija', still_open: 'ali še obratuje' })[String(u).split('.')[0]] || u).filter((x, i, a) => a.indexOf(x) === i).join(', '))}). Pred obiskom preveri.</p>` : ''}`;
}
function links(p) {
  return (p.links || []).map(l => `<a class="btn ${l.t ? 'red' : ''}" target="_blank" rel="noopener" href="${esc(l.u)}">${l.t ? '🎟️' : '🔗'} ${esc(l.l)}</a>`).join('') + (p.id === 'prado' ? '<a class="btn gold" href="#prado">🕵️ Igra v Pradu</a>' : '');
}
function metaLine(p, st) {
  return `<div class="meta">${st ? `<span>🕒 ${esc(st.text || 'vedno odprto')}</span>` : ''}${p.price ? `<span>💶 ${esc(p.price)}</span>` : ''}<span>⏱️ ${fmtDur(p.dur)}</span></div>`;
}
function pickCard(r) {
  const p = r.p, done = LS.get('done', []).includes(p.id);
  return `<article class="card pick">
    ${p.img ? `<figure><img src="${p.img[0]}" alt="" loading="lazy"><figcaption>${esc(p.img[1])}</figcaption></figure>` : band(p)}
    <div class="body">
      <div class="kick"><span class="eyebrow">Predlog · ${CATS[p.cat][1]} · ${esc(areaOf(p).short)}</span>${done ? '<span class="tag green">obiskano</span>' : ''}</div>
      <h2>${esc(p.name)}</h2>
      <p class="desc">${esc(p.what)}</p>
      ${p.kidWhy ? `<p class="kidwhy"><b>Za otroka:</b> ${esc(p.kidWhy)}</p>` : ''}
      <div class="why">${r.why.map(w => `<span>${esc(w)}</span>`).join('')}</div>
      ${metaLine(p, r.st)}
      ${p.warn ? `<div class="notice warn" style="margin-top:10px"><span>⚠️</span><div>${esc(p.warn)}</div></div>` : ''}
      <div class="actions">
        <a class="btn primary big" target="_blank" rel="noopener" data-go="${p.id}" href="${route(p.ll, r.far ? 'transit' : 'walking')}">🧭 Gremo</a>
        <button class="btn big" data-skip="${p.id}">↻ Drugo</button>
      </div>
      <div class="actions" style="margin-top:8px">
        <button class="btn ${LS.get('want', []).includes(p.id) ? 'gold' : ''}" data-want="${p.id}">⭐ Želimo</button>
        <button class="btn" data-done="${p.id}">${done ? '✔ Obiskano' : '✔ Tu smo že bili'}</button>
        <a class="btn" target="_blank" rel="noopener" href="${maps(p.ll, p.q || p.name)}">📍 Zemljevid</a>
        ${links(p)}
      </div>
      ${details(p)}
    </div></article>`;
}
function altRow(r) {
  const p = r.p;
  return `<button class="alt" data-focus="${p.id}"><span class="ic c-${p.cat}">${CATS[p.cat][0]}</span><span class="tx"><b>${esc(p.name)}</b><small>${esc(r.why.slice(0, 2).join(' · '))}</small></span><span class="go">›</span></button>`;
}
function hereCard() {
  if (!gpsInMadrid()) return '';
  let lm = null; const me = [pos.lat, pos.lon];
  PL.forEach(p => { if (!(p.facts && p.facts.length) || p.cat === 'dogodek') return; const d = dist(me, p.ll); if (d < 400 && (!lm || d < lm.d)) lm = { p, d }; });
  if (!lm) return '';
  const f = lm.p.facts[factI % lm.p.facts.length];
  return `<div class="card herecard"><div class="body"><span class="eyebrow">${lm.d < 120 ? 'Tukaj ste' : 'V bližini, ' + fmtDist(lm.d)}: ${esc(lm.p.name)}</span>
    <p style="margin:6px 0 0;font-size:17px;font-weight:700">${f.startsWith('⚽') ? '⚽ ' : 'Ali veš? '}${esc(f.replace(/^⚽ /, ''))}</p>
    <div class="actions"><button class="btn" data-act="nextfact">Še ena zanimivost (${(factI % lm.p.facts.length) + 1}/${lm.p.facts.length})</button></div>${quizBlock(lm.p, true)}</div></div>`;
}

/* ---------- views ---------- */
function locBlock() {
  const h = here(), area = LS.get('area', null) || 'hotel';
  const farGps = pos && !gpsInMadrid();
  return `<div class="card" id="loc"><div class="body">
    <div class="kick"><span class="eyebrow">Kje ste</span>${h.src === 'gps' ? `<span class="tag green">GPS ±${pos.acc} m</span>` : ''}</div>
    <p style="margin:2px 0 0;font-weight:800">${esc(whereText())}</p>
    ${farGps ? '<p style="margin:4px 0 0;font-size:13px;color:var(--muted)">Telefon ni v Madridu, zato predlagam od izbranega mesta.</p>' : ''}
    <div class="chips" style="margin-top:10px">
      <button class="chip ${h.src === 'gps' ? 'on' : ''}" data-act="locate">📍 GPS</button>
      ${AREAS.map(a => `<button class="chip ${area === a.id && h.src !== 'gps' ? 'on' : ''}" data-area="${a.id}">${esc(a.short)}</button>`).join('')}
    </div></div></div>`;
}
function anchorBanner() {
  const an = nextAnchor(); if (!an) return '';
  const now = Date.now(), leave = an.t.getTime() - (an.lead || 60) * 60000, mins = Math.round((leave - now) / 60000);
  if (mins > 8 * 60) return '';
  const late = mins <= 0;
  return `<div class="notice ${late ? 'warn' : ''}"><span>⏰</span><div><b>${esc(an.name)} ob ${hhmm(an.t)}.</b> ${late ? 'Čas je za odhod!' : `Odhod najkasneje ob ${hhmm(new Date(leave))}, še ${fmtDur(mins)}. Predlagam samo stvari, ki se izidejo.`}${an.ll ? ` <a href="${route(an.ll, 'transit')}" target="_blank" rel="noopener">Pot tja</a>` : ''}</div></div>`;
}
function vZdaj() {
  const list = suggest(), top = list[0], alts = list.slice(1, 4);
  return `<section class="page wrap">
    <div><span class="eyebrow">${WD[new Date().getDay()]} · ${hhmm(new Date())}</span><h1 class="title">Kam zdaj?</h1><button class="whereln" data-act="toloc">📍 ${esc(whereText())} <u>spremeni</u></button></div>
    ${anchorBanner()}
    ${wishCard()}
    ${hereCard()}
    <div class="moods">${MOODS.map(([k, ic, l]) => `<button class="mood ${mood === k ? 'on' : ''}" data-mood="${k}"><span>${ic}</span>${esc(l)}</button>`).join('')}</div>
    <div class="row">
      <button class="toggle" data-act="tired" aria-pressed="${tired}"><span>😴 Utrujeni</span><span class="sw"></span></button>
      ${wxSeg()}
      <div class="seg">${[[60, '1 h'], [120, '2 h'], [240, 'več']].map(([v, l]) => `<button class="${budget === v ? 'on' : ''}" data-budget="${v}">${l}</button>`).join('')}</div>
    </div>
    ${top ? pickCard(top) : `<div class="notice"><span>🤷</span><div>Za to izbiro zdaj ni nič odprtega v bližini. Izberi drugo razpoloženje ali vprašaj chat spodaj.${skip.ids.length ? ' <button class="tag" data-act="unskip">pokaži preskočene</button>' : ''}</div></div>`}
    ${alts.length ? `<div><span class="eyebrow">Ali pa</span></div><div class="alts">${alts.map(altRow).join('')}</div>` : ''}
    ${hotelBtn(tired)}
    ${skip.ids.length ? `<p style="margin:0;font-size:13px;color:var(--muted)">Preskočeno: ${skip.ids.length}. <button class="tag" data-act="unskip">ponastavi</button></p>` : ''}
    ${wxFull()}
    ${askBlock()}
    ${locBlock()}
  </section>`;
}
function ideaList() {
  const h = here(), now = new Date(), want = LS.get('want', []), ws = ideaQ.trim() ? qWords(ideaQ) : null;
  let list = PL.filter(p => !(p.to && now > new Date(p.to + 'T23:59'))).map(p => ({ p, d: dist(h.ll, p.ll), st: openState(p, now) }));
  list = list.filter(r => ideaFor.every(k => FOR[k].ok(r.p, want)) && (!ideaCats.length || ideaCats.some(c => r.p.cat === c || (c === 'nogomet' && r.p.fb))) && (!ideaIn || r.p.set === 'in') && (!ideaOpen || r.st.open) && (ideaArea === 'vse' || areaOf(r.p).id === ideaArea) && (!ws || matchWords(r.p, ws)));
  if (ws) list.forEach(r => { r.n = scoreQ(r.p, ws); });
  list.sort((a, b) => (ws ? b.n - a.n : 0) || a.d - b.d);
  return list;
}
function vIdeje() {
  const want = LS.get('want', []);
  const cats = Object.entries(CATS).map(([k, v]) => [k, v[0] + ' ' + v[1]]), any = ideaFor.length || ideaCats.length;
  return `<section class="page wrap">
    <div><span class="eyebrow">${PL.length} krajev · od ${esc(whereText())}</span><h1 class="title">Ideje</h1><p style="margin:4px 0 0;color:var(--muted)">Vse, kar je v aplikaciji. Označi ⭐, kar si želite; predlagalnik jih postavi višje.</p></div>
    <div class="search"><span>🔎</span><input type="search" id="iq" placeholder="Išči: skywalk, churros, pica, Retiro …" value="${esc(ideaQ)}" autocomplete="off" enterkeyhint="search"></div>
    <div class="chips"><button class="chip ${any ? '' : 'on'}" data-icat="vse">Vse</button>${Object.entries(FOR).map(([k, f]) => `<button class="chip for ${ideaFor.includes(k) ? 'on' : ''}" data-ifor="${k}" aria-pressed="${ideaFor.includes(k)}">${f.l}${k === 'zelje' ? ' ' + want.length : ''}</button>`).join('')}<span class="chipsep" aria-hidden="true"></span>${cats.map(([k, l]) => `<button class="chip ${ideaCats.includes(k) ? 'on' : ''}" data-icat="${k}" aria-pressed="${ideaCats.includes(k)}">${l}</button>`).join('')}</div>
    <p class="chiphint">${any ? esc([...ideaFor.map(k => FOR[k].l), ideaCats.length ? ideaCats.map(c => CATS[c][1]).join(' ali ') : ''].filter(Boolean).join(' + ')) + ' · <button class="tag" data-icat="vse">počisti</button>' : 'Izbereš lahko več hkrati, na primer 💐 Za mamo + 🍽️ Hrana.'}</p>
    <div class="chips scroll"><button class="chip ${ideaArea === 'vse' ? 'on' : ''}" data-iarea="vse">📍 Vsa področja</button>${AREAS.concat([{ id: 'drugo', short: 'Drugje' }]).filter(a => PL.some(p => areaOf(p).id === a.id)).map(a => `<button class="chip ${ideaArea === a.id ? 'on' : ''}" data-iarea="${a.id}">${esc(a.short)} <small>${PL.filter(p => areaOf(p).id === a.id).length}</small></button>`).join('')}</div>
    <div class="row"><button class="toggle" data-act="iin" aria-pressed="${ideaIn}"><span>Pod streho</span><span class="sw"></span></button><button class="toggle" data-act="iopen" aria-pressed="${ideaOpen}"><span>Odprto zdaj</span><span class="sw"></span></button></div>
    <div id="ideaOut">${ideaOut()}</div>
  </section>`;
}

function ideaBody(p, d, st) {
  const done = LS.get('done', []), want = LS.get('want', []);
  return `          ${p.kidWhy ? `<p class="kidwhy" style="margin-top:0"><b>Za otroka:</b> ${esc(p.kidWhy)}</p>` : ''}
          ${metaLine(p, st)}
          ${p.warn ? `<div class="notice warn" style="margin-top:10px"><span>⚠️</span><div>${esc(p.warn)}</div></div>` : ''}
          <div class="actions">
            <a class="btn primary" target="_blank" rel="noopener" href="${route(p.ll, walkMin(d) > 22 ? 'transit' : 'walking')}">🧭 Pot</a>
            <button class="btn ${want.includes(p.id) ? 'gold' : ''}" data-want="${p.id}">⭐ ${want.includes(p.id) ? 'Želimo' : 'Želimo'}</button>
            <button class="btn ${done.includes(p.id) ? 'green' : ''}" data-done="${p.id}">✔ ${done.includes(p.id) ? 'Obiskano' : 'Bili smo'}</button>
            <button class="btn" data-mapgo="${p.id}">🗺️ Na zemljevidu</button>
            ${links(p)}
          </div>
          ${details(p)}`;
}
function ideaOut() {
  const list = ideaList(), now = new Date(), done = LS.get('done', []), want = LS.get('want', []), q = ideaQ.trim();
  return `${q || ideaFor.length || ideaCats.length ? '' : wishCard()}
    ${q ? `<p class="qcount">${list.length ? 'Najdeno: ' + list.length : 'Nič ne ustreza iskanju' + (ideaFor.length || ideaCats.length || ideaArea !== 'vse' || ideaIn || ideaOpen ? '. Filtri so vklopljeni, <button class="tag" data-act="ifreset">počisti filtre</button>' : '.')}</p>` : ''}
    <div class="ideas">${list.map(({ p, d, st }) => `<details class="card idea" data-id="${p.id}" ${q && list.length <= 2 ? 'open' : ''}><summary>
        ${p.img ? `<img src="${p.img[0]}" alt="" loading="lazy">` : `<span class="ic c-${p.cat}">${CATS[p.cat][0]}</span>`}
        <span class="tx"><b>${want.includes(p.id) ? '⭐ ' : ''}${esc(p.name)}${done.includes(p.id) ? ' ✔' : ''}</b><small>${esc(p.what)}</small><small class="${st.open ? 'op' : 'cl'}">${esc(areaOf(p).short)} · ${st.open ? 'odprto' : st.opensIn != null ? 'odpre ob ' + fmtT(now.getHours() * 60 + now.getMinutes() + st.opensIn) : /^odpre se/.test(st.text) ? st.text : 'zdaj zaprto'} · ${fmtDist(d)}</small></span></summary>
        <div class="body" data-lazy="${p.id}">${q && list.length <= 2 ? ideaBody(p, d, st) : ''}</div>
</details>`).join('') || '<p>Nič ne ustreza filtru.</p>'}</div>
`;
}

/* ---------- today view ---------- */
function vDanes() {
  const P = dayPlan(), n = P.wishes.length;
  const row = x => x.rest ? `<div class="tli rest"><div class="tt num">${fmtT(x.at)}</div><div class="tb"><b>🏨 Počitek v hotelu</b><small>${x.tr.mode === 'walking' ? '🚶' : '🚇'} ${x.tr.min} min do hotela · do ${fmtT(x.end)}</small><div class="actions" style="margin-top:6px"><a class="btn" target="_blank" rel="noopener" href="${route(HOTEL.ll, x.tr.mode)}">Pot v hotel</a></div></div></div>`
    : `<div class="tli ${x.lunch ? 'lunch' : ''}"><div class="tt num">${fmtT(x.at)}</div><div class="tb">
      <small>${x.tr.mode === 'walking' ? '🚶' : '🚇'} ${x.tr.min} min${x.lunch ? ' · kosilo' + (x.wish ? '' : ' (predlog aplikacije)') : ''}${x.wet ? ' · ☔ zunaj' : ''}</small>
      <b>${x.wish ? '⭐ ' : ''}${esc(x.p.name)}</b><small>${esc(x.p.what)}</small><small>do ${fmtT(x.end)} · ${esc(areaOf(x.p).short)}${x.p.price ? ' · ' + esc(x.p.price) : ''}</small>
      ${x.p.warn ? `<small class="cl">⚠️ ${esc(x.p.warn)}</small>` : ''}
      <div class="actions" style="margin-top:6px"><a class="btn primary" target="_blank" rel="noopener" href="${route(x.p.ll, x.tr.mode)}">🧭 Pot</a><button class="btn" data-done="${x.p.id}">✔ Bili smo</button>${x.wish ? `<button class="btn" data-skipday="${x.p.id}">✖ Danes ne</button>` : ''}<button class="btn" data-focus-go="${x.p.id}">Več</button></div></div></div>`;
  return `<section class="page wrap">
    <div><span class="eyebrow">${WD[new Date().getDay()]} · iz vaših želja</span><h1 class="title">Načrt za danes</h1>
      <p style="margin:4px 0 0;color:var(--muted)">Uredim vaše ⭐ želje po odpiralnih časih, razdaljah in vremenu. Obiskano izpustim. Načrt se sproti posodablja.</p></div>
    ${anchorBanner()}
    ${!n ? `<div class="notice"><span>⭐</span><div><b>Še nimate želja.</b> V zavihku Ideje ali pri predlogu pritisnite ⭐ Želimo pri stvareh, ki jih res želite videti. Tu jih potem zložim v dan. <div class="actions"><a class="btn primary" href="#ideje" data-iwish="1">Odpri Ideje</a></div></div></div>` : ''}
    ${P.wet ? '<div class="notice"><span>☔</span><div>Napoved kaže dež; stvari zunaj sem dal na konec ali označil.</div></div>' : ''}
    <div class="row"><button class="toggle" data-act="rest" aria-pressed="${LS.get('rest', true)}"><span>🏨 Počitek po kosilu</span><span class="sw"></span></button></div>
    ${P.out.length ? `<div class="tl2">${P.out.map(row).join('')}</div>` : n ? '<div class="notice"><span>🤷</span><div>Danes se nobena želja ne izide več. Poglejte Kam zdaj za predloge v bližini.</div></div>' : ''}
    ${P.notToday.length ? `<div class="card"><div class="body"><span class="eyebrow">Ne gre danes</span><ul class="facts">${P.notToday.map(x => `<li><b>${esc(x.p.name)}</b>: ${esc(x.why)}</li>`).join('')}</ul></div></div>` : ''}
    ${P.skipped.length ? `<p style="margin:0;font-size:13px;color:var(--muted)">Danes izpuščeno: ${P.skipped.map(p => esc(p.name)).join(', ')}. <button class="tag" data-act="unskipday">vrni</button></p>` : ''}
    ${n ? `<div class="card"><div class="body"><span class="eyebrow">Vse vaše želje (${n})</span><div class="wl">${P.wishes.map(p => `<span>${esc(p.name)}<button data-want="${p.id}" aria-label="Odstrani">✕</button></span>`).join('')}</div><div class="actions"><a class="btn" href="#ideje" data-iwish="1">Dodaj še</a></div></div></div>` : ''}
  </section>`;
}
function wishCard() {
  const n = LS.get('want', []).filter(id => !LS.get('done', []).includes(id)).length;
  if (!n) return `<a class="wishcard" href="#danes"><span>📅</span><span><b>Načrt za danes</b><small>Označite ⭐ želje v Idejah, pa vam jih zložim v dan.</small></span><span class="go">›</span></a>`;
  const P = dayPlan(), nx = P.out.find(x => !x.rest);
  const morning = new Date().getHours() < 12 && P.out.length;
  return `<a class="wishcard on" href="#danes"><span>📅</span><span><b>${morning ? 'Dobro jutro! Danes predlagam' : 'Načrt za danes iz želja: ' + P.out.filter(x => !x.rest).length + ' postankov'}</b>${morning ? `<small class="mlist">${P.out.slice(0, 5).map(x => `<span><b class="num">${fmtT(x.at)}</b> ${x.rest ? '🏨 počitek' : esc(x.p.name)}</span>`).join('')}${P.out.length > 5 ? `<span>… še ${P.out.length - 5}</span>` : ''}</small>` : `<small>${nx ? 'Naslednje: ' + esc(nx.p.name) + ' ob ' + fmtT(nx.at) : 'Danes se nobena želja ne izide več.'}</small>`}</span><span class="go">›</span></a>`;
}

/* ---------- map ---------- */
let map = null, mapLayer = null, mapCat = 'vse', mapMarkers = {}, meDot = null, meRing = null, followMe = false, watchId = null, nearAt = null;
/* live location while the map is open: blue dot + accuracy ring, nearest list refreshes as you walk */
function startWatch() {
  if (watchId != null || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(p => {
    const first = !gpsInMadrid();
    pos = { lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy), at: Date.now() };
    if (gpsInMadrid()) { if (LS.get('area', null)) LS.del('area'); drawMe(first); }
  }, () => { stopWatch(); toast('Lokacije ni bilo mogoče dobiti. Preveri dovoljenje za lokacijo.'); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
}
function stopWatch() { if (watchId != null) { try { navigator.geolocation.clearWatch(watchId); } catch (e) {} watchId = null; } }
function drawMe(first) {
  if (!map || !gpsInMadrid()) return;
  const ll = [pos.lat, pos.lon];
  if (!meDot) {
    meRing = L.circle(ll, { radius: pos.acc, color: '#2E6D9B', weight: 1, fillColor: '#2E6D9B', fillOpacity: .12, interactive: false }).addTo(map);
    meDot = L.circleMarker(ll, { radius: 9, color: '#fff', weight: 3, fillColor: '#2E6D9B', fillOpacity: 1 }).addTo(map).bindPopup('Tukaj ste');
  } else { meDot.setLatLng(ll); meRing.setLatLng(ll).setRadius(pos.acc); }
  if (first || followMe) map.setView(ll, Math.max(map.getZoom() || 15, 15), { animate: false });
  if (!nearAt || dist(nearAt, ll) > 30) refreshNear();
  const b = $('#mapme'); if (b) b.textContent = '📍 Sledim ±' + pos.acc + ' m';
}
function nearList() {
  const h = here(), now = new Date();
  const L0 = PL.filter(p => (mapCat === 'vse' || p.cat === mapCat) && !(p.to && now > new Date(p.to + 'T23:59'))).map(p => ({ p, d: dist(h.ll, p.ll), st: openState(p, now) }));
  // nearest first; something closed counts as if it were a bit further away (soon open: +300 m, closed: +1.5 km)
  const eff = r => r.d + (r.st.open ? 0 : r.st.opensIn != null && r.st.opensIn <= 60 ? 300 : 1500);
  const rows = L0.sort((a, b) => eff(a) - eff(b)).slice(0, 6);
  const label = h.src === 'gps' ? 'Najbližje vam' : 'Najbližje od: ' + whereText().replace(/^v okolici: /, '');
  return `<span class="eyebrow">${esc(label)}${mapCat === 'vse' ? '' : ' · ' + CATS[mapCat][1]}</span>
    <div class="nlist">${rows.map(({ p, d, st }) => `<button data-mapnear="${p.id}"><span class="ic c-${p.cat}">${CATS[p.cat][0]}</span><span class="tx"><b>${esc(p.name)}</b><small class="${st.open ? 'op' : 'cl'}">${st.open ? 'odprto' : st.opensIn != null ? 'odpre ob ' + fmtT(now.getHours() * 60 + now.getMinutes() + st.opensIn) : esc(st.text || 'zaprto')} · ${walkMin(d) <= 25 ? '🚶 ' + walkMin(d) + ' min' : fmtDist(d)}</small></span></button>`).join('') || '<small>Ni krajev v tej kategoriji.</small>'}</div>
    ${h.src === 'gps' ? '' : '<small class="nhint">Ko ste v Madridu, pritisnite 📍 Kje sem in seznam se računa od vas.</small>'}`;
}
function refreshNear() { const b = $('#mnear'); if (!b) return; b.innerHTML = nearList(); nearAt = gpsInMadrid() ? [pos.lat, pos.lon] : null; }
function vZemljevid() {
  const cats = [['vse', 'Vse']].concat(Object.entries(CATS).map(([k, v]) => [k, v[0] + ' ' + v[1]]));
  return `<section class="page wrap mappage">
    <div class="search"><span>🔎</span><input type="search" id="mq" placeholder="Najdi na zemljevidu …" autocomplete="off" enterkeyhint="search"><div class="mres" id="mres"></div></div>
    <div class="chips scroll">${cats.map(([k, l]) => `<button class="chip ${mapCat === k ? 'on' : ''}" data-mcat="${k}">${l}</button>`).join('')}</div>
    <div id="map" class="map"></div>
    <div class="row"><button class="btn" id="mapme" data-act="mapme">📍 Kje sem</button><button class="btn" data-act="maphotel">🏨 Hotel</button>${hotelBtn(false) ? `<a class="btn primary" target="_blank" rel="noopener" href="${route(HOTEL.ll, 'transit')}">Pot v hotel</a>` : ''}</div>
    <div class="card"><div class="body" id="mnear">${nearList()}</div></div>
    <p style="margin:0;font-size:12px;color:var(--muted)">Podlaga © OpenStreetMap. Brez povezave se zemljevid ne naloži, seznam v Ideje pa dela.</p>
  </section>`;
}
function initMap() {
  const el = $('#map'); if (!el) return;
  if (!window.L) { el.innerHTML = '<p style="padding:16px">Zemljevid potrebuje povezavo.</p>'; return; }
  if (map) { map.remove(); map = null; }
  meDot = meRing = null; mapMarkers = {}; nearAt = null;
  const h = here();
  map = L.map(el, { zoomControl: true });
  if (h.src === 'gps') map.setView(h.ll, 15); else map.fitBounds([[40.4150, -3.7085], HOTEL.ll], { padding: [24, 24] });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  mapLayer = L.layerGroup().addTo(map);
  const now = new Date();
  PL.filter(p => (mapCat === 'vse' || p.cat === mapCat) && !(p.to && now > new Date(p.to + 'T23:59'))).forEach(p => {
    const st = openState(p, now);
    const m = mapMarkers[p.id] = L.marker(p.ll, { icon: L.divIcon({ className: 'pin c-' + p.cat + (st.open ? '' : ' shut'), html: CATS[p.cat][0], iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(mapLayer);
    if (p.id === mapFocusId) setTimeout(() => { map.setView(p.ll, 16); m.openPopup(); mapFocusId = null; }, 50);
    m.bindPopup(`<b>${esc(p.name)}</b><br><small>${esc(p.what)}</small><br><small>${st.open ? '🟢 odprto' : '🔴 ' + esc(st.text || 'zdaj zaprto')}</small><br><a href="${route(p.ll, walkMin(dist(h.ll, p.ll)) > 22 ? 'transit' : 'walking')}" target="_blank" rel="noopener">🧭 Pot</a> · <a href="#" data-mapfocus="${p.id}">Predlagaj to</a> · <a href="#" data-mapwant="${p.id}">${LS.get('want', []).includes(p.id) ? '⭐ v željah' : '☆ Želimo'}</a>`);
  });
  L.marker(HOTEL.ll, { zIndexOffset: 1000, icon: L.divIcon({ className: 'pin hotel', html: '🏨', iconSize: [44, 44], iconAnchor: [22, 22] }) }).addTo(map).bindPopup(`<b>Naš hotel</b><br>${esc(HOTEL.name)}<br><small>${esc(HOTEL.addr)}</small>`);
  map.on('dragstart', () => { followMe = false; const b = $('#mapme'); if (b && watchId != null) b.textContent = '📍 Kje sem'; });
  drawMe(false);
  try { navigator.permissions.query({ name: 'geolocation' }).then(s => { if (s.state === 'granted') startWatch(); }); } catch (e) {}
}

/* ---------- Prado game ---------- */
function pg() { return LS.get('prado', { name: '', step: -1, g: {}, fav: null, pen: false }); }
function pgSave(s) { LS.set('prado', s); }
function goals(s) { let n = 0; Object.values(s.g).forEach(m => { n += (m.find ? 1 : 0) + (m.quiz ? 1 : 0) + (m.bonus ? 1 : 0); }); return n + (s.pen ? 1 : 0); }
const maxGoals = () => PR.matches.reduce((a, m) => a + 2 + (m.bonus ? 1 : 0), 0) + 1;
function board(s, label) { return `<div class="board"><div class="team">${esc(s.name || 'Ti')}</div><div class="sc">${goals(s)} : 0</div><div class="team">Prado</div><div class="min">${label}</div></div>`; }
function vPrado() {
  const s = pg();
  if (s.step < 0) return `<section class="page wrap">
    <div class="hero" style="min-height:150px"><img src="img/f-meninas.jpg" alt="" style="object-position:center 60%"><div class="in"><span class="eyebrow">Museo del Prado</span><h1>Detektivska liga</h1><p>${esc(PR.intro)}</p></div></div>
    <div class="card"><div class="body"><label class="eyebrow" for="pname">Kako ti je ime, kapetan?</label><input type="text" id="pname" maxlength="20" value="${esc(s.name)}" placeholder="Tvoje ime" style="margin-top:8px"><div class="actions"><button class="btn gold big block" data-act="pstart">⚽ Začni tekmo</button></div><p style="font-size:12px;color:var(--muted);margin:8px 0 0">Ime ostane samo na tem telefonu.</p></div></div>
    <div class="card"><div class="body"><span class="eyebrow">Za starše</span><ul class="facts">${PR.parents.map(p => `<li>${p}</li>`).join('')}</ul></div></div>
    ${GEN().quiz.length ? `<div class="goalbar">⚽ Goli iz kvizov: <b>${quizGoals()}</b></div><div class="card"><div class="body"><span class="eyebrow">Kviz potovanja · Španija, Madrid in nogomet</span>${quizBlock(GEN(), true)}<p style="margin:10px 0 0;font-size:13px;color:var(--muted)">Še več vprašanj je pri vsakem kraju v zavihku Kam zdaj in Ideje.</p></div></div>` : ''}
  </section>`;
  if (s.step >= PR.matches.length) return vPradoEnd(s);
  const m = PR.matches[s.step], r = s.g[m.id] || {};
  const done = r.find && r.quiz;
  return `<section class="page wrap">
    ${board(s, `Tekma ${s.step + 1} od ${PR.matches.length}`)}
    <div class="match">
      <div class="head"><span class="eyebrow">${esc(m.where)}</span><span class="tag">${esc(m.by)}</span></div>
      <h2>${esc(m.title)}</h2>
      <div class="ask-es"><div><b>${esc(m.es)}</b><br><small style="color:var(--muted)">${esc(m.esSl)} Pokaži čuvaju ali predvajaj.</small></div><button data-say="${esc(m.es)}" aria-label="Predvajaj">🔊</button></div>
      <div class="sec2 find"><span class="eyebrow" style="color:#8a6400">1 · Najdi</span><p style="margin:6px 0 0;font-weight:800">${esc(m.find.text)}</p><img src="${m.find.img}" alt="Podrobnost slike">
        <div class="actions"><button class="btn ${r.find ? 'green' : 'gold'} block" data-pfind="find" ${r.find ? 'disabled' : ''}>${r.find ? 'Gol! ⚽ Našel si' : 'Našel sem! ⚽'}</button></div></div>
      <div class="sec2 quiz"><span class="eyebrow" style="color:var(--green)">2 · Vprašanje</span><p style="margin:6px 0 0;font-weight:800">${esc(m.quiz.q)}</p>
        <div class="opts">${m.quiz.options.map((o, i) => `<button class="opt ${r.quiz && i === m.quiz.a ? 'ok' : ''}" data-pq="${i}" ${r.quiz ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>
        <div class="goal" id="pfb" style="padding:8px 0 0">${r.quiz ? esc(m.quiz.ok) : ''}</div></div>
      ${m.bonus ? `<div class="sec2 find"><span class="eyebrow" style="color:#8a6400">Bonus</span><p style="margin:6px 0 0;font-weight:800">${esc(m.bonus.text)}</p><img src="${m.bonus.img}" alt="Podrobnost slike"><div class="actions"><button class="btn ${r.bonus ? 'green' : 'gold'} block" data-pfind="bonus" ${r.bonus ? 'disabled' : ''}>${r.bonus ? 'Gol! ⚽' : 'Našel sem! ⚽'}</button></div></div>` : ''}
      ${done ? `<div class="sec2 fact"><span class="eyebrow" style="color:var(--sky)">Ali si vedel?</span><p style="margin:6px 0 0">${esc(m.fact)}</p></div><div class="full"><img src="${m.full}" alt="${esc(m.title)}"></div>${m.extra ? `<div class="full"><img src="${m.extra}" alt="Zaprta slika"></div>` : ''}` : ''}
      <div class="foot">
        ${s.step > 0 ? '<button class="btn" data-act="pprev">← Nazaj</button>' : ''}
        <button class="btn ${done ? 'primary big' : ''}" data-act="pnext">${done ? (s.step + 1 < PR.matches.length ? 'Naslednja tekma →' : 'Na enajstmetrovko →') : 'Slike ne najdemo, naprej →'}</button>
      </div>
    </div>
  </section>`;
}
function vPradoEnd(s) {
  const all = maxGoals(), n = goals(s);
  return `<section class="page wrap">
    ${board(s, 'Konec tekme')}
    <div class="match">
      <h2>Enajstmetrovka</h2>
      <div class="ask-es"><div><b>${esc(PR.penalty.es)}</b><br><small style="color:var(--muted)">${esc(PR.penalty.esSl)}</small></div><button data-say="${esc(PR.penalty.es)}" aria-label="Predvajaj">🔊</button></div>
      <div class="sec2 find"><p style="margin:0;font-weight:800">${esc(PR.penalty.text)}</p><div class="actions"><button class="btn ${s.pen ? 'green' : 'gold'} block" data-act="ppen" ${s.pen ? 'disabled' : ''}>${s.pen ? 'Gol! ⚽ Vprašal si' : 'Vprašal sem! ⚽'}</button></div></div>
      <div class="sec2" style="background:var(--card2)"><span class="eyebrow">Tvoja najljubša slika</span><div class="fav" style="margin-top:8px">${PR.matches.map(m => `<button class="${s.fav === m.id ? 'sel' : ''}" data-fav="${m.id}"><img src="${m.full}" alt=""><span>${esc(m.title)}</span></button>`).join('')}</div></div>
      ${s.pen && s.fav ? `<div style="padding:18px 16px 0;text-align:center"><div class="cup">🏆</div><h2 style="padding:6px 0 0">${esc(s.name || 'Ti')} ${n} : 0 Prado</h2><p style="margin:6px 0 0;font-weight:800">${n >= all - 1 ? 'Popolna tekma, prvi detektiv Prada!' : n >= all - 4 ? 'Odlična tekma! Detektiv z odliko.' : 'Zmaga je zmaga! Prado ni zadel nič.'}</p><p style="margin:6px 0 0;color:var(--muted)">Pokaži staršem, da ti vpišejo žig v potni list.</p></div>` : ''}
      <div class="foot"><button class="btn" data-act="pprev">← Nazaj</button><button class="btn" data-act="preset">Nova tekma</button></div>
    </div>
  </section>`;
}

/* ---------- more ---------- */
const PHRASES = [
  ['Una mesa para tres, por favor.', 'Miza za tri, prosim.'], ['No como carne, pero sí pescado.', 'Ne jem mesa, ribe pa.'], ['¿Lleva carne o jamón?', 'Ali je v tem meso ali pršut?'],
  ['Sin picante, por favor.', 'Brez pekočega, prosim.'], ['¿Tiene menú infantil?', 'Imate otroški meni?'], ['Agua sin gas.', 'Voda brez mehurčkov.'],
  ['La cuenta, por favor.', 'Račun, prosim.'], ['¿Dónde está el baño?', 'Kje je stranišče?'], ['¿Dónde está la parada de taxi?', 'Kje je postajališče taksijev?'],
  ['Necesito ayuda.', 'Potrebujem pomoč.'], ['¡Vamos España!', 'Dajmo, Španija!'], ['¡Gol!', 'Gol!']
];
const PRESET_ANCHORS = [{ name: 'Tekma Španija – Anglija, Metropolitano', at: '2026-11-15T20:45', lead: 150, ll: [40.4362, -3.5995] }];
function vVec() {
  const an = anchors();
  return `<section class="page wrap">
    <div class="card"><div class="body"><span class="eyebrow">Fiksne točke · samo v tem telefonu</span>
      <p style="margin:6px 0 0;font-size:14px;color:var(--muted)">Stvari z uro, ki jih ne smete zamuditi. Predlagalnik potem ponuja samo, kar se izide do odhoda.</p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">${an.map(a => `<div class="place"><div><b>${esc(a.name)}</b><br><small>${WD[a.t.getDay()]} ${a.t.getDate()}. ${a.t.getMonth() + 1}. ob ${hhmm(a.t)} · odhod ${a.lead || 60} min prej</small></div><button class="tag" data-delanchor="${esc(a.at + '|' + a.name)}">odstrani</button></div>`).join('') || '<p style="margin:0">Še nobene.</p>'}</div>
      <div class="form"><input type="text" id="an-name" maxlength="60" placeholder="Kaj, npr. Skywalk"><input type="datetime-local" id="an-at" value="2026-11-13T17:00"><select id="an-lead"><option value="30">odhod 30 min prej</option><option value="60" selected>odhod 1 h prej</option><option value="90">odhod 1,5 h prej</option><option value="150">odhod 2,5 h prej</option></select></div>
      <div class="actions"><button class="btn primary" data-act="addanchor">Dodaj</button>${PRESET_ANCHORS.filter(p => !an.some(a => a.at === p.at)).map((p, i) => `<button class="btn" data-preset="${i}">+ ${esc(p.name.split(',')[0])}</button>`).join('')}</div></div></div>
    <div class="card"><div class="body"><span class="eyebrow">Naš hotel</span>
      <p style="margin:6px 0 0"><b>${esc(HOTEL.name)}</b><br>${esc(HOTEL.addr)}, Madrid <button class="tag" data-copy="${esc(HOTEL.name + ', ' + HOTEL.addr + ', 28009 Madrid')}">kopiraj naslov</button></p>
      <p style="margin:6px 0 0;font-size:14px;color:var(--muted)">${esc(HOTEL.metro)}</p>
      <div class="actions"><a class="btn primary" target="_blank" rel="noopener" href="${route(HOTEL.ll, 'transit')}">🚇 Pot v hotel</a><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${HOTEL.ll.join(',')}&travelmode=driving">🚕 S taksijem</a><a class="btn" href="#zemljevid">🗺️ Na zemljevidu</a></div>
    </div></div>
    <div class="card"><div class="body"><span class="eyebrow">Španske fraze · pritisni 🔊</span><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${PHRASES.map(([es, sl]) => `<div class="phr"><b>${esc(es)}</b><button data-say="${esc(es)}" aria-label="Predvajaj">🔊</button><small>${esc(sl)}</small></div>`).join('')}</div></div></div>
    <div class="card"><div class="body"><span class="eyebrow">Nujno</span><ul class="facts">
      <li><b>112</b> je evropska številka za nujne primere, deluje tudi v Španiji. <button class="tag" data-copy="112">kopiraj</button></li>
      <li>Otroku dajte v žep listek s telefonsko številko staršev in dogovorite točko srečanja, če se izgubite (npr. medved na Solu).</li>
      <li>Lekarna je "Farmacia" z zelenim križem. Ponoči je odprta dežurna ("de guardia"); seznam visi na vratih vsake lekarne.</li>
      <li>Žeparji: Sol, Plaza Mayor, Gran Vía in metro. Telefoni v notranji žep, nahrbtniki spredaj.</li></ul></div></div>
    <div class="card"><div class="body"><span class="eyebrow">Prevozi</span><ul class="facts">
      <li><b>Metro L10</b> med Nuevos Ministerios in Cuzco je zaprt (postaja Santiago Bernabéu); nadomestni brezplačni avtobus S10. Do Bernabéua raje taksi.</li>
      <li><b>Metropolitano:</b> metro L7, postaja Estadio Metropolitano, je tik ob stadionu.</li>
      <li><b>Vozovnice:</b> kartica Tarjeta Multi 2,50 €, nanjo 10 voženj za 7,30 €, deljivo med vsemi. Otroci do 4 let brezplačno.</li>
      <li><b>Letališče:</b> taksi v center fiksno 33 €; avtobus 203 Exprés Aeropuerto 5 €, 24 ur; metro L8 + doplačilo 3 €.</li>
      <li><b>Taksi ali Cabify:</b> taksi ustaviš na ulici (zelena lučka) ali na postajališču.</li></ul>
      <div class="actions"><a class="btn" target="_blank" rel="noopener" href="https://www.metromadrid.es/en/travel-in-the-metro/metro-de-madrid-maps">Zemljevid metroja</a><a class="btn" target="_blank" rel="noopener" href="https://www.emtmadrid.es/Aeropuerto">Avtobus 203</a><a class="btn" target="_blank" rel="noopener" href="https://cabify.com/es">Cabify</a></div></div></div>
    <div class="card"><div class="body"><span class="eyebrow">Namesti na telefon</span>
      <p style="margin:6px 0 0">Android, Chrome: meni ⋮ → <b>Namesti aplikacijo</b> ali <b>Dodaj na začetni zaslon</b>. iPhone, Safari: Deli → <b>Dodaj na začetni zaslon</b>. Po prvem odprtju dela tudi brez povezave, razen vremena in chata.</p>
      ${deferredInstall ? '<div class="actions"><button class="btn primary" data-act="install">Namesti zdaj</button></div>' : ''}</div></div>
    <div class="card"><div class="body"><span class="eyebrow">Zasebnost</span>
      <p style="margin:6px 0 0">To je javna stran brez imen, letov in vstopnic; hotel je vpisan namenoma. Fiksne točke, želje, obiskano in napredek iger ostanejo samo v tem telefonu. Open-Meteo dobi zaokroženo lokacijo za vreme. Chat dobi samo opis, kje ste (najbližja znamenitost), in to samo, ko sami pritisnete gumb. Zemljevid nalaga podlago z OpenStreetMap.</p>
      <div class="actions"><button class="btn" data-act="undone">Počisti "obiskano"</button><button class="btn" data-act="wipe">Izbriši vse podatke s tega telefona</button></div></div></div>
  </section>`;
}

/* ---------- render & events ---------- */
const VIEWS = { zdaj: vZdaj, danes: vDanes, ideje: vIdeje, zemljevid: vZemljevid, prado: vPrado, vec: vVec };
function view() { const h = location.hash.slice(1); return VIEWS[h] ? h : 'zdaj'; }
function render(keepScroll) {
  const v = view(), y = window.scrollY;
  const open = keepScroll ? [...document.querySelectorAll('details[open][data-id]')].map(d => d.dataset.id) : [];
  $('#app').innerHTML = VIEWS[v]();
  open.forEach(id => { const d = document.querySelector(`details[data-id="${id}"]`); if (d) d.open = true; });
  if (v === 'zemljevid') initMap(); else { stopWatch(); followMe = false; if (map) { map.remove(); map = null; } }
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.v === (v === 'danes' ? 'zdaj' : v)));
  $('#net').innerHTML = navigator.onLine ? '<span class="dot"></span> povezano' : '<span class="dot off"></span> brez povezave';
  if (keepScroll) window.scrollTo(0, y);
}
window.addEventListener('hashchange', () => { if (['nacrt', 'blizu'].includes(location.hash.slice(1))) { location.replace('#zdaj'); return; } askCtx = null; render(); window.scrollTo(0, 0); });
window.addEventListener('online', () => { render(true); loadWeather(); });
window.addEventListener('offline', () => render(true));
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (view() === 'vec') render(true); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && view() === 'zdaj') { render(true); loadWeather(); } });
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c); const x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
  const cols = ['#B5202D', '#D29B13', '#1F5E4D', '#2E6D9B', '#ffffff'];
  const ps = Array.from({ length: 90 }, () => ({ x: innerWidth / 2, y: innerHeight * .4, vx: (Math.random() - .5) * 14, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 3, c: cols[Math.random() * 5 | 0], a: Math.random() * 6 }));
  let t = 0; (function f() { x.clearRect(0, 0, c.width, c.height); ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .35; p.a += .1; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6); x.restore(); }); if (++t < 80) requestAnimationFrame(f); else c.remove(); })();
}
function toggleList(key, id) { const l = LS.get(key, []), i = l.indexOf(id); if (i >= 0) l.splice(i, 1); else l.push(id); LS.set(key, l); return i < 0; }
let iqT = null;
document.addEventListener('input', ev => {
  if (ev.target.id !== 'mq') return;
  const q = ev.target.value.trim(), box = $('#mres');
  if (!box) return;
  box.innerHTML = q.length < 2 ? '' : (ws => PL.filter(p => matchWords(p, ws)).map(p => [p, scoreQ(p, ws)]).sort((a, b) => b[1] - a[1]).map(x => x[0]))(qWords(q)).slice(0, 6).map(p => `<button data-mapfind="${p.id}">${CATS[p.cat][0]} ${esc(p.name)}</button>`).join('') || '<small>Ni zadetkov</small>';
});
function refreshIdeas() {
  const box = $('#ideaOut'); if (!box) return;
  const open = [...box.querySelectorAll('details[open][data-id]')].map(d => d.dataset.id);
  box.innerHTML = ideaOut();
  open.forEach(id => { const d = box.querySelector(`details[data-id="${id}"]`); if (d) d.open = true; });
}
document.addEventListener('input', ev => {
  if (ev.target.id !== 'iq' || ev.isComposing) return;
  ideaQ = ev.target.value; clearTimeout(iqT);
  iqT = setTimeout(refreshIdeas, 250);
});
document.addEventListener('toggle', ev => {
  const d = ev.target; if (!d.open || !d.matches || !d.matches('details[data-id]')) return;
  const b = d.querySelector(':scope > .body[data-lazy]'); if (!b || b.childElementCount) return;
  const p = PL.find(x => x.id === b.dataset.lazy); if (!p) return;
  const now = new Date(); b.innerHTML = ideaBody(p, dist(here().ll, p.ll), openState(p, now));
}, true);
document.addEventListener('click', async ev => {
  const mf = ev.target.closest('a[data-mapfocus]');
  const mw = ev.target.closest('a[data-mapwant]');
  if (mw) { ev.preventDefault(); const on = toggleList('want', mw.dataset.mapwant); mw.textContent = on ? '⭐ v željah' : '☆ Želimo'; toast(on ? '⭐ Na seznamu želja' : 'Odstranjeno iz želja'); return; }
  const iw = ev.target.closest('a[data-iwish]');
  if (iw) { ideaFor = ['zelje']; ideaCats = []; }
  if (mf) { ev.preventDefault(); focus = mf.dataset.mapfocus; mood = 'vse'; LS.set('mood', mood); location.hash = '#zdaj'; return; }
  const go = ev.target.closest('a[data-go]');
  if (go) { const l = LS.get('done', []); if (!l.includes(go.dataset.go)) { l.push(go.dataset.go); LS.set('done', l); } focus = null; setTimeout(() => render(true), 400); return; }
  const t = ev.target.closest('button'); if (!t) return;
  const a = t.dataset.act;
  if (t.dataset.mood) { mood = t.dataset.mood; LS.set('mood', mood); focus = null; render(true); return; }
  if (t.dataset.wmode) { wmode = t.dataset.wmode; LS.set('wmode', wmode); focus = null; render(true); return; }
  if (t.dataset.budget) { budget = +t.dataset.budget; LS.set('budget', budget); render(true); return; }
  if (t.dataset.area) { LS.set('area', t.dataset.area); pos = null; focus = null; render(true); toast('Predlagam od: ' + whereText().replace(/^v okolici: /, '')); return; }
  if (t.dataset.skip) { skip.ids.push(t.dataset.skip); skip.at = Date.now(); LS.set('skip', skip); focus = null; render(true); return; }
  if (t.dataset.focus) { focus = t.dataset.focus; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (t.dataset.done) { const on = toggleList('done', t.dataset.done); toast(on ? 'Označeno kot obiskano' : 'Odznačeno'); render(true); return; }
  if (t.dataset.want) { const on = toggleList('want', t.dataset.want); toast(on ? '⭐ Na seznamu želja' : 'Odstranjeno iz želja'); render(true); return; }
  if (t.dataset.qz) { const [id, i, j] = t.dataset.qz.split('|'), p = byId(id), q = p && p.quiz[+i]; if (!q) return;
    if (+j === q.a) { const d = qzDone(); d[qzKey(id, i)] = 1; LS.set('qz', d); confetti(); toast('GOOOL! ⚽ ' + quizGoals() + ' golov iz kvizov'); render(true); }
    else { t.classList.add('no'); toast('Skoraj! Poskusi še enkrat.'); }
    return; }
  if (t.dataset.skipday) { const x = LS.get('skipday', { d: '', ids: [] }); const ids = x.d === todayKey() ? x.ids : []; ids.push(t.dataset.skipday); LS.set('skipday', { d: todayKey(), ids }); toast('Danes izpuščeno, jutri spet v načrtu'); render(true); return; }
  if (t.dataset.focusGo) { focus = t.dataset.focusGo; mood = 'vse'; LS.set('mood', mood); location.hash = '#zdaj'; return; }
  if (t.dataset.iarea) { ideaArea = t.dataset.iarea; render(true); return; }
  if (t.dataset.mapnear) { const m = mapMarkers[t.dataset.mapnear], p = byId(t.dataset.mapnear); followMe = false; if (map && m && p) { map.setView(p.ll, 17, { animate: false }); m.openPopup(); window.scrollTo({ top: 0, behavior: 'smooth' }); } return; }
  if (t.dataset.mapfind) { mapFocusId = t.dataset.mapfind; mapCat = 'vse'; render(true); return; }
  if (t.dataset.mapgo) { mapFocusId = t.dataset.mapgo; mapCat = 'vse'; location.hash = '#zemljevid'; return; }
  if (t.dataset.mcat) { mapCat = t.dataset.mcat; render(true); return; }
  if (t.dataset.icat) { const c = t.dataset.icat; if (c === 'vse') { ideaFor = []; ideaCats = []; } else ideaCats = ideaCats.includes(c) ? ideaCats.filter(x => x !== c) : ideaCats.concat(c); render(true); return; }
  if (t.dataset.ifor) { const c = t.dataset.ifor; ideaFor = ideaFor.includes(c) ? ideaFor.filter(x => x !== c) : ideaFor.concat(c); render(true); return; }
  if (t.dataset.say) { speak(t.dataset.say); return; }
  if (t.dataset.copy) { copy(t.dataset.copy); return; }
  if (t.dataset.preset !== undefined) { const p = PRESET_ANCHORS[+t.dataset.preset], l = LS.get('anchors', []); l.push(p); LS.set('anchors', l); toast('Dodano'); render(true); return; }
  if (t.dataset.delanchor) { LS.set('anchors', LS.get('anchors', []).filter(x => x.at + '|' + x.name !== t.dataset.delanchor)); render(true); return; }
  if (t.dataset.ask) { askCtx = ASKS.find(x => x.id === t.dataset.ask); render(true); $('#askpanel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
  if (t.dataset.pfind) { const s = pg(), m = PR.matches[s.step]; s.g[m.id] = { ...(s.g[m.id] || {}), [t.dataset.pfind]: true }; pgSave(s); confetti(); toast('GOOOL! ⚽'); render(true); return; }
  if (t.dataset.pq !== undefined) { const s = pg(), m = PR.matches[s.step], i = +t.dataset.pq;
    if (i === m.quiz.a) { s.g[m.id] = { ...(s.g[m.id] || {}), quiz: true }; pgSave(s); confetti(); toast('GOOOL! ⚽'); render(true); }
    else { document.querySelectorAll('.opt').forEach(o => o.classList.remove('no')); t.classList.add('no'); const fb = $('#pfb'); fb.textContent = m.quiz.no; fb.style.color = 'var(--red)'; }
    return; }
  if (t.dataset.fav) { const s = pg(); s.fav = t.dataset.fav; pgSave(s); if (s.pen) confetti(); render(true); return; }
  switch (a) {
    case 'wx': loadWeather(true); toast('Osvežujem vreme'); break;
    case 'tired': tired = !tired; LS.set('tired', tired); render(true); break;
    case 'iin': ideaIn = !ideaIn; render(true); break;
    case 'iopen': ideaOpen = !ideaOpen; render(true); break;
    case 'unskip': skip = { at: Date.now(), ids: [] }; LS.set('skip', skip); render(true); break;
    case 'mapme': followMe = true; if (gpsInMadrid() && watchId != null) { drawMe(true); break; } toast('Iščem lokacijo …'); startWatch(); setTimeout(() => { if (pos && !gpsInMadrid()) toast('Telefon ni v Madridu. Modra pika se pokaže, ko boste tam.'); }, 6000); break;
    case 'maphotel': map && map.setView(HOTEL.ll, 16); break;
    case 'toloc': $('#loc')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); break;
    case 'rest': LS.set('rest', !LS.get('rest', true)); render(true); break;
    case 'unskipday': LS.del('skipday'); render(true); break;
    case 'iqclear': ideaQ = ''; render(true); $('#iq')?.focus(); break;
    case 'ifreset': ideaFor = []; ideaCats = []; ideaArea = 'vse'; ideaIn = false; ideaOpen = false; render(true); break;
    case 'nextfact': factI++; render(true); break;
    case 'locate': toast('Iščem lokacijo …'); if (!(await getPos())) toast('Lokacije ni bilo mogoče dobiti. Preveri dovoljenje.'); else { LS.del('area'); if (!gpsInMadrid()) toast('Telefon ni v Madridu, izberi okolico'); } loadWeather(true); render(true); break;
    case 'askclose': askCtx = null; render(true); break;
    case 'copyprompt': copy(buildPrompt(askCtx.q)); break;
    case 'askmine': { const q = ($('#myq')?.value || '').trim(); if (!q) { toast('Najprej napiši vprašanje'); break; } askCtx = { id: 'mine', label: q, q }; render(true); $('#askpanel')?.scrollIntoView({ behavior: 'smooth' }); break; }
    case 'addanchor': { const n = ($('#an-name')?.value || '').trim(), at = $('#an-at')?.value, lead = +($('#an-lead')?.value || 60); if (!n || !at) { toast('Vpiši ime in uro'); break; } const l = LS.get('anchors', []); l.push({ name: n.slice(0, 60), at, lead }); LS.set('anchors', l); toast('Dodano'); render(true); break; }
    case 'undone': LS.del('done'); toast('Počiščeno'); render(true); break;
    case 'pstart': { const s = pg(); s.name = ($('#pname')?.value || '').trim().slice(0, 20); s.step = 0; pgSave(s); render(); window.scrollTo(0, 0); break; }
    case 'pnext': { const s = pg(); s.step = Math.min(s.step + 1, PR.matches.length); pgSave(s); render(); window.scrollTo(0, 0); break; }
    case 'pprev': { const s = pg(); s.step = Math.max(s.step - 1, 0); pgSave(s); render(); window.scrollTo(0, 0); break; }
    case 'ppen': { const s = pg(); s.pen = true; pgSave(s); confetti(); toast('GOOOL! ⚽'); render(true); break; }
    case 'preset': if (t.dataset.sure) { pgSave({ name: pg().name, step: -1, g: {}, fav: null, pen: false }); render(); } else { t.dataset.sure = 1; t.textContent = 'Res? Klikni še enkrat'; } break;
    case 'install': if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } break;
    case 'wipe': if (t.dataset.sure) { try { Object.keys(localStorage).filter(k => k.startsWith('nms.')).forEach(k => localStorage.removeItem(k)); } catch (e) {} pos = null; wx = null; wmode = 'auto'; tired = false; mood = 'vse'; budget = 120; skip = { at: Date.now(), ids: [] }; render(); toast('Izbrisano'); } else { t.dataset.sure = 1; t.textContent = 'Res izbrišem? Klikni še enkrat'; } break;
  }
});

if (['nacrt', 'blizu'].includes(location.hash.slice(1))) location.replace('#zdaj');
render();
loadWeather();
try { navigator.permissions.query({ name: 'geolocation' }).then(s => { if (s.state === 'granted') getPos().then(() => { if (gpsInMadrid()) { LS.del('area'); render(true); } }); }); } catch (e) {}
setInterval(() => { if (!document.hidden && view() === 'zdaj' && !document.activeElement?.matches('textarea,input')) render(true); }, 5 * 60000);
if ('serviceWorker' in navigator && location.hostname !== 'localhost') navigator.serviceWorker.register('sw.js').catch(() => {});
