# Spelhyllan

En webbapp (PWA) för brädspelssamlingen. Den fungerar i mobilen och på datorn, kan installeras på hemskärmen och fungerar offline.

- **Filter** på antal spelare, vikt (1 lätt – 5 tung), speltid och kategori
- **Bäst med**: visa bara spel som BGG-communityn tycker är bäst med valt antal spelare
- **Slumpa**: välj ett spel bland dem som matchar filtren
- **Sortering** på namn, vikt, speltid eller BGG-betyg
- **Expansioner** och **spel som ska säljas** är dolda som standard och kan visas under *Fler filter*
- **Kopiera som CSV** för att klistra in samlingen i Excel
- Varje spel länkar till sin sida på BoardGameGeek

## Publicera gratis med GitHub Pages

1. Repo → **Settings → Pages**
2. *Source*: **Deploy from a branch**, välj `main` och mappen `/ (root)`
3. Öppna `https://boostsebastian.github.io/board-games/` i mobilen
4. **iPhone:** Dela → *Lägg till på hemskärmen*. **Android:** menyn → *Installera app*

## Lägga till eller ändra spel

All data finns i [`games.json`](games.json). Lägg till ett spel direkt i GitHub (pennan uppe till höger):

```json
{
 "name": "Spelets namn",
 "type": "base",
 "min": 2, "max": 4, "best": "3", "weight": 2.1, "time": 45,
 "cat": "Familj",
 "bgg": 123456
}
```

| Fält | Betydelse |
| --- | --- |
| `name` | Namn |
| `type` | `base` (grundspel) eller `expansion` |
| `min`, `max` | Antal spelare |
| `best` | Bästa antal enligt BGG, t.ex. `"2"`, `"3-4"` eller `"10+"` |
| `weight` | Vikt 1–5 från BGG |
| `time` | Speltid i minuter |
| `cat` | Kategori (Strategi, Familj, Kortspel, Kooperativt, Party, Duell, Abstrakt, Roll & write, Deduktion …) |
| `bgg` | BGG-id, siffran i spelets adress på boardgamegeek.com (valfritt) |
| `note` | Anmärkning, t.ex. vilka expansioner som ingår (valfritt) |
| `forSale` | `true` om spelet ska säljas (valfritt) |

Har du `bgg` och en BGG-token (se nedan) räcker det med `name`, `type` och `bgg`. Resten fylls i automatiskt.

## Uppdatera från BoardGameGeek

BoardGameGeeks API kräver sedan 2025 en registrerad applikation, och det svarar inte direkt till webbläsare.
Därför hämtas datan i förväg av en GitHub Action och sparas i `games.json`. Appen behöver aldrig prata med BGG.

1. Logga in på BGG och registrera en applikation på <https://boardgamegeek.com/applications>. Godkännandet kan ta några dagar.
2. Skapa en token för applikationen.
3. Repo → **Settings → Secrets and variables → Actions → New repository secret**, namn `BGG_TOKEN`.
4. **Actions → Uppdatera från BoardGameGeek → Run workflow**.

Workflowen
- slår upp BGG-id för spel som saknar det,
- hämtar spelarantal, bästa antal, vikt, speltid, utgivningsår och betyg,
- committar `games.json` om något ändrats,
- körs dessutom automatiskt den första varje månad.

Namn, typ, anmärkningar och `forSale` ändras aldrig av synken. Kontrollera gärna att id:n som hittats automatiskt stämmer (tryck *BGG ↗* på spelet).

Köra lokalt: `BGG_TOKEN=… node scripts/bgg-sync.mjs`

## Köra lokalt

Ingen byggprocess behövs:

```sh
python3 -m http.server 8000
```

och öppna <http://localhost:8000>.

## Filer

| Fil | Innehåll |
| --- | --- |
| `index.html` | Sidan |
| `styles.css` | Utseende (mobil först, ljust/mörkt läge) |
| `app.js` | Filter, sortering, slumpa, CSV-export |
| `games.json` | Alla spel med metadata |
| `scripts/bgg-sync.mjs` | Hämtar data från BGG:s XML API2 |
| `.github/workflows/bgg-sync.yml` | Kör synken manuellt eller varje månad |
| `sw.js` | Service worker för offlinestöd |
| `manifest.webmanifest`, `icon*` | Gör appen installerbar |
