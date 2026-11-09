'use strict';
const PLAN = window.PLAN, PR = window.PRADO;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem('nms.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('nms.' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('nms.' + k); } catch (e) {} }
};
const MADRID = [40.4168, -3.7038];
let pos = null, wx = LS.get('wx', null), rain = LS.get('rain', false), curDay = null, filter = 'vse', askCtx = null, deferredInstall = null;

/* ---------- helpers ---------- */
const WD = ['nedelja', 'ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota'];
const DAYMAP = { 5: 'pet', 6: 'sob', 0: 'ned', 1: 'pon' };
const inMadrid = () => (pos && dist([pos.lat, pos.lon], MADRID) < 60000) || LS.get('trip', false);
const tripDay = () => inMadrid() ? (DAYMAP[new Date().getDay()] || null) : null;
const hhmm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
function dist(a, b) { const R = 6371000, r = x => x * Math.PI / 180; const dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
const fmtDist = m => m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
const walkMin = m => Math.max(1, Math.round(m * 1.3 / 80));
const maps = (ll, name) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name ? name + ' Madrid' : ll.join(','));
function route(ll, mode) { if (!mode) mode = dist(pos ? [pos.lat, pos.lon] : MADRID, ll) > 2500 ? 'transit' : 'walking'; return 'https://www.google.com/maps/dir/?api=1&destination=' + ll.join(',') + '&travelmode=' + mode; }
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200); }
function copy(txt) {
  const ok = () => toast('Kopirano');
  const fb = () => { const a = document.createElement('textarea'); a.value = txt; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Kopiranje ni uspelo'); } a.remove(); };
  try { navigator.clipboard.writeText(txt).then(ok, fb); } catch (e) { fb(); }
}
function speak(txt) { try { const u = new SpeechSynthesisUtterance(txt); u.lang = 'es-ES'; u.rate = .9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { toast('Branje ni podprto'); } }
function getPos() {
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => { pos = { lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy), at: Date.now() }; if (dist([pos.lat, pos.lon], MADRID) < 60000) LS.set('trip', true); res(pos); },
      () => res(null), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}

/* ---------- weather ---------- */
const WMO = { 0: ['☀️', 'jasno'], 1: ['🌤️', 'pretežno jasno'], 2: ['⛅', 'delno oblačno'], 3: ['☁️', 'oblačno'], 45: ['🌫️', 'megla'], 48: ['🌫️', 'megla'], 51: ['🌦️', 'rosenje'], 53: ['🌦️', 'rosenje'], 55: ['🌧️', 'rosenje'], 61: ['🌧️', 'rahel dež'], 63: ['🌧️', 'dež'], 65: ['🌧️', 'močan dež'], 80: ['🌦️', 'plohe'], 81: ['🌧️', 'plohe'], 82: ['⛈️', 'močne plohe'], 95: ['⛈️', 'nevihta'], 96: ['⛈️', 'nevihta'] };
const wmo = c => WMO[c] || ['🌡️', 'spremenljivo'];
async function loadWeather(force) {
  if (!force && wx && Date.now() - wx.at < 30 * 60000) return;
  const c = pos && dist([pos.lat, pos.lon], MADRID) < 60000 ? [pos.lat, pos.lon] : MADRID;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${c[0].toFixed(3)}&longitude=${c[1].toFixed(3)}&current=temperature_2m,apparent_temperature,weather_code&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunset&timezone=Europe%2FMadrid&forecast_days=5`;
  try { const r = await fetch(url); if (!r.ok) throw 0; wx = { at: Date.now(), d: await r.json() }; LS.set('wx', wx); render(); } catch (e) {}
}
function wxNext(n) {
  if (!wx) return [];
  const h = wx.d.hourly, now = Date.now(), out = [];
  for (let i = 0; i < h.time.length && out.length < n; i++) { const t = new Date(h.time[i]); if (t.getTime() + 3600000 > now) out.push({ t, temp: h.temperature_2m[i], pop: h.precipitation_probability[i], code: h.weather_code[i] }); }
  return out;
}
function wxCard() {
  if (!wx) return `<div class="card"><div class="body"><span class="eyebrow">Vreme</span><p style="margin:6px 0 0">Napoved se naloži ob prvi povezavi. <a href="https://www.aemet.es/en/eltiempo/prediccion/municipios/madrid-id28079" target="_blank" rel="noopener">AEMET</a></p></div></div>`;
  const c = wx.d.current, [ic, txt] = wmo(c.weather_code), hrs = wxNext(12), dl = wx.d.daily;
  const age = Math.round((Date.now() - wx.at) / 60000);
  return `<div class="card"><div class="body">
    <div class="kick"><span class="eyebrow">Vreme v Madridu</span><button class="tag" data-act="wx">osveži · ${age < 2 ? 'zdaj' : 'pred ' + (age < 60 ? age + ' min' : Math.round(age / 60) + ' h')}</button></div>
    <div class="wx"><div class="ic">${ic}</div><div class="t num">${Math.round(c.temperature_2m)}°</div><div class="d">${txt} · občutek ${Math.round(c.apparent_temperature)}° · sonce zaide ${dl.sunset[0].slice(11)}</div></div>
    <div class="hours">${hrs.map(h => `<div class="h ${h.pop >= 40 ? 'wet' : ''}"><span>${String(h.t.getHours()).padStart(2, '0')}h</span><b>${wmo(h.code)[0]}</b><span class="num">${Math.round(h.temp)}°</span><span class="num">${h.pop}%</span></div>`).join('')}</div>
    <div class="days">${dl.time.slice(0, 4).map((t, i) => `<div class="dd"><b>${WD[new Date(t + 'T12:00').getDay()].slice(0, 3)}</b>${wmo(dl.weather_code[i])[0]} <span class="num">${Math.round(dl.temperature_2m_min[i])}–${Math.round(dl.temperature_2m_max[i])}°</span><br><span class="num">dež ${dl.precipitation_probability_max[i]}%</span></div>`).join('')}</div>
  </div></div>`;
}
function rainSoon() { const n = wxNext(6).filter(h => h.pop >= 50); return n.length ? n[0] : null; }

/* ---------- places ---------- */
const EXTRA = [
  { name: 'La Campana', ll: [40.4148, -3.7068], cat: ['hrana'], what: 'Sendvič z ocvrtimi lignji, hitro in poceni.' },
  { name: 'Mercado de San Miguel', ll: [40.4154, -3.7090], cat: ['hrana', 'streha'], what: 'Tržnica s stojnicami, vsak izbere svoje.' },
  { name: 'Chocolatería San Ginés', ll: [40.4170, -3.7068], cat: ['hrana', 'streha'], what: 'Churrosi s čokolado, odprto 24 ur.' },
  { name: 'Mercado de San Ildefonso', ll: [40.4245, -3.7017], cat: ['hrana', 'streha'], what: 'Street food v treh nadstropjih, od 13.00.' },
  { name: 'Bernabéu Market', ll: [40.4527, -3.6870], cat: ['hrana', 'streha', 'nogomet'], what: '20 mikro-restavracij v stadionu, vhod Puerta 54.' },
  { name: 'GLU sladoled', ll: [40.4282, -3.7046], cat: ['hrana'], what: 'Sladoledarna kot ledena jama.' },
  { name: 'Templo de Debod', ll: [40.4240, -3.7177], cat: ['ogled'], what: 'Pravi egipčanski tempelj v parku, brezplačno; lep razgled ob sončnem zahodu.' },
  { name: 'Palacio Real in Plaza de Oriente', ll: [40.4180, -3.7143], cat: ['ogled'], what: 'Kraljeva palača in park s kipi kraljev.' }
];
function places() {
  const out = [], seen = new Set();
  PLAN.days.forEach(d => d.stops.forEach(s => {
    const key = s.ll && s.ll.join(',');
    if (!s.ll || seen.has(key) || /kosilo|večerja|hitri grižljaji|prevoz|vhod/i.test(s.kicker || '')) return; seen.add(key); seen.add(s.title);
    const t = (s.title + ' ' + s.kicker + ' ' + s.desc).toLowerCase();
    const cat = ['ogled'];
    if (/kosilo|večerj|hrana|sladk|churros|sladoled|tržnic|market/.test(t)) cat.push('hrana');
    if (/bernabéu|metropolitano|legends|real madrid|cibeles|neptun|tekma/.test(t)) cat.push('nogomet');
    if (/prado|legends|muzej|market|trgovin|store|fnac|miniso|wow|san ginés|tržnic/.test(t)) cat.push('streha');
    out.push({ name: s.title, ll: s.ll, cat, what: s.desc.replace(/<[^>]+>/g, '').split('. ')[0] + '.' });
  }));
  EXTRA.forEach(e => { if (!seen.has(e.name) && !seen.has(e.ll.join(','))) out.push(e); });
  return out;
}

/* ---------- AI prompts ---------- */
const ASKS = [
  { id: 'hrana', ic: '🍽️', label: 'Kje jemo zdaj?', q: 'Kje lahko zdaj blizu dobro in hitro jemo, sede?' },
  { id: 'tu', ic: '🔎', label: 'Kaj je tukaj?', q: 'Kaj je tukaj okoli zanimivega? Povej zgodbo kraja, kakšno nogometno zanimivost, če obstaja, in kaj bi bilo otroku zabavno pogledati v 10 minutah hoje.' },
  { id: 'dez', ic: '☔', label: 'Dežuje, kam?', q: 'Dežuje. Kam lahko blizu gremo pod streho za uro ali dve, da bo otroku zanimivo?' },
  { id: 'sladko', ic: '🍦', label: 'Nekaj sladkega', q: 'Kje je blizu dober sladoled, churrosi ali slaščičarna?' },
  { id: 'wc', ic: '🚻', label: 'Stranišče', q: 'Kje je najbližje javno stranišče ali lokal/trgovski center, kjer lahko uporabimo stranišče?' },
  { id: 'lekarna', ic: '💊', label: 'Lekarna', q: 'Kje je najbližja odprta lekarna (tudi dežurna)?' }
];
function buildPrompt(q) {
  const now = new Date();
  const where = pos ? `Sem v Madridu, na lokaciji ${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)} (natančnost okoli ${pos.acc} m, Google Maps: https://maps.google.com/?q=${pos.lat.toFixed(5)},${pos.lon.toFixed(5)}).` : 'Sem v centru Madrida (lokacija ni znana).';
  const w = wx ? ` Vreme zdaj: ${Math.round(wx.d.current.temperature_2m)} °C, ${wmo(wx.d.current.weather_code)[1]}.` : '';
  return `${where} Ura je ${hhmm(now)}, dan je ${WD[now.getDay()]}.${w}
Smo družina: dva odrasla in 7-letni otrok. Otrok ne mara dolge hoje, obožuje nogomet (navija za Barcelono in Lamineja Yamala) in ima rad preprosto hrano (pica, burger, testenine, sladice). En odrasel ne je mesa, je pa ribe in morske sadeže. Ne maramo pekoče hrane.

${q}

Odgovori v slovenščini in kratko: 3–5 konkretnih predlogov, največ 10 minut hoje, za vsakega ime, zakaj je dober za nas, ali je zdaj odprto in povezavo na Google Maps. Če česa ne veš zanesljivo, to povej.`;
}
function askPanel() {
  if (!askCtx) return '';
  const p = buildPrompt(askCtx.q);
  return `<div class="card" id="askpanel"><div class="body">
    <div class="kick"><span class="eyebrow">Vprašaj AI</span><button class="tag" data-act="askclose">zapri</button></div>
    <p style="margin:4px 0 0;font-weight:800">${esc(askCtx.label || 'Tvoje vprašanje')}</p>
    <p style="margin:4px 0 0;font-size:13px;color:var(--muted)">${pos ? 'Lokacija je dodana (' + pos.acc + ' m).' : 'Lokacije ni; dodaj jo za boljše predloge.'} Vprašanje se pošlje v izbrano aplikacijo.</p>
    <div class="actions">
      <a class="btn green" target="_blank" rel="noopener" href="https://chatgpt.com/?q=${encodeURIComponent(p)}">ChatGPT</a>
      <a class="btn primary" target="_blank" rel="noopener" href="https://claude.ai/new?q=${encodeURIComponent(p)}">Claude</a>
      <button class="btn" data-act="copyprompt">Kopiraj</button>
      ${pos ? '' : '<button class="btn" data-act="askloc">📍 Dodaj lokacijo</button>'}
    </div>
    <details class="sec"><summary>Kaj se pošlje</summary><pre style="white-space:pre-wrap;font:13px/1.45 var(--body);margin:8px 0 0">${esc(p)}</pre></details>
  </div></div>`;
}
function askGrid() {
  return `<div class="grid2">${ASKS.map(a => `<button class="ask" data-ask="${a.id}"><span>${a.ic}</span>${esc(a.label)}</button>`).join('')}</div>${askPanel()}`;
}

/* ---------- stop card ---------- */
function stopCard(s, opts = {}) {
  const chosen = (LS.get('choice', [])).includes(s.id);
  return `<article class="stop"><div class="when"><b class="num">${esc(s.time)}</b><span>${s.dur ? s.dur + ' min' : ''}</span></div>
  <div class="card ${opts.now ? 'now' : ''} ${s.hl ? 'hl' : ''} ${s.optional || s.group ? 'opt' : ''}">
    ${s.img ? `<figure><img src="${s.img.src}" alt="" loading="lazy"><figcaption>${esc(s.img.credit)}</figcaption></figure>` : ''}
    <div class="body">
      <div class="kick"><span class="eyebrow">${esc(s.kicker || '')}</span>${opts.now ? '<span class="tag green">zdaj</span>' : opts.next ? '<span class="tag gold">naslednje</span>' : ''}${s.optional ? '<span class="tag">izbirno</span>' : ''}${s.group ? `<button class="tag ${chosen ? 'gold' : ''}" data-pick="${s.id}">${chosen ? 'izbrano ✔' : 'izberi'}</button>` : ''}</div>
      <h3>${esc(s.title)}</h3>
      <p class="desc">${s.desc || ''}</p>
      <div class="meta">${s.walk ? `<span>🚶 ${esc(s.walk)}</span>` : ''}${s.cost ? `<span>💶 ${esc(s.cost)}</span>` : ''}${s.hours ? `<span>🕒 ${esc(s.hours)}</span>` : ''}${s.ll && pos ? `<span>📍 ${fmtDist(dist([pos.lat, pos.lon], s.ll))}</span>` : ''}</div>
      ${s.warn ? `<div class="notice warn" style="margin-top:10px"><span>⚠️</span><div>${s.warn}</div></div>` : ''}
      ${rain && s.rain ? `<div class="rainbox"><b>Če dežuje:</b> ${s.rain}</div>` : ''}
      <div class="actions">
        ${s.ll ? `<a class="btn primary" target="_blank" rel="noopener" href="${route(s.ll)}">🧭 Pot sem</a>` : ''}
        ${s.maps ? `<a class="btn" target="_blank" rel="noopener" href="${s.maps}">📍 Zemljevid</a>` : ''}
        ${(s.links || []).map(l => `<a class="btn ${l.kind === 'ticket' ? 'red' : ''}" target="_blank" rel="noopener" href="${l.url}">${l.kind === 'ticket' ? '🎟️' : '🔗'} ${esc(l.label)}</a>`).join('')}
        ${s.id === 'sob-prado' ? '<a class="btn gold" href="#prado">🕵️ Igra v Pradu</a>' : ''}
      </div>
      ${s.facts && s.facts.length ? `<details class="sec"><summary>Zanimivosti${s.facts.some(f => f.fb) ? ' · ⚽' : ''}</summary><ul class="facts">${s.facts.map(f => `<li class="${f.fb ? 'fb' : ''}">${f.t}${f.src ? ` <a href="${f.src}" target="_blank" rel="noopener">vir ↗</a>` : ''}</li>`).join('')}</ul></details>` : ''}
      ${s.food && s.food.length ? `<details class="sec"><summary>Hrana tukaj</summary><div class="food">${s.food.map(f => `<div class="f"><b>${esc(f.name)}</b>${f.price ? ` <span style="color:var(--muted);font-size:13px">· ${esc(f.price)}</span>` : ''}<div>${f.what || ''}${f.maps ? ` · <a href="${f.maps}" target="_blank" rel="noopener">zemljevid</a>` : ''}</div><div class="who">${f.nomeat ? `<span class="nm">brez mesa: ${esc(f.nomeat)}</span>` : ''}${f.kid ? `<span class="kd">otrok: ${esc(f.kid)}</span>` : ''}${f.note ? `<span>${esc(f.note)}</span>` : ''}</div></div>`).join('')}</div></details>` : ''}
      ${!rain && s.rain ? `<details class="sec"><summary>Če dežuje</summary><div class="rainbox">${s.rain}</div></details>` : ''}
      ${s.practical ? `<details class="sec"><summary>Praktično</summary><ul class="facts">${s.practical.map(p => `<li>${p}</li>`).join('')}</ul></details>` : ''}
    </div></div></article>`;
}
function nowNext(day) {
  const m = new Date().getHours() * 60 + new Date().getMinutes(); let now = null, next = null;
  day.stops.forEach(s => { if (s.group) return; const st = toMin(s.time), en = st + (s.dur || 30); if (st <= m && m < en) now = s; if (st > m && !next) next = s; });
  return { now, next };
}

/* ---------- views ---------- */
function vDanes() {
  const td = tripDay(), day = PLAN.days.find(d => d.id === (td || 'pet'));
  const { now, next } = td ? nowNext(day) : { now: null, next: null };
  const r = rainSoon(), base = LS.get('base', null);
  return `<section class="page wrap">
    <div class="hero"><img src="img/hero.jpg" alt=""><div class="in"><span class="eyebrow">${td ? WD[new Date().getDay()] + ' v Madridu' : 'Pred odhodom · predogled prvega dne'}</span><h1>${esc(day.title)}</h1><p>${esc(day.teaser)}</p></div></div>
    ${r ? `<div class="notice"><span>🌧️</span><div><b>Dež okoli ${String(r.t.getHours()).padStart(2, '0')}h (${r.pop}%).</b> <button class="tag" data-act="rainon">pokaži deževne zamenjave</button></div></div>` : ''}
    ${wxCard()}
    ${td ? (now ? stopCard(now, { now: true }) : '') + (next ? stopCard(next, { next: true }) : '') + (!now && !next ? '<div class="notice ok"><span>🌙</span><div>Za danes je načrt končan.</div></div>' : '') : `<div class="notice ok"><span>🗓️</span><div>Ko ste v Madridu, se tu pokaže, kaj je zdaj in kaj sledi. Vklopi se samo, ko lokacija pokaže Madrid, ali z gumbom. <div class="actions"><button class="btn green" data-act="tripon">Smo v Madridu</button></div></div></div>`}
    <div class="card"><div class="body"><span class="eyebrow">Naša baza</span>
      ${base ? `<p style="margin:6px 0 0">Shranjena na tem telefonu${base.label ? ': ' + esc(base.label) : ''}.</p><div class="actions"><a class="btn primary" target="_blank" rel="noopener" href="${route([base.lat, base.lon], 'transit')}">🏠 Pot v bazo</a><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${base.lat},${base.lon}&travelmode=driving">🚕 S taksijem</a></div>` : `<p style="margin:6px 0 0">Ko prvič pridete do nastanitve, jo shrani. Ostane samo v tem telefonu, nikjer drugje.</p><div class="actions"><button class="btn primary" data-act="savebase">📍 Shrani, kjer sem zdaj</button></div>`}
    </div></div>
    <div><span class="eyebrow">Vprašaj ChatGPT ali Claude za tukaj in zdaj</span></div>
    ${askGrid()}
  </section>`;
}
function vNacrt() {
  if (!curDay) curDay = tripDay() || 'pet';
  const d = PLAN.days.find(x => x.id === curDay), td = tripDay() === curDay ? nowNext(d) : {};
  const groups = new Set(); let tl = '';
  d.stops.forEach(s => {
    if (s.group) { if (groups.has(s.group)) return; groups.add(s.group); const g = PLAN.groups[s.group], items = d.stops.filter(x => x.group === s.group);
      tl += `<div style="margin-top:6px"><span class="eyebrow">Izberite ${g.max} od ${items.length}</span><h3 style="font-size:19px;margin-top:4px">${esc(g.title)}</h3></div>` + items.map(x => stopCard(x)).join(''); return; }
    tl += stopCard(s, { now: td.now === s, next: td.next === s });
  });
  return `<section class="page wrap">
    <div class="daytabs">${PLAN.days.map(x => `<button class="daytab ${x.id === curDay ? 'on' : ''}" data-day="${x.id}"><b>${esc(x.label)}</b><span>${esc(x.short)}</span></button>`).join('')}</div>
    <div><span class="eyebrow">${esc(d.label)}</span><h2 style="font-size:30px;margin-top:4px">${esc(d.title)}</h2><p style="margin:6px 0 0;color:var(--muted)">${esc(d.sub)}</p></div>
    ${(d.alerts || []).map(a => `<div class="notice warn"><span>⚠️</span><div>${a}</div></div>`).join('')}
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button class="toggle" data-act="rain" aria-pressed="${rain}"><span>Deževni plan</span><span class="sw"></span></button><span style="font-size:13px;color:var(--muted)">Hoja: ${esc(d.walk)}</span></div>
    <div class="tl">${tl}</div>
    ${d.tips && d.tips.length ? `<div class="card"><div class="body"><span class="eyebrow">Ne pozabi</span><ul class="facts">${d.tips.map(t => `<li>${t}</li>`).join('')}</ul></div></div>` : ''}
  </section>`;
}
function vBlizu() {
  const here = pos ? [pos.lat, pos.lon] : null;
  let list = places().filter(p => filter === 'vse' || p.cat.includes(filter));
  if (here) list = list.map(p => ({ ...p, d: dist(here, p.ll) })).sort((a, b) => a.d - b.d);
  return `<section class="page wrap">
    <div class="card"><div class="body"><span class="eyebrow">Kje sem</span>
      <p style="margin:6px 0 0">${here ? `Lokacija najdena, natančnost ${pos.acc} m.` : 'Pritisni gumb, telefon te bo vprašal za dovoljenje. Lokacija ostane v telefonu.'}</p>
      <div class="actions"><button class="btn primary" data-act="locate">📍 ${here ? 'Osveži lokacijo' : 'Poišči, kje sem'}</button>${here ? `<a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${pos.lat},${pos.lon}">Odpri v Zemljevidih</a><button class="btn" data-act="savebase">🏠 To je naša baza</button>` : ''}</div>
    </div></div>
    <div><span class="eyebrow">Vprašaj za tukaj in zdaj</span></div>
    ${askGrid()}
    <div class="card"><div class="body"><span class="eyebrow">Svoje vprašanje</span>
      <textarea id="myq" rows="3" placeholder="Npr. Smo pri Kraljevi palači, kaj je tu za otroka do 17.00?"></textarea>
      <div class="actions"><button class="btn primary" data-act="askmine">Pripravi vprašanje</button></div>
    </div></div>
    <div><span class="eyebrow">Naša izbrana mesta${here ? ', po oddaljenosti' : ''}</span></div>
    <div class="chips">${[['vse', 'Vse'], ['hrana', 'Hrana'], ['ogled', 'Ogledi'], ['nogomet', 'Nogomet'], ['streha', 'Pod streho']].map(([k, l]) => `<button class="chip ${filter === k ? 'on' : ''}" data-filter="${k}">${l}</button>`).join('')}</div>
    <div style="display:flex;flex-direction:column;gap:8px">${list.map(p => `<div class="place"><div><b>${esc(p.name)}</b><br><small>${esc(p.what)}</small><div class="actions" style="margin-top:6px"><a class="btn" style="min-height:36px;padding:6px 10px" target="_blank" rel="noopener" href="${route(p.ll)}">🧭 Pot</a><a class="btn" style="min-height:36px;padding:6px 10px" target="_blank" rel="noopener" href="${maps(p.ll, p.name)}">📍 Zemljevid</a></div></div><div class="km">${p.d != null ? fmtDist(p.d) + `<br><small>${walkMin(p.d)} min peš</small>` : ''}</div></div>`).join('')}</div>
    <p style="font-size:12px;color:var(--muted)">Razdalje so zračne, prava pot je daljša.</p>
  </section>`;
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
function vVec() {
  return `<section class="page wrap">
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
    <div class="card"><div class="body"><span class="eyebrow">Vstopnice in strani</span><div class="actions">
      <a class="btn red" target="_blank" rel="noopener" href="https://feverup.com/m/776682">🎟️ Bernabéu Skywalk</a><a class="btn red" target="_blank" rel="noopener" href="https://feverup.com/m/600820">🎟️ LEGENDS</a>
      <a class="btn red" target="_blank" rel="noopener" href="https://entradas.museodelprado.es/">🎟️ Prado</a><a class="btn red" target="_blank" rel="noopener" href="https://museumofillusions.es/entradas/">🎟️ Muzej iluzij</a>
      <a class="btn" target="_blank" rel="noopener" href="https://play.google.com/store/apps/details?id=es.rfef.entradas">RFEF Tickets</a><a class="btn" target="_blank" rel="noopener" href="https://www.aemet.es/en/eltiempo/prediccion/municipios/madrid-id28079">AEMET vreme</a><a class="btn" target="_blank" rel="noopener" href="https://www.esmadrid.com/en">esmadrid.com</a></div></div></div>
    <div class="card"><div class="body"><span class="eyebrow">Namesti na telefon</span>
      <p style="margin:6px 0 0">Android, Chrome: meni ⋮ → <b>Namesti aplikacijo</b> ali <b>Dodaj na začetni zaslon</b>. iPhone, Safari: Deli → <b>Dodaj na začetni zaslon</b>. Po prvem odprtju dela tudi brez povezave, razen vremena in AI.</p>
      ${deferredInstall ? '<div class="actions"><button class="btn primary" data-act="install">Namesti zdaj</button></div>' : ''}</div></div>
    <div class="card"><div class="body"><span class="eyebrow">Zasebnost</span>
      <p style="margin:6px 0 0">To je javna stran brez osebnih podatkov: brez imen, nastanitve, letov in vstopnic. Baza, napredek igre, ime v igri in izbire ostanejo samo v tem telefonu. Lokacija se pošlje le Open-Meteu (za vreme, zaokrožena) ter ChatGPT ali Claudu, ko sam pritisneš gumb.</p>
      <div class="actions">${LS.get('trip', false) ? '<button class="btn" data-act="tripoff">Izklopi dnevni način</button>' : ''}<button class="btn" data-act="wipe">Izbriši vse podatke s tega telefona</button></div></div></div>
  </section>`;
}

/* ---------- render & events ---------- */
const VIEWS = { danes: vDanes, nacrt: vNacrt, blizu: vBlizu, prado: vPrado, vec: vVec };
function view() { const h = location.hash.slice(1); return VIEWS[h] ? h : 'danes'; }
function render(keepScroll) {
  const v = view(), y = window.scrollY;
  $('#app').innerHTML = VIEWS[v]();
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  $('#net').innerHTML = navigator.onLine ? '<span class="dot"></span> povezano' : '<span class="dot off"></span> brez povezave';
  if (keepScroll) window.scrollTo(0, y);
}
window.addEventListener('hashchange', () => { askCtx = null; render(); window.scrollTo(0, 0); });
window.addEventListener('online', () => { render(true); loadWeather(); });
window.addEventListener('offline', () => render(true));
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (view() === 'vec') render(true); });
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c); const x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
  const cols = ['#B5202D', '#D29B13', '#1F5E4D', '#2E6D9B', '#ffffff'];
  const ps = Array.from({ length: 90 }, () => ({ x: innerWidth / 2, y: innerHeight * .4, vx: (Math.random() - .5) * 14, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 3, c: cols[Math.random() * 5 | 0], a: Math.random() * 6 }));
  let t = 0; (function f() { x.clearRect(0, 0, c.width, c.height); ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .35; p.a += .1; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6); x.restore(); }); if (++t < 80) requestAnimationFrame(f); else c.remove(); })();
}
document.addEventListener('click', async ev => {
  const t = ev.target.closest('button'); if (!t) return;
  const a = t.dataset.act;
  if (t.dataset.day) { curDay = t.dataset.day; render(); window.scrollTo(0, 0); return; }
  if (t.dataset.filter) { filter = t.dataset.filter; render(true); return; }
  if (t.dataset.say) { speak(t.dataset.say); return; }
  if (t.dataset.copy) { copy(t.dataset.copy); return; }
  if (t.dataset.pick) { const c = LS.get('choice', []), i = c.indexOf(t.dataset.pick); if (i >= 0) c.splice(i, 1); else { c.push(t.dataset.pick); if (c.length > 2) c.shift(); } LS.set('choice', c); render(true); return; }
  if (t.dataset.ask) { askCtx = ASKS.find(x => x.id === t.dataset.ask); if (!pos) { toast('Iščem lokacijo …'); await getPos(); } render(true); $('#askpanel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
  if (t.dataset.pfind) { const s = pg(), m = PR.matches[s.step]; s.g[m.id] = { ...(s.g[m.id] || {}), [t.dataset.pfind]: true }; pgSave(s); confetti(); toast('GOOOL! ⚽'); render(true); return; }
  if (t.dataset.pq !== undefined) { const s = pg(), m = PR.matches[s.step], i = +t.dataset.pq;
    if (i === m.quiz.a) { s.g[m.id] = { ...(s.g[m.id] || {}), quiz: true }; pgSave(s); confetti(); toast('GOOOL! ⚽'); render(true); }
    else { document.querySelectorAll('.opt').forEach(o => o.classList.remove('no')); t.classList.add('no'); const fb = $('#pfb'); fb.textContent = m.quiz.no; fb.style.color = 'var(--red)'; }
    return; }
  if (t.dataset.fav) { const s = pg(); s.fav = t.dataset.fav; pgSave(s); if (s.pen) confetti(); render(true); return; }
  switch (a) {
    case 'wx': await getPos(); loadWeather(true); toast('Osvežujem vreme'); break;
    case 'tripon': LS.set('trip', true); render(); break;
    case 'tripoff': LS.set('trip', false); render(); break;
    case 'rain': rain = !rain; LS.set('rain', rain); render(true); break;
    case 'rainon': rain = true; LS.set('rain', true); location.hash = '#nacrt'; break;
    case 'locate': toast('Iščem lokacijo …'); if (!(await getPos())) toast('Lokacije ni bilo mogoče dobiti. Preveri dovoljenje.'); loadWeather(); render(true); break;
    case 'savebase': if (!pos) await getPos(); if (!pos) { toast('Lokacije ni bilo mogoče dobiti'); break; } LS.set('base', { lat: +pos.lat.toFixed(5), lon: +pos.lon.toFixed(5), label: '' }); toast('Baza shranjena v telefonu'); render(true); break;
    case 'askclose': askCtx = null; render(true); break;
    case 'askloc': await getPos(); render(true); break;
    case 'copyprompt': copy(buildPrompt(askCtx.q)); break;
    case 'askmine': { const q = ($('#myq')?.value || '').trim(); if (!q) { toast('Najprej napiši vprašanje'); break; } askCtx = { id: 'mine', label: q, q }; if (!pos) await getPos(); render(true); $('#askpanel')?.scrollIntoView({ behavior: 'smooth' }); break; }
    case 'pstart': { const s = pg(); s.name = ($('#pname')?.value || '').trim().slice(0, 20); s.step = 0; pgSave(s); render(); window.scrollTo(0, 0); break; }
    case 'pnext': { const s = pg(); s.step = Math.min(s.step + 1, PR.matches.length); pgSave(s); render(); window.scrollTo(0, 0); break; }
    case 'pprev': { const s = pg(); s.step = Math.max(s.step - 1, 0); pgSave(s); render(); window.scrollTo(0, 0); break; }
    case 'ppen': { const s = pg(); s.pen = true; pgSave(s); confetti(); toast('GOOOL! ⚽'); render(true); break; }
    case 'preset': if (t.dataset.sure) { pgSave({ name: pg().name, step: -1, g: {}, fav: null, pen: false }); render(); } else { t.dataset.sure = 1; t.textContent = 'Res? Klikni še enkrat'; } break;
    case 'install': if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } break;
    case 'wipe': if (t.dataset.sure) { try { Object.keys(localStorage).filter(k => k.startsWith('nms.')).forEach(k => localStorage.removeItem(k)); } catch (e) {} pos = null; wx = null; rain = false; render(); toast('Izbrisano'); } else { t.dataset.sure = 1; t.textContent = 'Res izbrišem? Klikni še enkrat'; } break;
  }
});

render();
loadWeather();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
