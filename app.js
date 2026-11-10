// Spelhyllan: läser games.json och låter dig filtrera på spelare, vikt och speltid.
'use strict';

const $ = (id) => document.getElementById(id);
const st = { pl: 0, wt: '', tm: 0, q: '', cat: '', best: false, exp: false, sale: false, sort: 'name', pick: null };
let GAMES = [];

const PL = [['Alla', 0], ['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 6], ['7+', 7]];
const WT = [['Alla', ''], ['Lätt <2', 'l'], ['Medel 2–3', 'm'], ['Tung 3+', 'h']];
const TM = [['Alla', 0], ['≤30 min', 30], ['≤60 min', 60], ['≤90 min', 90], ['90+ min', -90]];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sv = (a, b) => a.localeCompare(b, 'sv');

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

function weightBar(w) {
  const f = Math.round(w);
  return `<span class="wt">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= f ? 'f' : ''}"></i>`).join('')}</span>`;
}

function card(g, pick) {
  const players = g.min === g.max ? g.min : `${g.min}–${g.max}`;
  const stats = g.weight != null
    ? `<div class="stats">
        <span><b>${players}</b> spelare <span class="best">(bäst ${esc(g.best)})</span></span>
        <span>${weightBar(g.weight)}<b>${g.weight.toFixed(1)}</b></span>
        <span><b>${g.time}</b> min</span>
        ${g.rating ? `<span>★ <b>${g.rating.toFixed(1)}</b></span>` : ''}
      </div>`
    : '<div class="stats"><span>Ingen BGG-data ännu</span></div>';
  const tags = [g.type === 'expansion' ? 'Expansion' : g.cat].filter(Boolean);
  return `<div class="card${pick ? ' pick' : ''}">
    <div class="head">
      <div class="name">${pick ? '🎲 ' : ''}${esc(g.name)}${g.year ? ` <span class="sub">(${g.year})</span>` : ''}</div>
      <span>${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ')}${g.forSale ? ' <span class="tag sale">Till salu</span>' : ''}</span>
    </div>
    ${stats}
    <div class="foot"><span>${esc(g.note || '')}</span><a href="${bggUrl(g)}" target="_blank" rel="noopener">BGG ↗</a></div>
  </div>`;
}

function draw() {
  for (const [el, key] of [['pl', 'pl'], ['wt', 'wt'], ['tm', 'tm'], ['cat', 'cat']]) {
    document.querySelectorAll(`#${el} .c`).forEach((b) => {
      const v = b.dataset.v;
      b.classList.toggle('on', String(st[key]) === v);
    });
  }
  const list = sorted(GAMES.filter(match));
  $('count').textContent = `${list.length} spel`;
  const picked = st.pick && list.find((g) => g.name === st.pick);
  $('list').innerHTML = (picked ? card(picked, true) : '') +
    (list.map((g) => card(g, false)).join('') || '<div class="empty">Inga spel matchar.</div>');
  draw.last = list;
}

function reset() {
  Object.assign(st, { pl: 0, wt: '', tm: 0, q: '', cat: '', best: false, exp: false, sale: false, pick: null });
  $('q').value = '';
  ['bestOnly', 'exp', 'sale'].forEach((i) => ($(i).checked = false));
  draw();
}

async function copyCsv(e) {
  const c = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = ['Spel;Typ;Kategori;Min;Max;Bäst;Vikt;Minuter;BGG-betyg;Till salu;Anmärkning']
    .concat(GAMES.map((g) => [g.name, g.type === 'expansion' ? 'Expansion' : 'Grundspel', g.cat, g.min, g.max, g.best,
      g.weight, g.time, g.rating, g.forSale ? 'Ja' : '', g.note].map(c).join(';')));
  try { await navigator.clipboard.writeText(rows.join('\n')); e.target.textContent = 'Kopierat!'; }
  catch { e.target.textContent = 'Gick inte att kopiera'; }
  setTimeout(() => (e.target.textContent = 'Kopiera som CSV'), 1800);
}

async function init() {
  chips('pl', PL, 'pl');
  chips('wt', WT, 'wt');
  chips('tm', TM, 'tm');

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
  $('reset').onclick = reset;
  $('copy').onclick = copyCsv;
  $('rnd').onclick = () => {
    const pool = (draw.last || []).filter((g) => g.type !== 'expansion');
    if (!pool.length) return;
    st.pick = pool[Math.floor(Math.random() * pool.length)].name;
    draw();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  draw();
}

init().catch((err) => {
  $('list').innerHTML = `<div class="empty">Kunde inte läsa games.json (${esc(err.message)}).</div>`;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
