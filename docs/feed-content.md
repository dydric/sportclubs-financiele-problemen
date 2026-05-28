# Feed content guide

Deze guide beschrijft de huidige, werkende opzet voor feed-items met:

- Strava activiteiten (`type: activity`)
- POI kaarten (`type: poi`)
- Albums
- Playlists

## 1) Activiteit (Strava)

Gebruik `type: activity` en zet in frontmatter alleen het activiteit-id:

```yaml
---
title: Ronde Friesland
date: 2026-02-24
type: activity
strava: 17483275548
---
Korte beschrijving van de rit.
```

Belangrijk:

- `strava` mag alleen het numerieke id zijn.
- De data-loader accepteert ook een volledige Strava URL in markdown tijdens scan, maar in frontmatter is alleen het id het meest betrouwbaar.
- Als activiteit niet in recente Strava lijst staat, wordt hij alsnog op id opgehaald via `stravaActivities.byId`.

Rendering gebeurt via:

- `src/includes/partials/feed/types/activity.njk`
- `src/includes/data/stravaActivities.js`

## 2) Album

Albumkaart via Apple URL (Spotify optioneel), met trackselectie:

```yaml
---
title: Luistertip
date: 2026-02-24
type: music
music:
  - apple: https://music.apple.com/nl/album/ijsland-2/1873335530
    spotify: https://open.spotify.com/album/1qwQoDUVZNAGP8g9vBoHug
    tracks: all
    favs: [2, 9]
---
```

`tracks` opties:

- `all` (tot max 25)
- lijst met tracknummers, bijvoorbeeld `[1, 4, 8]`

`favs` markeert favorieten op tracknummer of tracknaam.

## 3) Playlist

Playlist is expliciet `kind: playlist` met losse trackitems:

```yaml
---
title: Fijne Deuntjes
date: 2026-02-24
type: music
music:
  - kind: playlist
    title: Fijne Deuntjes
    description: Nieuwe selectie
    apple: https://music.apple.com/nl/playlist/fijne-deuntjes/pl.u-r8zkTj94dzr
    spotify: https://open.spotify.com/playlist/...
    cover: /assets/img/playlists/fijne-deuntjes.jpg
    tracks:
      - title: Prizefighter
        artist: Youth Lagoon
        apple: https://music.apple.com/nl/album/prizefighter/1848169870?i=1848169895
      - title: Flags
        artist: Syml
        apple: https://music.apple.com/nl/album/flags/1870313498?i=1870313502
---
```

Voor playlist-tracks geldt:

- `title` en `artist` helpen bij fallback matching.
- `apple` op trackniveau zorgt voor preview lookup.
- `preview` kan handmatig worden gezet als override.
- `note` toont extra tekst onder de track.

## 4) Recept

Gebruik `type: recipe` met een `recipe` object in de frontmatter:

```yaml
---
title: Asperge Carbonara
date: 2026-03-12
type: recipe
category: recepten
hidedate: true
recipe:
  serves: 4
  prep_time: 20 min
  cook_time: 15 min
  ingredients:
    - { name: groene asperges, amount: 250, unit: g }
    - { name: guanciale, amount: 250, unit: g }
    - { name: spaghetti, amount: 250, unit: g }
    - { name: eidooiers, amount: 5 }
    - { name: zout }
---
Intro tekst.

## Stappen

1. Eerste stap.
2. Kook gedurende [10–12 minuten](timer:11).
```

`recipe` velden:

- `serves` — standaard aantal personen (schaalbaar via +/− knoppen)
- `prep_time` / `cook_time` — vrije tekst, getoond in de meta-balk
- `ingredients` — lijst met objecten:
  - `name` — naam van het ingrediënt (verplicht)
  - `amount` — hoeveelheid als getal (optioneel, schaalt mee)
  - `unit` — eenheid als tekst, bijv. `g`, `ml`, `el` (optioneel)

Timer links in de stappentekst:

- Schrijf `[label](timer:MM)` voor een timer in minuten, bijv. `[90 minuten](timer:90)`
- Of `[label](timer:MM:SS)` voor minuten én seconden, bijv. `[1 min 30 sec](timer:1:30)`
- Timers ≥ 60 minuten worden weergegeven als `u:mm:ss` (bijv. `1:30:00`)
- Klikken start een inline countdown direct onder de stap
- De tab-titel toont de lopende timer zodat je hem ook vanuit een andere tab kunt volgen
- Bij verlopen: alarm-geluid (Web Audio), pulse-animatie en browser-notificatie (niet op iOS Safari)
- Meerdere timers tegelijk mogelijk; timers blijven actief bij paginawissel (localStorage)

Kookmodus:

- Toggle verschijnt boven de ingrediëntenkaart als de browser Wake Lock ondersteunt
- Voorkomt dat het scherm op standby gaat tijdens koken

