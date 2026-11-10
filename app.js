// Spelhyllan: läser games.json och låter dig filtrera på spelare, vikt, speltid och spelläge.
// Två vyer: lista och bokhylla. Tryck på ett spel för att se detaljer och omslag.
'use strict';

const $ = (id) => document.getElementById(id);
const st = {
  pl: 0, wt: '', tm: 0, md: '', q: '', cat: '', best: false, exp: false, sale: false,
  sort: 'name', pick: null, view: 'list',
};
let GAMES = [];

const PL = [['Alla', 0], ['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 6], ['7+', 7]];
const WT = [['Alla', ''], ['Lätt <2', 'l'], ['Medel 2–3', 'm'], ['Tung 3+', 'h']];
const TM = [['Alla', 0], ['≤30 min', 30], ['≤60 min', 60], ['≤90 min', 90], ['90+ min', -90]];
const MD = [['Alla', ''], ['🤝 Kooperativt', 'coop'], ['⚔️ Mot varandra', 'comp']];

// Ryggfärger när spelet inte har någon bild ännu (färgen tas annars från omslaget).
const PALETTE = ['#7a3b1d', '#2f4f6f', '#3d6b4a', '#6b3a5c', '#8a6d1f', '#1f5a5c', '#5b4a8a', '#8a2f2f', '#405060', '#6e5a3a'];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sv = (a, b) => a.localeCompare(b, 'sv');
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function store(k, v) { try { localStorage.setItem(k, v); } catch { /* privat läge */ } }
function load(k) { try { return localStorage.getItem(k); } catch { return null; } }

function chips(el, arr, key) {
  $(el).innerHTML = arr.map(([t, v]) => `<button class="c" type="button" data-v="${esc(v)}">${esc(t)}</button>`).join('');
  $(el).onclick = (e) => {
    const b = e.target.closest('.c');
    if (!b) return;
    const v = b.dataset.v;
    st[key] = v === '' || isNaN(+v) ? v : +v;
    st.pick = null;
    draw();
  };
}

// "2-3" → [2,3], "10+" → [10,99], "4" → [4,4]
function range(s) {
  if (!s) return null;
  if (s.endsWith('+')) return [+s.slice(0, -1), 99];
  const [a, b] = s.split('-').map(Number);
  return [a, b ?? a];
}

function match(g) {
  if (!st.exp && g.type === 'expansion') return false;
  if (!st.sale && g.forSale) return false;
  if (st.q && !`${g.name} ${g.note || ''} ${g.cat || ''}`.toLowerCase().includes(st.q)) return false;
  if (st.cat && g.cat !== st.cat) return false;
  if (st.md === 'coop' && !g.coop) return false;
  if (st.md === 'comp' && g.coop) return false;
  if ((st.pl || st.wt || st.tm) && g.weight == null) return false;
  if (st.pl) {
    const n = st.pl;
    if (n === 7 ? g.max < 7 : g.min > n || g.max < n) return false;
    if (st.best) {
      const r = range(g.best);
      if (!r || (n === 7 ? r[1] < 7 : n < r[0] || n > r[1])) return false;
    }
  }
  if (st.wt === 'l' && g.weight >= 2) return false;
  if (st.wt === 'm' && (g.weight < 2 || g.weight > 3)) return false;
  if (st.wt === 'h' && g.weight <= 3) return false;
  if (st.tm > 0 && g.time > st.tm) return false;
  if (st.tm < 0 && g.time < -st.tm) return false;
  return true;
}

function sorted(list) {
  const k = st.sort.replace('-', '');
  const d = st.sort.startsWith('-') ? -1 : 1;
  return [...list].sort((x, y) => {
    if (k === 'name') return sv(x.name, y.name);
    if (k === 'coop') return (y.coop ? 1 : 0) - (x.coop ? 1 : 0) || sv(x.name, y.name);
    const X = x[k], Y = y[k];
    if (X == null && Y == null) return sv(x.name, y.name);
    if (X == null) return 1;
    if (Y == null) return -1;
    return (X - Y) * d || sv(x.name, y.name);
  });
}

function bggUrl(g) {
  if (g.bgg) return `https://boardgamegeek.com/boardgame/${g.bgg}`;
  const q = g.name.replace(/\s*\(.*?\)/g, '');
  return `https://boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgame&q=${encodeURIComponent(q)}`;
}

const players = (g) => (g.min === g.max ? g.min : `${g.min}–${g.max}`);

function weightBar(w) {
  const f = Math.round(w);
  return `<span class="wt">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= f ? 'f' : ''}"></i>`).join('')}</span>`;
}

function tagsFor(g) {
  return [
    g.type === 'expansion' ? 'Expansion' : g.cat,
    g.coop && g.cat !== 'Kooperativt' ? 'Kooperativt' : null,
  ].filter(Boolean).map((t) => `<span class="tag">${esc(t)}</span>`).join(' ') +
    (g.forSale ? ' <span class="tag sale">Till salu</span>' : '');
}

function statsFor(g) {
  if (g.weight == null) return '<div class="stats"><span>Ingen BGG-data ännu</span></div>';
  return `<div class="stats">
    <span><b>${players(g)}</b> spelare <span class="best">(bäst ${esc(g.best)})</span></span>
    <span>${weightBar(g.weight)}<b>${g.weight.toFixed(1)}</b></span>
    <span><b>${g.time}</b> min</span>
    ${g.rating ? `<span>★ <b>${g.rating.toFixed(1)}</b></span>` : ''}
  </div>`;
}

// ---------- Listvy ----------

function card(g, i, pick) {
  return `<button class="card${pick ? ' pick' : ''}" type="button" data-i="${i}">
    ${g.image ? `<img class="thumb" src="${esc(g.image)}" alt="" loading="lazy">` : ''}
    <span class="body">
      <span class="head">
        <span class="name">${pick ? '🎲 ' : ''}${esc(g.name)}${g.year ? ` <span class="year">${g.year}</span>` : ''}</span>
        <span class="tags">${tagsFor(g)}</span>
      </span>
      ${statsFor(g)}
      ${g.note ? `<span class="foot">${esc(g.note)}</span>` : ''}
    </span>
  </button>`;
}

// ---------- Hyllvy ----------

function spineColor(g) {
  return g.color || PALETTE[hash(g.name) % PALETTE.length];
}

function textOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? '#1f1b17' : '#fbf8f3';
}

function spine(g, i, pick) {
  // Tyngre spel får tjockare och högre ryggar, så hyllan ser levande ut.
  const w = Math.min(g.weight ?? 2, 4.5);
  const h = Math.min(190, Math.round(116 + w * 13 + (hash(g.name) % 16)));
  const width = Math.round(26 + w * 6 + (g.type === 'expansion' ? -6 : 0));
  const bg = spineColor(g);
  const img = g.image ? `<img src="${esc(g.image)}" alt="" loading="lazy">` : '';
  return `<button class="spine${pick ? ' pick' : ''}${g.coop ? ' coop' : ''}" type="button" data-i="${i}"
      style="--h:${h}px;height:${h}px;width:${width}px;background:${bg};color:${textOn(bg)}" title="${esc(g.name)}">
    ${img}<span class="spine-name">${esc(g.name)}</span>
  </button>`;
}

// ---------- Detaljvy ----------

function openDetail(g) {
  const d = $('detail');
  $('detailBody').innerHTML = `
    ${g.image ? `<img class="cover" src="${esc(g.image)}" alt="Omslag: ${esc(g.name)}">`
      : `<div class="cover none" style="background:${spineColor(g)};color:${textOn(spineColor(g))}">${esc(g.name)}</div>`}
    <h2>${esc(g.name)}${g.year ? ` <span class="year">${g.year}</span>` : ''}</h2>
    <p class="tags">${tagsFor(g)}</p>
    ${statsFor(g)}
    ${g.note ? `<p class="dnote">${esc(g.note)}</p>` : ''}
    <a class="btn link" href="${bggUrl(g)}" target="_blank" rel="noopener">Öppna på BoardGameGeek ↗</a>`;
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
}

// ---------- Rita ----------

function draw() {
  for (const key of ['pl', 'wt', 'tm', 'md', 'cat']) {
    document.querySelectorAll(`#${key} .c`).forEach((b) => b.classList.toggle('on', String(st[key]) === b.dataset.v));
  }
  document.querySelectorAll('#views .c').forEach((b) => b.classList.toggle('on', b.dataset.v === st.view));

  const list = sorted(GAMES.filter(match));
  $('count').textContent = `${list.length} spel`;
  const pickIdx = st.pick ? list.findIndex((g) => g.name === st.pick) : -1;
  const empty = '<div class="empty">Inga spel matchar.</div>';

  if (st.view === 'shelf') {
    $('list').className = 'shelf';
    $('list').innerHTML = list.map((g, i) => spine(g, i, i === pickIdx)).join('') || empty;
  } else {
    $('list').className = 'cards';
    $('list').innerHTML = (pickIdx >= 0 ? card(list[pickIdx], pickIdx, true) : '') +
      (list.map((g, i) => card(g, i, false)).join('') || empty);
  }
  draw.last = list;
  if (pickIdx >= 0 && st.view === 'shelf') {
    document.querySelector('.spine.pick')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

function reset() {
  Object.assign(st, { pl: 0, wt: '', tm: 0, md: '', q: '', cat: '', best: false, exp: false, sale: false, pick: null });
  $('q').value = '';
  ['bestOnly', 'exp', 'sale'].forEach((i) => ($(i).checked = false));
  draw();
}

async function copyCsv(e) {
  const c = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = ['Spel;Typ;Kategori;Kooperativt;Min;Max;Bäst;Vikt;Minuter;BGG-betyg;Till salu;Anmärkning']
    .concat(GAMES.map((g) => [g.name, g.type === 'expansion' ? 'Expansion' : 'Grundspel', g.cat, g.coop ? 'Ja' : '',
      g.min, g.max, g.best, g.weight, g.time, g.rating, g.forSale ? 'Ja' : '', g.note].map(c).join(';')));
  try { await navigator.clipboard.writeText(rows.join('\n')); e.target.textContent = 'Kopierat!'; }
  catch { e.target.textContent = 'Gick inte att kopiera'; }
  setTimeout(() => (e.target.textContent = 'Kopiera som CSV'), 1800);
}

async function init() {
  chips('pl', PL, 'pl');
  chips('wt', WT, 'wt');
  chips('tm', TM, 'tm');
  chips('md', MD, 'md');
  st.view = load('view') === 'shelf' ? 'shelf' : 'list';

  const res = await fetch('games.json', { cache: 'no-cache' });
  const data = await res.json();
  GAMES = Array.isArray(data) ? data : data.games;
  if (data.syncedAt) $('synced').textContent = `Senast uppdaterat från BGG ${data.syncedAt.slice(0, 10)}.`;

  const cats = [...new Set(GAMES.map((g) => g.cat).filter(Boolean))].sort(sv);
  chips('cat', [['Alla', ''], ...cats.map((c) => [c, c])], 'cat');

  const base = GAMES.filter((g) => g.type === 'base' && !g.forSale).length;
  const exp = GAMES.filter((g) => g.type === 'expansion').length;
  const sale = GAMES.filter((g) => g.forSale).length;
  $('sub').textContent = `${base} spel · ${exp} expansioner · ${sale} till salu`;

  $('q').oninput = (e) => { st.q = e.target.value.toLowerCase().trim(); st.pick = null; draw(); };
  $('bestOnly').onchange = (e) => { st.best = e.target.checked; draw(); };
  $('exp').onchange = (e) => { st.exp = e.target.checked; draw(); };
  $('sale').onchange = (e) => { st.sale = e.target.checked; draw(); };
  $('sort').onchange = (e) => { st.sort = e.target.value; draw(); };
  $('mbtn').onclick = () => { const o = $('more').classList.toggle('open'); $('mbtn').classList.toggle('on', o); };
  $('views').onclick = (e) => {
    const b = e.target.closest('.c');
    if (!b) return;
    st.view = b.dataset.v;
    store('view', st.view);
    draw();
  };
  $('reset').onclick = reset;
  $('copy').onclick = copyCsv;
  $('list').onclick = (e) => {
    const b = e.target.closest('[data-i]');
    if (b && draw.last) openDetail(draw.last[+b.dataset.i]);
  };
  $('detail').addEventListener('click', (e) => { if (e.target === $('detail') || e.target.closest('.close')) $('detail').close(); });
  $('rnd').onclick = () => {
    const pool = (draw.last || []).filter((g) => g.type !== 'expansion');
    if (!pool.length) return;
    st.pick = pool[Math.floor(Math.random() * pool.length)].name;
    draw();
    if (st.view === 'list') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  draw();
}

init().catch((err) => {
  $('list').innerHTML = `<div class="empty">Kunde inte läsa games.json (${esc(err.message)}).</div>`;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
