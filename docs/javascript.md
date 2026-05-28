# JavaScript — structuur en werking

## Overzicht

De JavaScript is opgesplitst in losse bundels per feed type. Elke pagina laadt alleen wat hij nodig heeft: geen mapbox-code op receptpagina's, geen timer-code op activiteitenpagina's.

```
src/js/
├── core.js                        ← altijd geladen op elke pagina
├── feeds/                         ← één bestand per feed type (automatisch gebundeld)
│   ├── activity.js                ← alleen op activiteit-pagina's
│   ├── poi.js                     ← alleen op POI-kaart-pagina's
│   └── recipe.js                  ← alleen op recept-pagina's
└── modules/
    ├── site/                      ← globale site-functies (gebruikt door core.js)
    │   ├── clock.js               ← klok in Europe/Amsterdam timezone
    │   ├── darkmode.js            ← thema-schakelaar (nog niet in gebruik)
    │   ├── debug.js               ← logging helpers (alleen in development)
    │   ├── email-link.js          ← e-mailadres bouwen op runtime
    │   ├── switch-text.js         ← wisselende tekst (bijv. locatienaam)
    │   ├── transitions.js         ← pagina-overgangen (enter/leave animaties)
    │   ├── twemoji.js             ← emoji naar SVG omzetten
    │   └── variables.js           ← CSS custom properties bijwerken (--vh, --scrollbar, ...)
    ├── mapbox/                    ← kaartfunctionaliteit
    │   ├── load-mapbox.js         ← Mapbox GL JS lazy laden
    │   ├── polyline.js            ← polyline encode/decode
    │   ├── activity/              ← activiteitskaart (Strava routes)
    │   │   ├── index.js           ← publieke API (exporteert initActivityMaps)
    │   │   ├── lifecycle.js       ← kaart initialisatie en animatie
    │   │   ├── constants.js       ← thema's, routebreedte
    │   │   ├── data.js            ← stream data + Mapbox token ophalen
    │   │   ├── palette.js         ← snelheidskleur berekening
    │   │   ├── stream.js          ← Strava stream decoderen + snelheid
    │   │   ├── privacy.js         ← privacyzones uit route filteren
    │   │   ├── route-layers.js    ← Mapbox layers aanmaken/updaten
    │   │   ├── fit.js             ← kaartbounds berekenen
    │   │   └── theme.js           ← licht/donker basemap stijl
    │   └── poi/                   ← POI-kaart (points of interest)
    │       ├── index.js           ← publieke API (exporteert initPoiMaps)
    │       ├── lifecycle.js       ← kaart + lijst initialisatie
    │       ├── constants.js       ← clustering, zoomniveaus
    │       ├── data.js            ← POI data uit DOM lezen
    │       ├── fit.js             ← kaartbounds + padding
    │       ├── icons.js           ← categorie-iconen
    │       └── marker-images.js   ← marker SVG's voor Mapbox
    └── recipe/                    ← recept-functionaliteit
        ├── index.js               ← ingrediënten schalen + Wake Lock kookmodus
        └── timer/                 ← kooktimers (persistent via localStorage)
            ├── index.js           ← publieke API (exporteert initTimer)
            ├── lifecycle.js       ← timer-orchestratie
            ├── store.js           ← timer state (localStorage)
            ├── ui.js              ← inline timer-weergave in DOM
            ├── links.js           ← timer: links parsen en koppelen
            ├── alarm.js           ← geluid via Web Audio API
            └── notify.js          ← browsernotificatie bij aflopen
```

---

## Hoe bundeling werkt

esbuild bundelt de bestanden op basis van entry points. Elke entry point wordt een aparte `.js` file in `_site/js/`.

```
src/js/core.js          →  _site/js/core.js
src/js/feeds/activity.js  →  _site/js/feeds/activity.js
src/js/feeds/poi.js       →  _site/js/feeds/poi.js
src/js/feeds/recipe.js    →  _site/js/feeds/recipe.js
```

De build scripts in `package.json` gebruiken een shell glob voor `feeds/`:

```bash
esbuild src/js/core.js 'src/js/feeds/*.js' --outbase=src/js --outdir=_site/js --bundle
```

**Elk nieuw bestand in `src/js/feeds/` wordt automatisch een aparte bundle.** Je hoeft `package.json` niet te wijzigen.

---

## Hoe scripts worden geladen

`base.njk` laadt `core.js` altijd:

```html
<script src="/js/core.js?v=..." defer></script>
```

Feed-type partials injecteren hun eigen script onderaan het template:

| Template | Script |
|---|---|
| `feed/types/activity.njk` | `/js/feeds/activity.js` |
| `feed/types/poi.njk` | `/js/feeds/poi.js` |
| `feed/types/recipe.njk` | `/js/feeds/recipe.js` |

---

## Een nieuw feed type toevoegen

1. **Maak `src/js/feeds/[type].js` aan** — dit is de entry point voor dit type.
   Importeer modules uit `../modules/` en initialiseer op `DOMContentLoaded`.

2. **Voeg het script toe aan het Nunjucks-partial** (`src/includes/partials/feed/types/[type].njk`):
   ```html
   <script src="/js/feeds/[type].js?v={% cacheBuster %}" defer></script>
   ```

3. **Dat is het.** De build pikt het bestand automatisch op via de glob in `package.json`.

---

## debug.js

Alle `log()` en `warn()` aanroepen worden alleen in de **development build** uitgevoerd (`NODE_ENV=development`). In productie worden ze weggecompileerd door esbuild.

```js
import { log, warn, error } from '../site/debug.js';

log('Bericht'); // alleen zichtbaar in dev
```

---

## Data-attributen overzicht

| Attribuut | Gebruikt door | Doel |
|---|---|---|
| `data-mapbox-activity` | `feeds/activity.js` | Trigger kaart-initialisatie |
| `data-mapbox-poi` | `feeds/poi.js` | Trigger POI-kaart-initialisatie |
| `data-recipe` | `modules/recipe/index.js` | Basis-aantal personen |
| `data-recipe-serves` | `modules/recipe/index.js` | Weergave huidige personen |
| `data-recipe-minus/plus` | `modules/recipe/index.js` | Schaalknoppen |
| `data-recipe-amount` | `modules/recipe/index.js` | Basis-hoeveelheid ingrediënt |
| `data-recipe-wakelock` | `modules/recipe/index.js` | Kookmodus schakelaar |
| `data-js="clock"` | `modules/site/clock.js` | Klok weergave |
| `data-js="email"` | `modules/site/email-link.js` | E-mail trigger |
| `data-js="switch"` | `modules/site/switch-text.js` | Wisselende tekst |
| `a[href^="timer:"]` | `modules/recipe/timer/links.js` | Timer starten via link |