Rendering en logica:

- `src/includes/partials/feed/types/recipe.njk`
- `src/js/modules/recipe.js`
- `src/js/modules/timer/`

In RSS feeds worden ingrediënten en meta als gewone HTML toegevoegd aan de content.

## 5) Verwerkingsflow (kort)

- Frontmatter `music` wordt in `src/feed/feed.11tydata.cjs` omgezet naar `musicCards`.
- Verrijking gebeurt met `getMusicCardData()` in `src/lib/shortcodes/album.js`.
- Presentatie gebeurt in `src/includes/partials/feed/types/music.njk`.

## 6) POI kaart

POI-items komen uit Notion (database):

- `https://www.notion.so/dydric/24caeaaa559f80329597f5af7eb1d6e8?v=24caeaaa559f80efa923000c2241096b&source=copy_link`

Benodigde env:

```bash
NOTION_TOKEN=...
NOTION_POI_DATABASE_ID=24caeaaa559f80329597f5af7eb1d6e8
# Optioneel:
# NOTION_POI_CACHE_DURATION=30m
```

Caching:

- In productie wordt Notion standaard 30 minuten gecached.
- Buiten productie is de default cache vrijwel direct (`1s`), zodat nieuwe POI's snel zichtbaar zijn zonder `npm run clean-cache`.

Aanbevolen kolommen in Notion:

```yaml
Naam (title)
Kaart
category
coordinaten (lng, lat)
Omschrijving
Adres
Url
Favoriet (checkbox)
```

Daarna maak je een feed-item dat dit gebied activeert:

```yaml
---
title: Plekken in Leeuwarden
date: 2026-02-24
type: poi
kaart: leeuwarden
# Optioneel, standaard true:
# clusters: false
---
Optionele introtekst.
```

Belangrijk:

- `kaart` op het feed-item koppelt de POI-lijst.
- POI `coordinaten` mogen als `lng,lat` tekst in Notion.
- Gebruik `omschrijving` voor korte tekst (in plaats van `content`, dat is gereserveerd in Eleventy).
- Elke `category` krijgt een eigen marker-kleur (nu eenvoudige SVG-cirkel, later vervangbaar per category).

Rendering en logica:

- `src/includes/partials/feed/types/poi.njk`
- `src/js/modules/mapbox/poi/lifecycle.js`
- `src/includes/data/notionPoi.js`
- `src/includes/providers/notion-poi.js`
- `src/lib/poi/normalize.js`

## 7) Praktische checks

Als iets niet rendert zoals verwacht:

- Controleer of `type` klopt (`activity`, `poi`, `music` of `recipe`).
- Controleer of `strava` alleen cijfers bevat.
- Controleer bij `poi` of `kaart` op feed-item exact overeenkomt met Notion-kolom `Kaart`.
- Controleer of `NOTION_TOKEN` gezet is en de Notion database gedeeld is met de integratie.
- Controleer of Apple links geldig zijn (album-id / track-id aanwezig).
- Controleer `.cache/albums/*.json` bij muziek-debug.

## 8) Afbeeldingen

Zie [images.md](images.md) voor de volledige documentatie.

Kort:

- **Hero image** in frontmatter: `image: bestandsnaam.jpg` (relatief aan `src/media/`)
- **Inline afbeelding** in Markdown: `![alt](/media/foto.jpg)` — breekt automatisch uit
- **Gallery shortcode**: `{% gallery "mapnaam", [1, 3, 2] %}...{% endgallery %}`
- **YouTube**: `{% youtube "VIDEO_ID", "Titel" %}` (nocookie, responsive)
- **SoundCloud**: `{% soundcloud "URL", "Titel" %}`
- **Mixcloud**: `{% mixcloud "/user/show/", "Titel" %}`
- Alle afbeeldingen worden automatisch omgezet naar WebP + JPEG met responsive srcset

## 9) Zichtbaarheid met `hide`

Je kunt feed-items los verbergen voor website-overzichten en RSS:

```yaml
# Niet tonen op website-overzichten en niet in RSS
hide: all

# Wel tonen op website-overzichten, niet in RSS
hide: feed

# Niet tonen op website-overzichten, wel in RSS
hide: website
```

Gedrag:

- Website-overzichten (home, `/archief/`, categoriepagina's) gebruiken `hide: all` en `hide: website`.
- RSS feeds (`/rss/index.xml` en `/rss/[category].xml`) gebruiken `hide: all` en `hide: feed`.

URL-structuur per type:

- Geen type: `/[slug]/`
- `type: recipe` → `/recept/[slug]/`
- `type: poi` → `/kaart/[slug]/`
- `type: music` → `/muziek/[slug]/`
- `type: activity` → `/activiteit/[slug]/`
- Zonder `hide` blijft een item overal zichtbaar.

Let op:

- Dit staat los van `hidepageforseo`.
