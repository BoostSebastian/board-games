// Hämtar metadata från BoardGameGeeks XML API2 och uppdaterar games.json.
//
//   BGG_TOKEN=xxxx node scripts/bgg-sync.mjs
//
// BGG kräver sedan 2025 en registrerad applikation och en API-token
// (https://boardgamegeek.com/applications). Utan token avbryts skriptet.
//
// För varje spel:
//   1. saknas "bgg" (BGG-id) söks spelet upp på namn och id:t sparas
//   2. min/max spelare, bästa antal (communityns röstning), vikt, speltid,
//      år, betyg, länk till omslaget (imageUrl) och om spelet är kooperativt hämtas.
//      Bilden sparas inte i repot, appen visar den direkt från BGG när man trycker på spelet.
// Namn, typ och anmärkning rörs aldrig.

import { readFile, writeFile } from 'node:fs/promises';

const TOKEN = process.env.BGG_TOKEN;
const FILE = new URL('../games.json', import.meta.url);
const API = 'https://boardgamegeek.com/xmlapi2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!TOKEN) {
  console.error('BGG_TOKEN saknas. Se README → "Uppdatera från BoardGameGeek".');
  process.exit(1);
}

async function get(path, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${API}/${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (res.status === 200) return res.text();
    if (res.status === 202 || res.status === 429 || res.status >= 500) { await sleep(3000 * (i + 1)); continue; }
    throw new Error(`BGG ${res.status} för ${path}`);
  }
  throw new Error(`BGG svarade inte för ${path}`);
}

const attr = (xml, tag, name = 'value') => {
  const m = xml.match(new RegExp(`<${tag}\\b[^>]*\\b${name}="([^"]*)"`));
  return m ? m[1] : null;
};
const num = (v) => (v == null || v === '' || isNaN(+v) ? null : +v);
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// Söker upp ett BGG-id. Försöker exakt namn först, sedan fritext.
async function findId(name) {
  const q = encodeURIComponent(name.replace(/\s*\(.*?\)/g, '').replace(/–.*$/, '').trim());
  for (const exact of [1, 0]) {
    const xml = await get(`search?query=${q}&type=boardgame,boardgameexpansion&exact=${exact}`);
    const ids = [...xml.matchAll(/<item [^>]*id="(\d+)"/g)].map((m) => +m[1]);
    if (ids.length) return ids[0];
    await sleep(1500);
  }
  return null;
}

// "Best with 3–4 players" → "3-4"
function bestFrom(item) {
  const m = item.match(/<result name="bestwith" value="Best with ([^"]+?) players?"/);
  if (!m) return null;
  return m[1].replace(/[–—]/g, '-').replace(/\s/g, '').replace(/,/g, '-').replace(/-+/g, '-');
}

function parseThing(item) {
  return {
    id: +attr(item, 'item', 'id'),
    name: decode(attr(item, 'name') || ''),
    year: num(attr(item, 'yearpublished')),
    min: num(attr(item, 'minplayers')),
    max: num(attr(item, 'maxplayers')),
    time: num(attr(item, 'playingtime')),
    weight: num(attr(item, 'averageweight')),
    rating: num(attr(item, 'average')),
    best: bestFrom(item),
    imageUrl: (item.match(/<image>\s*([^<]+?)\s*<\/image>/) || [])[1] || null,
    coop: /<link type="boardgamemechanic" id="2023"/.test(item),
  };
}

const raw = JSON.parse(await readFile(FILE, 'utf8'));
const games = Array.isArray(raw) ? raw : raw.games;

let found = 0;
for (const g of games) {
  if (g.bgg) continue;
  const id = await findId(g.name);
  if (id) { g.bgg = id; found++; console.log(`id  ${g.name} → ${id}`); }
  else console.warn(`??  hittade inte ${g.name}`);
  await sleep(1500);
}

const ids = [...new Set(games.map((g) => g.bgg).filter(Boolean))];
const byId = new Map();
for (let i = 0; i < ids.length; i += 20) {
  const xml = await get(`thing?id=${ids.slice(i, i + 20).join(',')}&stats=1`);
  for (const m of xml.matchAll(/<item [\s\S]*?<\/item>/g)) {
    const t = parseThing(m[0]);
    byId.set(t.id, t);
  }
  await sleep(2000);
}

let updated = 0;
for (const g of games) {
  const t = byId.get(g.bgg);
  if (!t) continue;
  for (const k of ['min', 'max', 'time', 'year']) if (t[k]) g[k] = t[k];
  if (t.weight) g.weight = Math.round(t.weight * 10) / 10;
  if (t.rating) g.rating = Math.round(t.rating * 10) / 10;
  if (t.best) g.best = t.best;
  if (t.imageUrl) g.imageUrl = t.imageUrl;
  if (t.coop) g.coop = true; // manuellt satta coop-flaggor tas aldrig bort
  updated++;
}

const out = { syncedAt: new Date().toISOString(), games };
await writeFile(FILE, JSON.stringify(out, null, 1) + '\n');
console.log(`Klart: ${found} nya BGG-id, ${updated} av ${games.length} spel uppdaterade.`);
