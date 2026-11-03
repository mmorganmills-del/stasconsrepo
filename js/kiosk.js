/* Stasukelis Consumer Reports: in-store iPad kiosk (landscape). Vanilla JS, no libraries, no outside requests.
   Everything (brands, colors, categories, scores, reports, Most Popular picks) comes from data/site-data.json.
   Started from design/source/kiosk.js (Creaition Design); made interactive. Scores are numbers only (no word bands). */
(function () {
'use strict';
const Q = new URLSearchParams(location.search);
// Mockup/test-only URL params (?tab= &sort= &menu=1 ?only= ?stress= ?wallt= ?still=1 ?noshuffle=1) work only on a local preview host, never on the kiosk.
const DEV = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
const QD = k => DEV ? Q.get(k) : null;
const TS = Math.max(0.01, parseFloat(QD('slowmo') || '1'));          // dev only: ?slowmo=20 slows every motion 20x
const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => RM.matches;
const app = document.getElementById('app'), sr = document.getElementById('sr');
let D = null;

/* ---------- copy (verbatim from copy/) ---------- */
const T = {
  disclosure: 'Stasukelis Appliance sells many of the brands shown here. Scores reflect our own experience and verified customer feedback.',
  disclaimerShort: 'A Stasukelis Appliance store guide. Not affiliated with Consumer Reports, Inc.',
  disclaimerFull: 'Stasukelis Consumer Reports is a Stasukelis Appliance store guide. It is not affiliated with Consumer Reports, Inc.',
  helper: "Tap a brand to see why it's ranked there.",
  sampleBanner: '<b>SAMPLE SCORES.</b> These are made-up numbers to show how the guide works. Real scores are coming soon.',
  naLegend: 'N/A: no rebate offered. Rebate not counted, so 60 points possible.',
  sampleVO: 'Sample score, not a real result.',
  popSub: 'Picked by our team from what sells and what customers tell us.',
  popSample: "<b>SAMPLE PICKS.</b> These show how our team's picks will look. Real picks are coming soon."
};
const ph = (t, cls = '') => `<span class="ph ${cls}" data-ph="${esc(t)}">Pending: ${t}</span>`;   // v2: quiet inline token (dotted underline), not a dashed box
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- icons (line icons, currentColor) ---------- */
const I = {
  overall:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h11M4 18h6"/></svg>',
  laundry:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2.5" width="16" height="19" rx="3"/><circle cx="12" cy="13.5" r="4.5"/><path d="M7.5 6h2" stroke-linecap="round"/></svg>',
  refrigeration:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2.5" width="14" height="19" rx="3"/><path d="M5 10h14M8.5 5.5v2M8.5 13v3" stroke-linecap="round"/></svg>',
  dishwasher:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2.5" width="16" height="19" rx="3"/><path d="M4 7.5h16M8 12.5h8M8 16.5h8" stroke-linecap="round"/></svg>',
  range:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2.5" width="16" height="19" rx="3"/><circle cx="9" cy="7" r="1.6"/><circle cx="15" cy="7" r="1.6"/><rect x="7.5" y="12" width="9" height="6" rx="1.5"/></svg>',
  microwave:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2.5" y="5" width="19" height="14" rx="3"/><rect x="5.5" y="8" width="10" height="8" rx="1.5"/><path d="M18.5 9v.5M18.5 12.5v.5" stroke-linecap="round"/></svg>',
  hood:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M9.5 2.5h5v6l6 6.5h-17l6-6.5z"/><path d="M3.5 18.5h17" stroke-linecap="round"/></svg>',
  generic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5" stroke-linecap="round"/></svg>',
  hand:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V5a1.8 1.8 0 0 1 3.6 0v5.5"/><path d="M12.6 10V8.6a1.8 1.8 0 0 1 3.6 0V11"/><path d="M16.2 10.5a1.8 1.8 0 0 1 3.3 1V15a7 7 0 0 1-7 7h-.6a7 7 0 0 1-5.6-2.8L3.5 15.6a1.8 1.8 0 0 1 2.8-2.2L9 15.5"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};
const icon = id => I[id] || I.generic;

/* ---------- math (CLIENT.md Scoring + Decisions): earned / possible x 100, round half up ---------- */
const halfUp = (e, p) => Math.floor((200 * e + p) / (2 * p));
const brandById = id => D.brands.find(b => b.id === id);
const catById = id => D.categories.find(c => c.id === id);
const sectionById = id => D.sections.find(s => s.id === id);
function cell(brand, cat) {
  const rec = brand.scores && brand.scores[cat]; if (!rec || !brand.categories.includes(cat)) return null;
  const secs = D.sections.map(s => Object.assign({}, s, rec[s.id] || {pending: true}));
  const pending = secs.filter(s => s.pending || (!s.na && typeof s.score !== 'number'));
  if (pending.length) return {brand, cat, secs, pending: pending.map(s => s.label)};
  const scored = secs.filter(s => !s.na);
  const e = scored.reduce((a, s) => a + s.score, 0), p = (D.settings.maxSectionScore || 10) * scored.length;
  return {brand, cat, secs, e, p, score: halfUp(e, p), na: secs.some(s => s.na)};
}
function overall(brand) {
  let e = 0, p = 0; const parts = [];
  for (const c of brand.categories) { const r = cell(brand, c); if (r && !r.pending) { e += r.e; p += r.p; parts.push(r); } }
  return {brand, cat: 'overall', e, p, n: parts.length, parts, score: parts.length ? halfUp(e, p) : null};
}
/* section value for sorting: category = that section /10; overall = average across rated categories (1 decimal) */
function sectionValue(r, sid) {
  if (r.cat !== 'overall') { const s = r.secs.find(x => x.id === sid); return s.na ? null : s.score; }
  const v = r.parts.map(pp => pp.secs.find(x => x.id === sid)).filter(s => !s.na);
  if (!v.length) return null;
  return Math.round(v.reduce((a, s) => a + s.score, 0) / v.length * 10) / 10;
}
function board(cat, sort) {
  const rated = [], pending = [];
  for (const b of D.brands) {
    if (cat === 'overall') { const o = overall(b); if (o.n) rated.push(o); continue; }
    if (!b.categories.includes(cat)) continue;
    const r = cell(b, cat); if (!r) continue; (r.pending ? pending : rated).push(r);
  }
  const key = r => sort && sort !== 'total' ? sectionValue(r, sort) : r.score;
  rated.forEach(r => { r.key = key(r); });
  const ranked = rated.filter(r => r.key != null), unranked = rated.filter(r => r.key == null);
  const cmp = (a, b) => (b.key - a.key) || a.brand.name.localeCompare(b.brand.name);
  ranked.sort(cmp); unranked.sort((a, b) => a.brand.name.localeCompare(b.brand.name));
  ranked.forEach(r => { r.rank = 1 + ranked.filter(x => x.key > r.key).length; r.tie = ranked.filter(x => x.key === r.key).length > 1; });
  unranked.forEach(r => { r.rank = null; r.tie = false; });
  pending.sort((a, b) => a.brand.name.localeCompare(b.brand.name));
  return {rated: ranked.concat(unranked), pending};
}
const ctxLabel = cat => cat === 'overall' ? 'Overall' : catById(cat).label;
const ctxLower = cat => cat === 'overall' ? 'across all categories' : catById(cat).label.toLowerCase();

/* ---------- placeholder logos: brand-name text in the brand color (real logos pending permission) ---------- */
function lum(hex) { const c = hex.replace('#', '').match(/../g).map(h => { const v = parseInt(h, 16) / 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
const contrastOnCard = hex => (lum('#FAF8F4') + .05) / (lum(hex) + .05);
const realLogo = b => b.logo && b.logo.file ? `<img class="rlogo" src="${esc((D.logoFolder || 'assets/logos/') + b.logo.file)}" alt="" draggable="false" decoding="async">` : '';
function phLogo(b, boxW, maxPx) {
  if (b.logo && b.logo.file) return realLogo(b);   // v2: official logo (CLIENT.md 2026-11-02 5:09 PM: logo permission resolved)
  const text = (b.logo && b.logo.text) || b.name, col = (b.logo && b.logo.color) || b.chartColor;
  const words = text.split(/\s+/), longest = Math.max(...words.map(w => w.length));
  const lines = words.length > 1 ? 2 : 1;
  const perLine = lines === 1 ? text.length : Math.max(longest, Math.ceil(text.length / 2));
  const size = Math.max(8, Math.min(maxPx, boxW / (perLine * 0.6)));
  return `<span class="ph-logo ${contrastOnCard(col) < 3 ? 'lowc' : ''}" style="--logo-color:${esc(col)};font-size:${size.toFixed(1)}px">${esc(text)}</span>`;
}
const tile = b => `<span class="tile ${b.logo && b.logo.file ? 'real' : ''}" aria-hidden="true">${phLogo(b, 48, 16)}</span>`;

/* ---------- state ---------- */
const S = {
  screen: 'home',            // home | how | about
  tab: 'overall', sort: {}, scroll: {},
  bv: null,                  // {brand, ctx, deck:'why'|'reports'|'response', open, report, from}
  howPage: 0, howBack: 'home',
  attract: false, modal: null, busy: false, selected: null, staff: null
};
const sortOf = tab => S.sort[tab] || 'total';
const tabs = () => [{id: 'overall', navLabel: 'Overall', icon: 'overall'}].concat(D.categories);

/* ---------- components ---------- */
function titlebar(kind) {
  const wm = `<img class="wm" src="assets/scr-wordmark-stacked-frame.svg" alt="Stasukelis Consumer Reports" draggable="false">`;   // v2: same stacked wordmark as the leaderboard top bar
  if (kind === 'brand') {
    const c = ctxLabel(S.bv.ctx);
    return `<header class="titlebar v2"><button class="btn slim" data-act="back" aria-label="Back">‹ Back</button>${wm}<div class="spacer"></div>
      <button class="btn slim" data-act="home">Home</button><button class="btn slim" data-act="close" aria-label="Close and return to the ${esc(c)} leaderboard.">${I.close}Close</button></header>`;
  }
  const back = kind === 'how' || kind === 'about' ? `<button class="btn slim" data-act="back" aria-label="Back">‹ Back</button>` : '';
  const cur = kind === 'how' ? 'How we rank' : kind === 'about' ? 'About' : (S.tab === 'overall' ? 'Home' : null);
  const nav = [['Home', 'home'], ['How we rank', 'how'], ['About', 'about']]
    .map(([l, a]) => `<button class="btn slim" data-act="${a}" ${l === cur ? 'aria-current="page"' : ''}>${l}</button>`).join('');
  return `<header class="titlebar v2">${back}${wm}<div class="spacer"></div>${nav}</header>`;
}
const rankHtml = r => r.rank == null ? '–' : (r.tie ? `${r.rank}<small>=</small>` : `${r.rank}`);
function rowLabel(r, cat, sort) {
  const L = cat === 'overall' ? 'Overall' : catById(cat).label;
  // label-in-name (QA v2 Fix 5): start with the visible text: name, then the "55/60 pts" line, then the big number
  const big = sort !== 'total' ? (r.key == null ? 'N/A' : `${r.key}/10`) : `${r.score}/100`;
  let s = `${r.brand.name}, ${r.e}/${r.p} pts, ${big}. ${L}, ${r.tie ? 'tied for rank' : 'rank'} ${r.rank == null ? 'none' : r.rank}, `;
  if (sort !== 'total') { s += r.key == null ? `${sectionById(sort).label} not applicable, ` : `${sectionById(sort).label} ${r.key} out of 10, `; }
  s += `${r.score} out of 100, ${r.e} of ${r.p} points`;
  if (cat === 'overall') s += `, rated in ${r.n} ${r.n === 1 ? 'category' : 'categories'}`;
  s += '.';
  if (cat !== 'overall' && r.na) s += ' Rebate not applicable.';
  s += ' Double-tap for details.';
  if (D.sample) s += ' ' + T.sampleVO;
  return s;
}

/* ---------- Most Popular (CLIENT.md): staff-picked models per category; hidden when a category has none ---------- */
/* ---------- v2 leaderboard (design/design-spec-v2.md): one slim top bar, dark graph panel over the photo wall ---------- */
const shortTab = c => c.id === 'overall' ? 'Overall' : String(c.navLabel || c.label).replace(/^By\s+/i, '');
function topbar() {
  const t = tabs();
  return `<header class="topbar">
    <button class="wmbtn" data-act="home" aria-label="Stasukelis Consumer Reports. Home."><img class="wm" src="assets/scr-wordmark-stacked-frame.svg" alt="" draggable="false"></button>
    <nav class="tabs-wrap" aria-label="Categories"><div class="tabs seg" role="tablist">${t.map((c, i) =>
      `<button class="tab" role="tab" id="tab-${esc(c.id)}" data-tab="${esc(c.id)}" aria-selected="${c.id === S.tab}" aria-controls="list" tabindex="${c.id === S.tab ? 0 : -1}"
        aria-label="${esc(c.navLabel)}, tab, ${i + 1} of ${t.length}.">${esc(shortTab(c))}</button>`).join('')}</div></nav>
    <button class="btn slim" data-act="how"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>How we rank</button></header>`;
}
function sortItems() { return [{id: 'total', label: 'Total score'}].concat(D.sections.map(x => ({id: x.id, label: x.label, short: x.short || x.label}))); }
function sortControl() {
  const s = sortOf(S.tab), cur = sortItems().find(x => x.id === s);
  return `<button class="sortbtn ${s !== 'total' ? 'on' : ''}" data-act="sortmenu" aria-haspopup="menu" aria-expanded="${!!S.sortOpen}" aria-label="Sort ${esc(cur.short || cur.label)}${cur.short && cur.short !== cur.label ? ', ' + esc(cur.label) : ''}. Double-tap to change.">
    <span class="k">Sort</span><span class="v">${esc(cur.short || cur.label)}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>`;
}
function sortMenu() {
  if (!S.sortOpen) return '';
  const s = sortOf(S.tab);
  return `<button class="menuscrim" data-act="sortclose" aria-label="Close the sort menu." tabindex="-1"></button><div class="sortmenu" role="menu" aria-label="Sort by">${sortItems().map(x =>
    `<button role="menuitemradio" aria-checked="${x.id === s}" data-sort="${esc(x.id)}"><span>${esc(x.label)}</span>${x.id === 'total' ? '<small>out of 100</small>' : '<small>out of 10</small>'}</button>`).join('')}</div>`;
}
const sampleBadge = () => D.sample ? `<span class="sbadge" role="note" aria-label="${esc(T.sampleBanner.replace(/<[^>]+>/g, ''))}">SAMPLE</span>` : '';
function row(r, cat, i, sort) {
  const b = r.brand, col = esc(b.chartColor);
  const meta = [`<span class="num">${r.e}/${r.p} pts</span>`];
  if (cat === 'overall') meta.push(`<span>${r.n} ${r.n === 1 ? 'category' : 'categories'}</span>`);
  if (cat !== 'overall' && r.na && sort === 'total') meta.push(`<span class="nai">Rebate N/A</span>`);
  let barHtml, pts;
  if (sort === 'total') {
    barHtml = `<span class="bar-wrap"><span class="lb-bar" style="--score:${r.score};--bar-color:${col};--i:${i}"></span></span>`;
    pts = `<span class="n">${r.score}</span><span class="d">/100</span>`;
  } else if (r.key == null) {
    barHtml = `<span class="na-line"><span class="lb-na"></span><span class="why">N/A: no rebate offered</span></span>`;
    pts = `<span class="nav">N/A</span><span class="tot num">${r.score}/100</span>`;
  } else {
    barHtml = `<span class="bar-wrap"><span class="lb-bar" style="--score:${r.key * 10};--bar-color:${col};--i:${i}"></span></span>`;
    pts = `<span class="n">${r.key}</span><span class="d">/10</span><span class="tot num">${r.score}/100</span>`;
  }
  return `<button class="lb-row ${S.selected === b.id ? 'is-selected' : ''}" data-brand="${esc(b.id)}" aria-label="${esc(rowLabel(r, cat, sort))}">
    <span class="rank" aria-hidden="true">${rankHtml(r)}</span>${tile(b)}
    <span class="barcol" aria-hidden="true"><span class="nameline"><span class="bname">${esc(b.name)}</span><span class="meta">${meta.join('<span class="dot">·</span>')}</span></span>${barHtml}</span>
    <span class="lb-points" aria-hidden="true">${pts}</span></button>`;
}
function pendingRow(r, cat) {
  const b = r.brand;
  return `<button class="lb-row pend" data-brand="${esc(b.id)}" aria-label="${esc(b.name)}, not yet rated in ${esc(catById(cat).label.toLowerCase())}.">
    <span class="rank" aria-hidden="true">–</span>${tile(b)}
    <span class="barcol" aria-hidden="true"><span class="nameline"><span class="bname">${esc(b.name)}</span><span class="meta"><span>Not yet rated</span></span></span><span class="na-line"><span class="lb-na"></span></span></span>
    <span class="lb-points" aria-hidden="true"><span class="nav">–</span></span></button>`;
}
function footer() {
  return `<footer class="footer v2"><span class="fl"><b>Data through ${esc(D.dataThrough)}</b><span class="dot">·</span>${T.disclaimerShort}</span>
    <button class="flink" data-act="about" aria-label="About this guide.">About<span class="long"> this guide</span> ›</button></footer>`;
}
function picksFor(cat) {
  const mp = D.mostPopular, list = mp && mp.picks && mp.picks[cat];
  return Array.isArray(list) ? list.filter(p => p && brandById(p.brand) && brandById(p.brand).categories.includes(cat)) : [];
}
function mostPopular(cat) {
  const picks = picksFor(cat); if (!picks.length) return '';
  const c = catById(cat);
  const cards = picks.map((p, i) => {
    const b = brandById(p.brand);
    const img = p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" decoding="async" draggable="false">` : `<span class="pimg-ph">${icon(c.icon)}</span>`;
    const label = `${b.name} ${p.model}, ${p.name}. Most Popular pick.${p.note ? ' ' + p.note : ''} Double-tap to see ${b.name}.${D.sample ? ' Sample pick, not a real one.' : ''}`;   // starts with the visible text
    return `<button class="pick" data-pick="${i}" data-brand="${esc(b.id)}" aria-label="${esc(label)}"><span class="pimg" aria-hidden="true">${img}</span>
      <span class="ptext" aria-hidden="true"><b>${esc(b.name)}</b> <span class="num">${esc(p.model)}</span><span class="pn">${esc(p.name)}</span></span></button>`;
  }).join('');
  return `<section class="popular v2" aria-label="Most Popular. ${esc(T.popSub)}${D.sample ? ' Sample picks.' : ''}"><h2 class="phead" aria-hidden="true">Most<br>Popular</h2>
    <div class="picks-row"><div class="picks">${cards}</div></div></section>`;
}

/* ---------- screens ---------- */
function leaderboardHTML() {
  const cat = S.tab, sort = sortOf(cat);
  let {rated, pending} = board(cat, sort);
  if (QD('only')) { const keep = QD('only').split(','); rated = rated.filter(r => keep.includes(r.brand.id)); }   // mockup/stress-test only
  const n = rated.length;
  const title = cat === 'overall' ? 'Overall Ranking' : esc(catById(cat).navLabel);
  const sub = cat === 'overall' ? `Every brand we've rated, all categories combined.<span class="hlp"> ${T.helper}</span>` : `${n} ${n === 1 ? 'brand' : 'brands'} rated · ${esc(catById(cat).description)}`;
  let body;
  if (!rated.length) {
    body = cat === 'overall' ? `<div class="empty"><b>No brands rated yet.</b> Our team is scoring brands now. Check back soon.</div>`
      : `<div class="empty"><b>No ${esc(catById(cat).label.toLowerCase())} scores yet.</b> Our team is still scoring. Check back soon.</div>`;
  } else body = `<div class="rows grow ${reduced() ? 'fadein' : ''}" id="rows">${rated.map((r, i) => row(r, cat, i, sort)).join('')}</div>`;
  const nyr = cat !== 'overall' && pending.length ? `<div class="nyr-h">Not yet rated in ${esc(catById(cat).label.toLowerCase())}</div><div class="rows">${pending.map(r => pendingRow(r, cat)).join('')}</div>` : '';
  const pop = cat === 'overall' ? '' : mostPopular(cat);
  return `${topbar()}
    <main class="gpanel" id="list" role="tabpanel" aria-labelledby="tab-${esc(cat)}">
      <div class="ghead"><div class="gt"><h1 class="serif" id="list-h">${title}</h1><div class="gsub">${sub}</div></div>${sampleBadge()}${sortControl()}</div>
      <div class="scroller" id="scroller">${pop}${body}${nyr}</div>${sortMenu()}</main>${footer()}`;
}

/* ---------- photo wall behind the graph panel (spec-v2 §7): capped, recycled tiles; transform-only drift ---------- */
const WALL = {el: null, rows: [], raf: 0, last: 0, next: 0, key: '', list: null, k: 0, q: []};
function wallList() {   // shuffled once per boot (spec-v2 §7.3); ?noshuffle=1 keeps data order for repeatable dev shots
  if (WALL.list) return WALL.list;
  const c = bgCfg(), l = (c.images || []).map(x => c.folder + (x.file || x)).filter(Boolean);
  if (!QD('noshuffle')) for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return (WALL.list = l);
}
function preloadWall() {   // keep the next 3 photos decoded before a tile swaps to them
  const l = wallList(); if (!l.length) return;
  while (WALL.q.length < 3) {
    const it = {src: l[(WALL.k++) % l.length], ok: false, bad: false}, im = new Image(); im.decoding = 'async'; im.src = it.src; WALL.q.push(it);
    (im.decode ? im.decode() : Promise.resolve()).then(() => { it.ok = true; }, () => { it.bad = true; });
  }
}
function nextWallSrc() {   // a decoded photo, or null (the tile keeps its current photo: never a half-loaded or broken image)
  const it = WALL.q[0]; if (!it || !(it.ok || it.bad)) return null;
  WALL.q.shift(); preloadWall(); return it.bad ? null : it.src;
}
function stopWall() { cancelAnimationFrame(WALL.raf); WALL.raf = 0; }
function startWall() { if (WALL.raf || !WALL.rows.length || reduced() || QD('still')) return; WALL.last = performance.now(); WALL.raf = requestAnimationFrame(tick); }
function bgCfg() { return Object.assign({enabled: true, folder: 'assets/bg/', images: [], rows: 3, speedPxPerSec: 10, gap: 10}, D.background || {}); }
function placeWall() {
  const w = document.getElementById('bgwall'), p = document.getElementById('list');
  if (!w) return;
  const show = p && S.screen === 'home' && !S.attract;
  w.hidden = !show; if (!show) { stopWall(); return; }
  const r = p.getBoundingClientRect();
  Object.assign(w.style, {left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px'});
  const key = `${Math.round(r.width)}x${Math.round(r.height)}`;
  if (key !== WALL.key) { WALL.key = key; buildWall(r.width, r.height); } else startWall();
}
function buildWall(W, H) {
  const c = bgCfg(), w = document.getElementById('bgwall'), imgs = wallList();
  w.querySelector('.tiles').innerHTML = ''; WALL.rows = []; stopWall();
  if (!c.enabled || !imgs.length) return;
  const stress = QD('stress');
  if (stress) { w.querySelector('.tiles').innerHTML = `<img class="solo" src="${esc(c.folder + stress)}" alt="">`; return; }
  const n = c.rows, g = c.gap, th = (H - g * (n - 1)) / n, tw = Math.round(th * 4 / 3), per = Math.ceil(W / (tw + g)) + 1;
  WALL.q = []; WALL.k = 0; const nextSrc = () => imgs[(WALL.k++) % imgs.length];   // first fill straight from the list
  for (let ri = 0; ri < n; ri++) {
    const rowEl = document.createElement('div'); rowEl.className = 'wrow'; rowEl.style.top = ri * (th + g) + 'px'; rowEl.style.height = th + 'px';
    const tiles = [];
    for (let i = 0; i < per; i++) {
      const im = document.createElement('img'); im.alt = ''; im.decoding = 'async'; im.loading = 'lazy'; im.draggable = false; im.src = nextSrc();
      // QA v2 Fix 1b: a photo that fails (e.g. offline, not cached) tries the next one; if none load, the tile hides and the scrim shows through.
      let tries = 0; im.onerror = () => { if (++tries < imgs.length) im.src = nextSrc(); else im.style.visibility = 'hidden'; };
      im.onload = () => { tries = 0; im.style.visibility = ''; };
      im.style.width = tw + 'px'; im.style.height = th + 'px'; rowEl.appendChild(im); tiles.push({el: im, x: i * (tw + g)});
    }
    w.querySelector('.tiles').appendChild(rowEl);
    WALL.rows.push({tiles, dir: ri % 2 ? 1 : -1, speed: c.speedPxPerSec * (1 + 0.15 * ri), span: per * (tw + g), tw, off: (ri * 0.37 % 1) * (tw + g)});
  }
  WALL.W = W; preloadWall();
  const t0 = parseFloat(QD('wallt') || '0');  // mockups: advance the drift to a fixed time (s)
  step(t0 * 1000, true);
  startWall();   // Reduce Motion: tiles placed once, no loop (spec-v2 §7.4)
}
function step(dtMs, init) {
  for (const r of WALL.rows) {
    const d = init ? -r.off + r.dir * r.speed * dtMs / 1000 : r.dir * r.speed * dtMs / 1000;
    for (const t of r.tiles) {
      t.x += d;
      let moved = false;
      if (r.dir < 0) while (t.x < -r.tw) { t.x += r.span; moved = true; }      // left edge: recycle to the right, swap photo while off-screen
      else while (t.x > WALL.W) { t.x -= r.span; moved = true; }
      if (moved && !init) { const src = nextWallSrc(); if (src) t.el.src = src; }
      t.el.style.transform = `translate3d(${t.x.toFixed(2)}px,0,0)`;
    }
  }
}
function tick(now) {
  const dt = Math.min(100, now - WALL.last); WALL.last = now;
  if (!document.hidden && !S.bv && !S.attract && S.screen === 'home') step(dt);
  WALL.raf = requestAnimationFrame(tick);
}

function heroHTML() {
  const b = brandById(S.bv.brand), ctx = S.bv.ctx;
  const c = ctx === 'overall' ? overall(b) : cell(b, ctx);
  const nyr = !c || c.pending || (ctx === 'overall' && !c.n);
  const other = [{id: 'overall', label: 'Overall'}].concat(b.categories.map(id => catById(id)).filter(Boolean))
    .map(x => `<button class="chip" data-ctx="${esc(x.id)}" aria-pressed="${x.id === ctx}">${esc(x.label)}</button>`).join('');
  const math = nyr ? '' : mathLine(c);
  const vo = nyr ? `${b.name}. Ranked in ${ctxLabel(ctx)}. Not yet rated.` : `${b.name}. Ranked in ${ctxLabel(ctx)}. ${c.score} out of 100, ${c.e} of ${c.p} points. Scored ${D.scoredDate}.`;
  return `<section class="card hero" aria-label="${esc(vo)}">
    <div class="top ${b.logo && b.logo.file ? 'real' : ''}"><span class="bigtile ${b.logo && b.logo.file ? 'real' : ''}" aria-hidden="true">${phLogo(b, 72, 26)}</span>
      <div style="flex:1;min-width:0"><h1 class="serif">${esc(b.name)}</h1><div class="ctx">Ranked in: ${esc(ctxLabel(ctx))}</div></div></div>
    ${nyr ? `<div class="scoreline"><span class="nyr">Not yet rated</span></div>`
          : `<div><div class="scoreline"><span class="n">${c.score}</span><span class="d">/100</span></div><div class="under num">${c.e} of ${c.p} points</div></div><div class="mathbox">${math}</div>`}
    ${D.sample ? `<div class="dateline"><span class="tag">SAMPLE</span><span>SAMPLE SCORES: not real results</span></div>` : ''}
    <div class="desc">${esc(b.description)}</div>
    <div class="dateline">Scored ${esc(D.scoredDate)}</div>
    ${b.updated ? `<div class="dateline">Updated ${esc(b.updated)} after a review.</div>` : ''}
    <div class="other-wrap"><div class="other-lbl">See ${esc(b.name)} in another category</div><div class="other-row"><div class="other" role="group" aria-label="See ${esc(b.name)} in another category">${other}</div></div></div>
  </section>`;
}
function mathLine(c) {
  if (c.cat === 'overall') return `All categories: <b>${c.e}</b> of <b>${c.p}</b> points → <b>${c.score}/100</b>`;
  return c.na ? `Rebate not counted, so <b>${c.e}</b> of ${c.p} points → <b>${c.score}/100</b>`
              : `<b>${c.e}</b> of <b>${c.p}</b> points → ${c.e} ÷ ${c.p} × 100 = <b>${c.score}/100</b>`;
}
function posInfo(b, ctx) {
  const {rated} = board(ctx, 'total'), i = rated.findIndex(r => r.brand.id === b.id);
  if (i < 0) return '';
  const me = rated[i];
  const line = ctx === 'overall' ? `Overall, ${b.name} is #${me.rank} of ${rated.length}.` : `In ${ctxLower(ctx)}, ${b.name} is #${me.rank} of ${rated.length}.`;
  const nb = [rated[i - 1] ? `Just above: ${rated[i - 1].brand.name}` : '', rated[i + 1] ? `Just below: ${rated[i + 1].brand.name}` : ''].filter(Boolean).map(t => `<span>${esc(t)}</span>`).join('');
  return `<div class="deckpos"><div>${esc(line)}</div><div class="nb">${nb}</div></div>`;
}
function whyHTML(b, ctx) {
  if (ctx === 'overall') {
    const o = overall(b);
    if (!o.n) return nyrHTML(b, ctx, []);
    const minis = o.parts.map(p => `<button class="minirow" data-ctx="${esc(p.cat)}" aria-label="${esc(catById(p.cat).label)}, ${p.score} out of 100, ${p.e} of ${p.p} points. Double-tap to see its 7 scores.">
      <span class="sl" aria-hidden="true">${esc(catById(p.cat).label)} · <span class="num">${p.e}/${p.p}</span></span>
      <span class="bar-wrap" aria-hidden="true"><span class="lb-bar" style="--score:${p.score};--bar-color:${esc(b.chartColor)};width:calc(var(--score) * 1%)"></span></span>
      <span class="sp" aria-hidden="true"><span class="n">${p.score}</span><span class="d">/100</span></span></button>`).join('');
    return `<h2 class="serif">Why they're ranked here</h2><div class="body">${minis}
      <div class="summary">Across all ${o.n} categories we rate it in, ${esc(b.name)} earned ${o.e} of ${o.p} points. That's ${o.score} out of 100. Tap a category to see its 7 scores.</div></div><div class="fade"></div>`;
  }
  const c = cell(b, ctx);
  if (!c || c.pending) return nyrHTML(b, ctx, c ? c.pending : D.sections.map(s => s.label));
  const scored = c.secs.filter(s => !s.na), max = Math.max(...scored.map(s => s.score)), min = Math.min(...scored.map(s => s.score));
  const nm = a => a.map(s => s.label).join(' and ');
  const rows = c.secs.map(s => {
    if (s.na) return `<div class="srow" role="img" aria-label="${esc(s.label)}, not applicable, no rebate offered. Not counted."><span class="sl" aria-hidden="true">${esc(s.label)}</span>
      <span class="na-line" aria-hidden="true"><span class="lb-na"></span><span class="why">N/A: no rebate offered</span></span><span class="sp" aria-hidden="true"><span class="nav">N/A</span></span></div>`;
    const open = S.bv.open === s.id;
    const ex = open ? `<span class="ex"><span class="m">${esc(s.means || '')}</span><span class="ev">${esc(s.evidence || '')} <span class="when">· Scored ${esc(s.scoredDate || D.scoredDate)}</span></span></span>` : '';
    return `<button class="srow ${open ? 'open' : ''}" data-sec="${esc(s.id)}" aria-expanded="${open}" aria-label="${esc(s.label)}, ${s.score}/10. ${s.score} out of 10. Double-tap for details.">
      <span class="sl" aria-hidden="true">${esc(s.label)}</span><span class="bar-wrap" aria-hidden="true"><span class="lb-bar" style="--s:${s.score};--bar-color:${esc(b.chartColor)}"></span></span>
      <span class="sp" aria-hidden="true"><span class="n">${s.score}</span><span class="d">/10</span></span>${ex}</button>`;
  }).join('');
  const same = max === min;
  const fact = c.secs.map(s => s.supportFact).filter(Boolean)[0];
  const summary = `${b.name} earned ${c.e} of ${c.p} points in ${ctxLower(ctx)}. That's ${c.score} out of 100. ` +
    (same ? `Every section scored ${max}/10.` : `Strongest: ${nm(scored.filter(s => s.score === max))} (${max}/10). Weakest: ${nm(scored.filter(s => s.score === min))} (${min}/10).`) + (fact ? ' ' + fact : '');
  return `<h2 class="serif">Why they're ranked here</h2><div class="body">${rows}<div class="summary">${esc(summary)}</div></div><div class="fade"></div>`;
}
function nyrHTML(b, ctx, list) {
  return `<h2 class="serif">Not yet rated</h2><div class="body"><div class="nyr-list"><p>We haven't finished scoring ${esc(b.name)} in ${esc(ctxLower(ctx))} yet.</p>
    ${list.length ? `<h3>Still to score:</h3><ul>${list.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}</div></div>`;
}
function reportsHTML(b, ctx) {
  const reps = (b.reports || []).slice();
  if (S.bv.report) {
    const r = reps.find(x => x.id === S.bv.report);
    if (r) return `<div class="body report" id="report"><span class="tag" style="margin-top:6px">${esc(catById(r.category) ? catById(r.category).label : 'Report')}</span>
      <h3>${esc(r.title)}</h3><div class="rm"><span>${esc(r.date)}</span></div><p>${esc(r.body)}</p>
      ${D.sample ? `<p>${ph('report format, author and approver')}</p>` : ''}
      <button class="btn" data-act="report-back">Back to ${esc(b.name)}</button></div>`;
  }
  if (!reps.length) return `<h2 class="serif">Reports</h2><div class="body"><p class="summary">No reports for ${esc(b.name)} yet.</p></div>`;
  const rrow = r => `<button class="rrow" data-report="${esc(r.id)}"><span class="rt">${esc(r.title)}<span class="rm">${esc(r.date)} · ${esc(catById(r.category) ? catById(r.category).label : '')}</span></span><span class="chev" aria-hidden="true">›</span></button>`;
  let inner;
  if (ctx === 'overall') inner = `<div class="rgroup">All reports for ${esc(b.name)}</div>${reps.map(rrow).join('')}`;
  else {
    const mine = reps.filter(r => r.category === ctx), rest = reps.filter(r => r.category !== ctx);
    inner = (mine.length ? `<div class="rgroup">${esc(ctxLabel(ctx))} reports</div>${mine.map(rrow).join('')}` : '') +
      (rest.length ? `<div class="rgroup ${mine.length ? 'div' : ''}">All reports for ${esc(b.name)}</div>${rest.map(rrow).join('')}` : '');
  }
  return `<h2 class="serif">Reports</h2><div class="body">${inner}</div><div class="fade"></div>`;
}
function responseHTML(b) {
  return `<h2 class="serif">Brand response</h2><div class="body"><div class="resp-label">In ${esc(b.name)}'s own words. Not written by Stasukelis Appliance.</div><p class="summary">${esc(b.response)}</p></div>`;
}
function brandViewHTML() {
  const b = brandById(S.bv.brand), ctx = S.bv.ctx, deck = S.bv.deck;
  const tabsList = [['why', "Why they're ranked here"], ['reports', 'Reports']].concat(b.response ? [['response', 'Brand response']] : []);
  const dt = tabsList.map(([id, l]) => `<button class="tab" role="tab" data-deck="${id}" aria-selected="${deck === id}">${l}</button>`).join('');
  const card = deck === 'reports' ? reportsHTML(b, ctx) : deck === 'response' ? responseHTML(b) : whyHTML(b, ctx);
  return `${titlebar('brand')}<div class="bv">${heroHTML()}<div class="deck"><div class="decktabs"><div role="tablist" style="display:flex;gap:12px">${dt}</div>${posInfo(b, ctx)}</div>
    <section class="card deckcard" id="deckcard">${card}</section></div></div>`;
}

const HOW_CARDS = () => [
  `<h2 class="serif">The 7 things we score</h2><ol>
    <li><span><b>Ease of Use</b>: Is it easy to use every day?</span></li>
    <li><span><b>Customer Instructions (Manual)</b>: Are the manual and labels clear?</span></li>
    <li><span><b>Product Care</b>: Is it easy to clean and look after?</span></li>
    <li><span><b>Rebate Submission</b>: Are rebates easy to claim and paid on time? <span class="opt">(only when there's a rebate)</span></span></li>
    <li><span><b>Customer Support</b>: Does the brand answer customers fast and help?</span></li>
    <li><span><b>Service Support</b>: Does the brand back our repair team with parts, claims and tech help?</span></li>
    <li><span><b>Serviceability</b>: Is it easy to fix?</span></li></ol>
    <div class="foot">How long brands take to reply and to send parts counts toward Customer Support, Service Support and Rebate Submission.</div>`,
  `<h2 class="serif">How the math works</h2><ul><li>Each area gets up to <b>10 points</b>.</li><li>7 areas × 10 points = <b>70 points possible</b>.</li>
    <li>We divide the points earned by the points possible, then multiply by 100.</li></ul>
    <div class="example"><span class="tag">SAMPLE · Brand A (made up)</span><div class="q">Brand A earned <b>53 of 70</b> points.</div>
    <div class="big" aria-label="53 divided by 70, times 100, equals 76 out of 100.">53 ÷ 70 × 100 = 76 out of 100.</div></div>
    <div class="foot">Scores are rounded to the nearest whole number. Right now every area counts the same. ${ph('section weights: equal, or weighted? (Marcus, Q1)')}</div>`,
  `<h2 class="serif">No rebate? It doesn't count against them.</h2><ul><li>If a brand offers no rebate, we mark Rebate Submission <b>N/A</b>.</li>
    <li>N/A is <b>not a zero</b>. We leave it out.</li><li>That makes <b>60 points possible</b> instead of 70.</li></ul>
    <div class="example"><span class="tag">SAMPLE · Brand A ranges (made up)</span><div class="big" aria-label="45 of 60 points, 75 out of 100.">45 of 60 points → 75 out of 100.</div></div>
    <div class="foot">${ph('exact N/A rule: no rebate at all, none in that category, or store-handled rebates (Q3)')}</div>`,
  `<h2 class="serif">Each category is scored on its own</h2><ul><li>A brand gets its own score in <b>each category it makes</b>. A great washer brand might score differently on ranges.</li>
    <li><b>Overall</b> adds up all its points across its categories, then does the same math.</li></ul>
    <div class="example"><span class="tag">SAMPLE · Brand A (made up)</span><div class="q">Laundry 53 of 70 + Ranges 45 of 60 = 98 of 130 → <b>75 out of 100</b> overall.</div></div>
    <div class="foot">A brand shows as "Not yet rated" until every area is scored.</div>`,
  `<h2 class="serif">Who scores, and how often</h2><ul><li>Our store team scores each brand.</li><li>John Stasukelis approves every score before it goes up.</li>
    <li>We re-score every brand <b>every 6 months</b>.</li><li>Every score is based on evidence: our service records, hands-on experience, the manuals, rebate experience and verified customer feedback.</li></ul>
    <div class="foot">Scoring guide ${ph('rubric version and approval date')} · Data through ${esc(D.dataThrough)}</div>
    <div class="foot"><b>What earns a 1 vs a 10:</b> ${ph('approved scoring guide (rubric). The DRAFT in brief §3.12 is not approved and must not be published.')}</div>`,
  `<h2 class="serif">Our promise to you</h2><ul><li><b>We sell many of these brands.</b> We'd rather say so up front.</li>
    <li><b>No brand can pay to rank higher.</b> Rebates, co-op money and brand incentives never change a score.</li><li><b>No ads</b> on any ranking screen.</li>
    <li>Rebate Submission scores how <b>easy and reliable</b> a rebate is, not how big it is.</li><li>If a brand asks us to review a score, we re-check the evidence. Any change is dated.</li></ul>
    <div class="foot">${T.disclosure}</div><div class="foot">${ph("John's sign-off on the disclosure and the no-paid-placement promise (Q2)")}</div>`
];
const HOW_TITLES = ['The 7 things we score', 'How the math works', "No rebate? It doesn't count against them.", 'Each category is scored on its own', 'Who scores, and how often', 'Our promise to you'];
function howHTML() {
  const cards = HOW_CARDS(), n = cards.length, pages = Math.ceil(n / 2), p = Math.min(S.howPage, pages - 1);
  const shown = [2 * p, 2 * p + 1].filter(i => i < n);
  const cardHtml = shown.map(i => `<section class="card hcard" aria-label="How we rank, card ${i + 1} of ${n}, ${esc(HOW_TITLES[i])}."><div class="ht"><span></span><div class="pos">${i + 1} of ${n}</div></div>${cards[i]}</section>`).join('');
  return `${titlebar('how')}<section class="hsh"><h1 class="serif">How we rank</h1>
    <div class="sub">We score each brand from 1 to 10 in seven areas based on our own experience, then turn the points into a score out of 100. ${ph('scale 1–10 or 0–10, whole or half points')}</div></section>
    <div class="hw" id="hw">${cardHtml}</div>
    <div class="pager"><button class="btn" data-act="how-prev" ${p === 0 ? 'disabled aria-disabled="true"' : ''}>‹ Previous</button>
      <div class="mid"><div class="dots" aria-hidden="true">${cards.map((_, i) => `<i class="${shown.includes(i) ? 'on' : ''}"></i>`).join('')}</div><div>${T.disclaimerShort}</div></div>
      <button class="btn" data-act="how-next" ${p >= pages - 1 ? 'disabled aria-disabled="true"' : ''}>Next ›</button></div>`;
}
function aboutHTML() {
  const sec = (h, body) => `<div><h3>${h}</h3>${body}</div>`;
  const why = sec('Why we made it', "<p>We see these brands every day: on the floor, in installs and on the repair bench. This guide puts what we've learned in one place, with the numbers and the reasons.</p>");
  const store = sec('About the store', `<p>Stasukelis Appliance, Gardner, MA.</p>${ph('store story facts John approves (e.g. family history, years in business, services offered, awards). The brief lists some public background facts, but they are "background only" until John confirms them (Q16).', 'block')}`);
  const how = sec('How it works', `<p>Our team scores each brand. John Stasukelis approves every score. We re-score every 6 months.</p><button class="btn primary" data-act="how" aria-label="See how we rank, button.">See how we rank ›</button>`);
  const brands = sec('For brands', `<p>A brand can ask us to review a score. We'll re-check the evidence, and any change is dated on the brand's page. Brands can also send a short response, shown in their own words.</p>${ph('who handles brand reviews and how brands reach them (Q2). No contact details on the iPad until confirmed.', 'block')}`);
  const ask = sec('Ask us', "<p>Have a question about a brand? Ask anyone on our team. We're happy to help.</p>");
  return `${titlebar('about')}<main class="card about"><h1 class="serif">About this guide</h1>
    <p class="intro">Stasukelis Consumer Reports is our store's own guide to appliance brands. We built it to help answer a question shoppers ask: "Which brand would you buy?"</p>
    <div class="cols"><div class="col">${why}${how}${ask}</div><div class="col">${store}${brands}</div></div><div class="legalline">${T.disclosure} ${T.disclaimerFull} ${ph("John's sign-off on the disclosure line")}</div></main>`;
}
function attractHTML() {
  const top = board('overall', 'total').rated.slice(0, 3);
  const prev = top.length ? `<div class="card preview" aria-hidden="true"><div class="ptitle"><span>Overall Ranking</span>${D.sample ? '<span class="tag">SAMPLE</span>' : ''}</div>
    ${top.map((r, i) => `<div class="prow"><div class="rank">${r.rank}</div><div class="pn"><span class="bname">${esc(r.brand.name)}</span>
      <span class="bar-wrap"><span class="lb-bar" style="--score:${r.score};--bar-color:${esc(r.brand.chartColor)};--i:${i}"></span></span></div>
      <div class="lb-points"><span class="n">${r.score}</span><span class="d">/100</span></div></div>`).join('')}</div>` : '';
  return `<button class="attract" id="attract" aria-label="Stasukelis Consumer Reports. See which appliance brands we recommend, and why. Double-tap to explore.">
    ${D.sample ? '<span class="badge" aria-hidden="true">SAMPLE SCORES</span>' : ''}
    <span class="grid" aria-hidden="true"><span class="left"><img class="wm" src="assets/scr-wordmark-stacked-frame.svg" alt="" draggable="false">
      <span class="serif" style="font:600 72px/76px var(--scr-font-serif)" data-h1>Which brands do we recommend?</span>
      <span class="sub">See which appliance brands we recommend, and why.</span><span class="support">Scored by our own team, from our own experience.</span>
      <span class="prompt">${I.hand}Tap to explore</span></span><span>${prev}</span></span>
    <span class="legal">${T.disclaimerShort}</span></button>`;
}

/* ---------- rendering ---------- */
let base, bvl, ovl;
function ensureLayers() {
  app.innerHTML = '<div id="bgwall" aria-hidden="true" hidden><div class="tiles"></div><div class="wscrim"></div></div><div class="layer" id="base"></div><div class="layer bvl" id="bvl" hidden></div><div id="ovl"></div>';
  base = document.getElementById('base'); bvl = document.getElementById('bvl'); ovl = document.getElementById('ovl');
}
function saveScroll() { const sc = document.getElementById('scroller'); if (sc && S.screen === 'home') S.scroll[S.tab] = sc.scrollTop; }
function renderBase(opts = {}) {
  saveScroll();
  base.innerHTML = S.screen === 'how' ? howHTML() : S.screen === 'about' ? aboutHTML() : leaderboardHTML();
  if (S.screen === 'home') {
    const sc = document.getElementById('scroller'); sc.scrollTop = opts.top ? 0 : (S.scroll[S.tab] || 0);
    const rows = document.getElementById('rows');
    if (rows && opts.noGrow) rows.classList.remove('grow');
    if (rows && opts.crossfade && !reduced()) { sc.animate([{opacity: 0}, {opacity: 1}], {duration: 250 * TS, easing: 'linear'}); rows.style.setProperty('--d0', 120 * TS + 'ms'); }
    updateTabFade();
    const t = base.querySelector('.tab[aria-selected="true"]'); if (t && t.scrollIntoView && opts.tabIntoView) t.scrollIntoView({block: 'nearest', inline: 'nearest'});
  }
  base.inert = !!S.bv || S.attract; updateFades(base); fitHead(); placeWall();
}
/* panel subtitle is one line: if a long Sort label leaves too little room, drop the Overall helper sentence first (as at <=1120), never an ellipsis */
function fitHead() {
  const g = base.querySelector('.gsub'); if (!g) return;
  g.classList.remove('tight'); if (g.scrollWidth > g.clientWidth + 1) g.classList.add('tight');
}
/* scroll cue on cards that scroll (How we rank, About, brand hero): .more shows the 40px bottom fade while content remains below */
function updateFades(root = document) {
  root.querySelectorAll('.hero,.hcard,.about,.gpanel .scroller').forEach(el => el.classList.toggle('more', el.scrollHeight - el.clientHeight - el.scrollTop > 2));
  // horizontal rows (brand-view category chips, Most Popular picks): right-edge fade on the wrapper while more sits to the right
  root.querySelectorAll('.other,.picks').forEach(o => o.parentElement.classList.toggle('more', o.scrollWidth - o.clientWidth - o.scrollLeft > 2));
}
function updateTabFade() { const w = base.querySelector('.tabs-wrap'), t = base.querySelector('.tabs'); if (w && t) w.classList.toggle('more', t.scrollWidth - t.clientWidth - t.scrollLeft > 2); }
function renderBV() {
  if (!S.bv) { bvl.hidden = true; bvl.innerHTML = ''; base.inert = S.attract; return; }
  const body = bvl.querySelector('#deckcard .body'), keep = body ? body.scrollTop : 0;
  bvl.hidden = false; bvl.innerHTML = brandViewHTML(); base.inert = true;
  const nb = bvl.querySelector('#deckcard .body'); if (nb && S.bv.keepScroll) nb.scrollTop = keep; S.bv.keepScroll = false; updateFades(bvl);
}
function announce(t) { sr.textContent = ''; setTimeout(() => { sr.textContent = t; }, 30); }

/* ---------- motion helpers ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
function anim(el, kf, o) { if (!el || !el.animate) return Promise.resolve(); const a = el.animate(kf, Object.assign({fill: 'both'}, o, {duration: (o.duration || 0) * TS})); return a.finished.catch(() => {}).then(() => a); }
function waitOrTap(ms, el) { return new Promise(res => { let done = false; const fin = () => { if (!done) { done = true; el.removeEventListener('pointerdown', fin); res(); } }; el.addEventListener('pointerdown', fin); setTimeout(fin, ms * TS); }); }
function takeoverEl(b) {
  const W = innerWidth, H = innerHeight;
  const el = document.createElement('div'); el.className = 'takeover'; el.setAttribute('aria-hidden', 'true');
  const size = Math.min(H * 0.3, (W * 0.72) / (Math.max(4, b.logo && b.logo.text ? b.logo.text.length : b.name.length) * 0.6));
  el.innerHTML = b.logo && b.logo.file ? `<div class="biglogo real">${realLogo(b)}</div>` : `<div class="biglogo">${phLogo(b, W * 0.72, size)}<span class="lgph">LOGO PLACEHOLDER</span></div>`;
  return el;
}
function rectTransform(r) { const W = innerWidth, H = innerHeight; return `translate(${r.left}px,${r.top}px) scale(${Math.max(.01, r.width / W)},${Math.max(.01, r.height / H)})`; }

/* ---------- navigation ---------- */
async function openBrand(id, ctx, fromEl) {
  if (S.busy) return; const b = brandById(id); if (!b) return;
  S.busy = true; const blocker = document.createElement('div'); blocker.className = 'blocker'; ovl.appendChild(blocker);
  saveScroll();
  const tileEl = fromEl && (fromEl.querySelector('.tile') || fromEl.querySelector('.pimg')) || fromEl;
  const r0 = tileEl ? tileEl.getBoundingClientRect() : {left: innerWidth / 2 - 28, top: innerHeight / 2 - 28, width: 56, height: 56};
  if (fromEl) fromEl.classList.add('is-pressed');
  const panel = takeoverEl(b), logo = panel.querySelector('.biglogo');
  S.bv = {brand: id, ctx, deck: 'why', open: null, report: null, from: S.tab};
  if (reduced()) {
    ovl.appendChild(panel);
    await anim(panel, [{opacity: 0}, {opacity: 1}], {duration: 200, easing: 'linear'});
    renderBV(); await sleep(400 * TS);
    await anim(panel, [{opacity: 1}, {opacity: 0}], {duration: 200, easing: 'linear'});
  } else {
    await sleep(90 * TS);
    const dim = document.createElement('div'); dim.className = 'dim'; ovl.appendChild(dim); ovl.appendChild(panel);
    anim(dim, [{opacity: 0}, {opacity: 1}], {duration: 350, easing: 'linear'});
    anim(logo, [{opacity: 0}, {opacity: 0, offset: .4}, {opacity: 1}], {duration: 350, easing: 'linear'});
    await anim(panel, [{transform: rectTransform(r0), borderRadius: '12px'}, {transform: 'none', borderRadius: '0px'}], {duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)'});
    renderBV(); bvl.style.opacity = '0'; dim.remove(); base.style.visibility = 'hidden';   // leaderboard fully hidden behind the logo
    await waitOrTap(600, panel);                                    // hold: tap anywhere skips
    const tgt = bvl.querySelector('.bigtile'), lr = logo.getBoundingClientRect(), tr = tgt.getBoundingClientRect();
    tgt.style.visibility = 'hidden';
    const k = tr.width / lr.width, dx = tr.left + tr.width / 2 - (lr.left + lr.width / 2), dy = tr.top + tr.height / 2 - (lr.top + lr.height / 2);
    const ease = {duration: 300, easing: 'ease-in-out'};
    await Promise.all([
      anim(logo, [{transform: 'none', opacity: 1}, {transform: `translate(${dx}px,${dy}px) scale(${k})`, opacity: .2}], ease),
      anim(panel, [{backgroundColor: 'rgba(250,248,244,1)'}, {backgroundColor: 'rgba(250,248,244,0)'}], ease),
      anim(bvl, [{opacity: 0}, {opacity: 1}], ease)]);
    tgt.style.visibility = ''; bvl.style.opacity = ''; bvl.getAnimations().forEach(a => a.cancel()); base.style.visibility = '';
  }
  panel.remove(); blocker.remove(); if (fromEl) fromEl.classList.remove('is-pressed');
  S.busy = false; schedule();
  const f = bvl.querySelector('[data-act="back"]'); if (f && document.activeElement && document.activeElement !== document.body) f.focus({preventScroll: true});
}
async function closeBrand(opts = {}) {
  if (!S.bv || (S.busy && !opts.force)) return;
  const id = S.bv.brand, ctx = S.bv.ctx, b = brandById(id);
  S.busy = true;
  const landTab = ctx; S.bv = null;
  const changed = landTab !== S.tab; S.tab = landTab; S.screen = 'home';
  if (opts.reset) { S.tab = 'overall'; }
  S.selected = opts.reset ? null : id;
  renderBase({noGrow: true, top: !!opts.reset});
  base.inert = true;
  let rowEl = opts.reset ? null : base.querySelector(`.lb-row[data-brand="${CSS.escape(id)}"]`);
  if (rowEl && changed) rowEl.scrollIntoView({block: 'center'});
  if (reduced() || opts.instant || !rowEl) {
    if (!opts.instant) await anim(bvl, [{opacity: 1}, {opacity: 0}], {duration: 200, easing: 'linear'});
  } else {
    const panel = takeoverEl(b); panel.style.opacity = '0'; ovl.appendChild(panel);
    await anim(panel, [{opacity: 0}, {opacity: 1}], {duration: 200, easing: 'linear'});
    bvl.hidden = true;
    const r = rowEl.querySelector('.tile').getBoundingClientRect();
    await anim(panel, [{transform: 'none', borderRadius: '0px', opacity: 1}, {transform: rectTransform(r), borderRadius: '12px', opacity: .6}], {duration: 300, easing: 'cubic-bezier(.2,0,0,1)'});
    panel.remove();
  }
  bvl.getAnimations().forEach(a => a.cancel());
  bvl.hidden = true; bvl.innerHTML = ''; base.inert = false; S.busy = false;
  if (rowEl) { rowEl.focus({preventScroll: true}); setTimeout(() => { rowEl.classList.remove('is-selected'); if (S.selected === id) S.selected = null; }, 1500 * TS); }
  schedule();
}
function go(screen) {
  if (S.bv) { S.bv = null; renderBV(); }
  S.sortOpen = false;
  if (screen === 'how' && S.screen !== 'how') { S.howBack = S.screen; S.howPage = 0; }
  if (screen === 'home') { S.tab = 'overall'; S.scroll.overall = 0; }
  S.screen = screen; renderBase({top: screen === 'home'});
  const h = base.querySelector('h1'); if (h) { h.tabIndex = -1; }
}
function setTab(id, opts = {}) {
  if (!tabs().some(t => t.id === id)) return;
  saveScroll(); S.tab = id; S.screen = 'home'; S.sortOpen = false; renderBase({crossfade: true, tabIntoView: true});
  if (opts.focus) { const t = base.querySelector(`.tab[data-tab="${CSS.escape(id)}"]`); t && t.focus(); }
}
function setSort(sid) {
  const sc = document.getElementById('scroller'), old = {};
  base.querySelectorAll('#rows .lb-row').forEach(el => { old[el.dataset.brand] = {top: el.getBoundingClientRect().top, w: (el.querySelector('.lb-bar') || {}).offsetWidth}; });
  S.sort[S.tab] = sid; renderBase({noGrow: true});
  const sb = base.querySelector('.sortbtn'); if (sb) sb.focus({preventScroll: true});
  if (reduced()) { const rows = document.getElementById('rows'); rows && rows.animate([{opacity: 0}, {opacity: 1}], {duration: 200}); return; }
  base.querySelectorAll('#rows .lb-row').forEach(el => {
    const o = old[el.dataset.brand]; if (!o) return;
    const dy = o.top - el.getBoundingClientRect().top;
    if (dy) el.animate([{transform: `translateY(${dy}px)`}, {transform: 'none'}], {duration: 300 * TS, easing: 'cubic-bezier(.2,0,0,1)'});
    const bar = el.querySelector('.lb-bar'); if (bar && o.w != null) bar.animate([{width: o.w + 'px'}, {width: bar.offsetWidth + 'px'}], {duration: 300 * TS, easing: 'cubic-bezier(.2,0,0,1)'});
  });
  void sc;
}
function back() {
  if (S.bv) {
    if (S.bv.report) { S.bv.report = null; renderBV(); return; }
    return closeBrand();
  }
  if (S.screen === 'how') { S.screen = S.howBack === 'how' ? 'home' : S.howBack; return renderBase(); }
  if (S.screen === 'about') { S.screen = 'home'; return renderBase(); }
}
function setCtx(ctx) { if (!S.bv) return; S.bv.ctx = ctx; S.bv.open = null; S.bv.report = null; S.bv.deck = S.bv.deck === 'response' ? 'response' : S.bv.deck;
  renderBV(); if (!reduced()) bvl.querySelector('.bv').animate([{opacity: .3}, {opacity: 1}], {duration: 200 * TS}); const c = bvl.querySelector(`.chip[data-ctx="${CSS.escape(ctx)}"]`); c && c.focus({preventScroll: true}); }

/* ---------- idle: 90 s → "Still looking?" 10 s → reset → (pristine home) 60 s → Attract ---------- */
let idleT = null, cdT = null;
const idle = () => Object.assign({promptAfterSec: 90, countdownSec: 10, attractAfterSec: 60}, D.settings && D.settings.idle);
function pristine() { const sc = document.getElementById('scroller'); return S.screen === 'home' && !S.bv && S.tab === 'overall' && sortOf('overall') === 'total' && (!sc || sc.scrollTop < 2); }
function schedule() {
  clearTimeout(idleT); idleT = null;
  if (S.attract || S.modal || S.busy) return;
  if (S.staff) { idleT = setTimeout(() => { closeStaff(); resetAll(); }, idle().promptAfterSec * 1000); return; }
  if (pristine()) idleT = setTimeout(showAttract, idle().attractAfterSec * 1000);
  else idleT = setTimeout(showModal, idle().promptAfterSec * 1000);
}
function activity() { if (S.modal || S.attract) return; schedule(); }
function showModal() {
  if (S.attract || S.busy) return;
  const total = idle().countdownSec; S.modal = {left: total};
  const r = 74, C = 2 * Math.PI * r;
  const el = document.createElement('div'); el.className = 'scrim'; el.id = 'still';
  el.innerHTML = `<div class="card modal" role="alertdialog" aria-modal="true" aria-labelledby="sl-h" aria-describedby="sl-l">
    <h2 class="serif" id="sl-h">Still looking?</h2>
    <div class="ring" aria-hidden="true"><svg viewBox="0 0 168 168"><circle cx="84" cy="84" r="${r}" fill="none" stroke="#DEDAD2" stroke-width="10"/>
      <circle class="prog" cx="84" cy="84" r="${r}" fill="none" stroke="#3A9A6E" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0" transform="rotate(-90 84 84)"/></svg><div class="n num">${total}</div></div>
    <div class="line" id="sl-l"></div>
    <div class="btns"><button class="btn primary" data-act="keep" aria-label="Keep looking, button.">Keep looking</button>
      <button class="btn" data-act="startover" aria-label="Start over, button. Returns to the Overall Ranking.">Start over</button></div>
    <div class="hint">Or tap anywhere to keep going.</div></div>`;
  ovl.appendChild(el); base.inert = true; bvl.inert = true;
  const upd = () => { const s = S.modal.left; el.querySelector('.ring .n').textContent = s;
    el.querySelector('.line').innerHTML = `We'll start over in <b>${s}</b> ${s === 1 ? 'second' : 'seconds'}.`;
    el.querySelector('.prog').setAttribute('stroke-dashoffset', String(C * (1 - s / total)));
    if (s === total || s === 5) announce(`Still looking? We'll start over in ${s} seconds.`); };
  upd(); el.querySelector('[data-act="keep"]').focus({preventScroll: true});
  cdT = setInterval(() => { S.modal.left--; if (S.modal.left <= 0) { resetAll(); } else upd(); }, 1000);
}
function hideModal() { clearInterval(cdT); cdT = null; const el = document.getElementById('still'); el && el.remove(); S.modal = null; base.inert = !!S.bv; bvl.inert = false; }
function keepLooking() { hideModal(); schedule(); }
async function resetAll() {
  if (S.staff) { clearTimeout(staffT); closeStaffEl(); S.staff = null; pin = ''; }
  hideModal(); clearTimeout(idleT);
  S.sort = {}; S.scroll = {}; S.howPage = 0; S.selected = null; S.sortOpen = false;
  if (S.bv) { await closeBrand({reset: true, force: true, instant: reduced()}); }
  S.screen = 'home'; S.tab = 'overall'; S.bv = null; renderBV(); renderBase({top: true});
  const sc = document.getElementById('scroller'); if (sc) sc.scrollTop = 0;
  schedule();
}
function showAttract() {
  if (S.attract) return; S.attract = true; clearTimeout(idleT);
  const w = document.createElement('div'); w.innerHTML = attractHTML(); const a = w.firstElementChild; ovl.appendChild(a);
  base.inert = true;
  if (!reduced()) a.animate([{opacity: 0}, {opacity: 1}], {duration: 400 * TS});
}
function hideAttract() { const a = document.getElementById('attract'); a && a.remove(); S.attract = false; S.screen = 'home'; S.tab = 'overall'; renderBase({top: true}); base.inert = false; schedule(); }


/* ---------- hidden staff gesture (Lockdown, CLIENT.md): 5 quick taps in the top-left corner → PIN → staff menu ----------
   A PIN in a public JSON file is a light deterrent, not security. iPad Guided Access is the real lock. */
const CORNER = 72, EDGE = 20, TAPS = 5, WINDOW_MS = 3000;
let cornerTaps = [], staffT = null, pin = '';
const staffCfg = () => Object.assign({pin: '0000', pinPadTimeoutSec: 30, menuTimeoutSec: 60}, D.staff);
function inCorner(e) { return e.clientX <= CORNER && e.clientY <= CORNER; }
function cornerTap(e) {
  let btn = e.target.closest && e.target.closest('button');
  // ‹ Back sits partly inside the corner zone. A tap on it in the outer 20px edge (incl. iOS retargeting a near-miss onto it)
  // counts toward the gesture and is swallowed; a tap on the rest of Back works as Back.
  if (btn && btn.dataset.act === 'back' && (e.clientX <= EDGE || e.clientY <= EDGE)) btn = null;
  // v2: the wordmark (= Home) sits under the corner zone on the leaderboard. Inside the 72px corner it counts toward the gesture and its
  // click is swallowed, so Home never fires during the gesture (spec-v2 §2); the rest of the wordmark still works as Home.
  if (btn && btn.classList.contains('wmbtn')) btn = null;
  if (btn && btn.id !== 'attract') return false;          // any other real button keeps working normally
  const now = Date.now(); cornerTaps = cornerTaps.filter(t => now - t < WINDOW_MS); cornerTaps.push(now);
  if (cornerTaps.length >= TAPS) { cornerTaps = []; openPinPad(); }
  return !btn;                                             // swallow taps on non-buttons; attract still dismisses
}
function staffTimer(sec) { clearTimeout(staffT); staffT = setTimeout(closeStaff, sec * 1000); }
function closeStaff() { clearTimeout(staffT); staffT = null; const el = document.getElementById('staff'); el && el.remove(); S.staff = null; pin = '';
  base.inert = !!S.bv || S.attract; bvl.inert = false; schedule(); }
function staffShell(inner, label) {
  closeStaffEl(); const el = document.createElement('div'); el.className = 'scrim staff'; el.id = 'staff';
  el.innerHTML = `<div class="card modal staffcard" role="dialog" aria-modal="true" aria-label="${label}">${inner}</div>`;
  ovl.appendChild(el); base.inert = true; bvl.inert = true; return el;
}
function closeStaffEl() { const el = document.getElementById('staff'); el && el.remove(); }
function openPinPad() {
  if (S.busy) return; if (S.modal) hideModal();
  S.staff = 'pin'; pin = '';
  const keys = ['1','2','3','4','5','6','7','8','9','clear','0','del'];
  const el = staffShell(`<h2 class="serif">Staff only</h2><div class="pinmsg" id="pinmsg">Enter the 4-digit staff PIN.</div>
    <div class="pindots" aria-hidden="true">${'<i></i>'.repeat(4)}</div>
    <div class="pinpad">${keys.map(k => k === 'clear' ? `<button class="key small" data-pin="clear">Clear</button>` : k === 'del' ? `<button class="key small" data-pin="del" aria-label="Delete">⌫</button>` : `<button class="key num" data-pin="${k}">${k}</button>`).join('')}</div>
    <div class="hint">Not staff? Tap Cancel to go back.</div><button class="btn" data-staff="close">Cancel</button>`, 'Staff PIN');
  el.querySelector('[data-pin="1"]').focus({preventScroll: true});
  staffTimer(staffCfg().pinPadTimeoutSec); schedule();
}
function pinKey(k) {
  staffTimer(staffCfg().pinPadTimeoutSec);
  if (k === 'clear') pin = ''; else if (k === 'del') pin = pin.slice(0, -1); else if (pin.length < 4) pin += k;
  const dots = document.querySelectorAll('#staff .pindots i'); dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
  if (pin.length === 4) {
    if (pin === String(staffCfg().pin)) { pin = ''; openStaffMenu(); }
    else { pin = ''; setTimeout(() => dots.forEach(d => d.classList.remove('on')), 250);
      const m = document.getElementById('pinmsg'); m.textContent = "That PIN didn't match. Please try again."; m.classList.add('err'); announce(m.textContent); }
  }
}
function openStaffMenu(versionShown) {
  S.staff = 'menu';
  const el = staffShell(`<h2 class="serif">Staff menu</h2>
    <div class="btns"><button class="btn primary" data-staff="reload">Reload</button><button class="btn" data-staff="attract">Show welcome screen</button>
    <button class="btn" data-staff="version">Show version</button><button class="btn" data-staff="close">Close</button></div>
    <div class="hint" id="staffver" ${versionShown ? '' : 'hidden'}>Data version: ${esc(D.version || '1.0.0')}</div>`, 'Staff menu');
  el.querySelector('[data-staff="reload"]').focus({preventScroll: true});
  staffTimer(staffCfg().menuTimeoutSec); schedule();
}
function staffAct(a) {
  staffTimer(staffCfg().menuTimeoutSec);
  if (a === 'close') return closeStaff();
  if (a === 'reload') { closeStaff(); return location.reload(); }
  if (a === 'version') { const v = document.getElementById('staffver'); v.hidden = false; return announce(v.textContent); }
  if (a === 'attract') { closeStaff(); return resetAll().then(showAttract); }
}

/* ---------- input ---------- */
function onClick(e) {
  queueMicrotask(schedule);                                 // state may have changed: restart the right idle timer
  if (swallowClick) { swallowClick = false; e.preventDefault(); e.stopPropagation(); return; }
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.pin) return pinKey(t.dataset.pin);
  if (t.dataset.staff) return staffAct(t.dataset.staff);
  if (t.id === 'attract') return hideAttract();
  if (S.busy) return;
  const act = t.dataset.act;
  if (act === 'keep') return keepLooking();
  if (act === 'startover') return resetAll();
  if (act === 'home') return go('home');
  if (act === 'how') return go('how');
  if (act === 'about') return go('about');
  if (act === 'back') return back();
  if (act === 'close') return closeBrand();
  if (act === 'how-prev') { S.howPage = Math.max(0, S.howPage - 1); return renderBase(); }
  if (act === 'how-next') { S.howPage = Math.min(2, S.howPage + 1); return renderBase(); }
  if (act === 'report-back') { S.bv.report = null; return renderBV(); }
  if (t.dataset.tab) return setTab(t.dataset.tab);
  if (act === 'sortmenu') { S.sortOpen = !S.sortOpen; renderBase({noGrow: true}); const f = base.querySelector(S.sortOpen ? '.sortmenu [aria-checked="true"]' : '.sortbtn'); f && f.focus({preventScroll: true}); return; }
  if (act === 'sortclose') { S.sortOpen = false; renderBase({noGrow: true}); const sb = base.querySelector('.sortbtn'); sb && sb.focus({preventScroll: true}); return; }
  if (t.dataset.sort) { S.sortOpen = false; return setSort(t.dataset.sort); }
  if (t.classList.contains('pick')) return openBrand(t.dataset.brand, S.tab, t);
  if (t.classList.contains('lb-row')) return openBrand(t.dataset.brand, S.tab, t);
  if (t.dataset.deck) { S.bv.deck = t.dataset.deck; S.bv.report = null; renderBV(); const d = bvl.querySelector(`[data-deck="${t.dataset.deck}"]`); d && d.focus({preventScroll: true}); return; }
  if (t.dataset.ctx) return setCtx(t.dataset.ctx);
  if (t.dataset.sec) { S.bv.open = S.bv.open === t.dataset.sec ? null : t.dataset.sec; S.bv.keepScroll = true; renderBV(); const s = bvl.querySelector(`[data-sec="${t.dataset.sec}"]`); if (s) { s.focus({preventScroll: true}); s.scrollIntoView({block: 'nearest'}); } return; }
  if (t.dataset.report) { S.bv.report = t.dataset.report; renderBV(); const rp = document.getElementById('report');
    if (rp && !reduced()) rp.animate([{transform: 'translateX(60px)', opacity: 0}, {transform: 'none', opacity: 1}], {duration: 250 * TS, easing: 'cubic-bezier(.2,0,0,1)'});
    const bb = bvl.querySelector('[data-act="report-back"]'); bb && bb.focus({preventScroll: true}); return; }
}
/* swipe: left/right on the list changes tab (direction-locked); left/right on How we rank pages; down on the brand hero closes */
let sw = null, swallowClick = false;
function onDown(e) {
  if (S.staff) { staffTimer(S.staff === 'pin' ? staffCfg().pinPadTimeoutSec : staffCfg().menuTimeoutSec); return; }
  if (!S.modal && inCorner(e) && cornerTap(e)) { e.preventDefault(); swallowClick = true; setTimeout(() => { swallowClick = false; }, 400); sw = null; return; }
  if (S.modal) { if (!e.target.closest('[data-act]')) { e.preventDefault(); keepLooking(); swallowClick = true; setTimeout(() => { swallowClick = false; }, 400); } return; }
  if (S.attract) return;
  activity();
  const zone = e.target.closest('#scroller') ? 'list' : e.target.closest('#hw') ? 'how' : e.target.closest('.hero,.bvl .titlebar') ? 'bv' : null;
  sw = zone ? {zone, x: e.clientX, y: e.clientY, t: Date.now(), lock: null} : null;
}
function onMove(e) {
  if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (!sw.lock && Math.hypot(dx, dy) > 12) sw.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
}
function onUp(e) {
  if (!sw) return; const s = sw; sw = null; const dx = e.clientX - s.x, dy = e.clientY - s.y;
  if (s.lock === 'x' && Math.abs(dx) > 70 && Date.now() - s.t < 800) {
    swallowClick = true; setTimeout(() => { swallowClick = false; }, 350);
    if (s.zone === 'list') { const t = tabs(), i = t.findIndex(x => x.id === S.tab), j = i + (dx < 0 ? 1 : -1); if (j >= 0 && j < t.length) setTab(t[j].id); }
    if (s.zone === 'how') { S.howPage = Math.max(0, Math.min(2, S.howPage + (dx < 0 ? 1 : -1))); renderBase(); }
  } else if (s.zone === 'bv' && s.lock === 'y' && dy > 140 && Math.abs(dx) < 80) {
    const h = bvl.querySelector('.hero'); if (!h || h.scrollTop < 2) { swallowClick = true; setTimeout(() => { swallowClick = false; }, 350); closeBrand(); }
  }
}
function onKey(e) {
  if (S.staff) { if (e.key === 'Escape') closeStaff(); else if (S.staff === 'pin' && /^[0-9]$/.test(e.key)) { e.preventDefault(); pinKey(e.key); } else if (S.staff === 'pin' && e.key === 'Backspace') pinKey('del'); return; }
  if (S.attract) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hideAttract(); } return; }
  if (S.modal) { if (e.key === 'Escape') keepLooking(); else activity(); return; }
  activity();
  if (e.key === 'Escape' && S.sortOpen && !S.bv) { e.preventDefault(); S.sortOpen = false; renderBase({noGrow: true}); const sb = base.querySelector('.sortbtn'); sb && sb.focus({preventScroll: true}); return; }
  if (e.key === 'Escape' && S.bv && !S.busy) { e.preventDefault(); back(); }
  const tab = e.target.closest && e.target.closest('.tabs .tab');
  if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    e.preventDefault(); const t = tabs(), i = t.findIndex(x => x.id === tab.dataset.tab), j = (i + (e.key === 'ArrowRight' ? 1 : -1) + t.length) % t.length; setTab(t[j].id, {focus: true});
  }
}

/* ---------- data check (console.warn only; tools/validate_data.py is the strict version) ---------- */
function check() {
  const warn = m => console.warn('[site-data] ' + m), naOK = (D.settings && D.settings.naAllowedSections) || ['rebate'];
  for (const b of D.brands) {
    if (!b.chartColor) warn(`${b.name}: no chartColor`);
    for (const c of Object.keys(b.scores || {})) {
      if (!b.categories.includes(c)) warn(`${b.name}: scored in ${c}, which it does not make (ignored)`);
      for (const [sid, v] of Object.entries(b.scores[c])) if (v.na && !naOK.includes(sid)) warn(`${b.name}/${c}: N/A not allowed on ${sid}`);
    }
  }
}

/* ---------- boot ---------- */
function boot(data) {
  D = data; check(); ensureLayers(); renderBase({top: true});
  app.addEventListener('click', onClick);
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('pointerup', onUp, true);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('wheel', activity, {passive: true, capture: true});
  document.addEventListener('scroll', e => { activity(); if (e.target.classList && e.target.classList.contains('tabs')) updateTabFade(); if (e.target.matches && e.target.matches('.hero,.hcard,.about,.other,.picks,.scroller')) updateFades(e.target.parentNode); }, true);
  document.addEventListener('contextmenu', e => e.preventDefault());
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), {passive: false}));
  document.addEventListener('touchmove', e => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, {passive: false});   // pinch
  let lastTouchEnd = 0;
  document.addEventListener('touchend', e => { const now = Date.now(); if (now - lastTouchEnd < 350 && e.cancelable && !e.target.closest('button')) e.preventDefault(); lastTouchEnd = now; }, {passive: false}); // double-tap zoom
  document.addEventListener('selectstart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault(), {passive: false});
  document.addEventListener('dragstart', e => e.preventDefault());
  window.addEventListener('resize', () => { updateTabFade(); updateFades(); if (base) fitHead(); placeWall(); });
  if (QD('tab') && tabs().some(t => t.id === QD('tab'))) { S.tab = QD('tab'); if (QD('sort')) S.sort[S.tab] = QD('sort'); if (QD('menu')) S.sortOpen = true; renderBase({top: true}); }   // mockup deep links (local preview only)
  RM.addEventListener && RM.addEventListener('change', () => { WALL.key = ''; placeWall(); });   // Reduce Motion toggled live: rebuild the wall static or moving
  schedule();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
const ready = fetch('data/site-data.json', {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error('data ' + r.status); return r.json(); })
  .then(d => document.fonts.ready.then(() => d)).then(d => { boot(d); return true; });
window.SCR = {ready, state: S, get data() { return D; }, board: (c, s) => board(c, s).rated.map(r => ({brand: r.brand.id, score: r.score, e: r.e, p: r.p, rank: r.rank, key: r.key, na: !!r.na})),
  pending: c => board(c).pending.map(r => r.brand.id), cell: (b, c) => { const r = cell(brandById(b), c); return r && {e: r.e, p: r.p, score: r.score, na: !!r.na, pending: r.pending || null}; },
  overall: b => { const o = overall(brandById(b)); return {e: o.e, p: o.p, n: o.n, score: o.score}; }, picks: c => picksFor(c), halfUp, version: () => D.version};
})();
