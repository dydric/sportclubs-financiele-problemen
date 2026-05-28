# Likes / reacties

Bezoekers kunnen reageren op feed-berichten met emoji-knoppen (♥️ 🔥 💪).
Elke reactie is onafhankelijk. Door een knop ingedrukt te houden loopt de
teller op — loslaten verstuurt de opgelopen delta in één request.

---

## Werking op hoofdlijnen

```text
Bezoeker opent bericht
  ↓
JS haalt tellers op via GET /.netlify/functions/likes?slug=<slug>
  ↓
Knop toont count + Twemoji rendert emoji
  ↓
Bezoeker drukt knop in
  ↓
Direct +1, daarna +10/s zolang ingedrukt (max 100 per type per dag)
  ↓
Loslaten → één POST met de opgelopen delta  { slug, type, count: N }
  ↓
Netlify Blobs telt current + delta op
  ↓
Knop terug naar "ready" (of "maxed" als daglimiet bereikt)
```

---

## Opslag

### Netlify Blobs

- Store: `likes`
- Sleutel: post-slug (bijv. `02-ijsland-2`)
- Waarde: `{ "counts": { "<type-key>": <number>, ... } }`

Type-sleutels zijn de Unicode code points van de emoji in hexadecimaal:

| Emoji | Type-sleutel  |
|-------|---------------|
| ♥️    | `2665-fe0f`   |
| 🔥    | `1f525`       |
| 💪    | `1f4aa`       |
| 😋    | `1f60b`       |

### localStorage

Daglimiet wordt bijgehouden in localStorage (sleutel `likes-daily`):

```json
{
  "02-ijsland-2": {
    "2665-fe0f": { "date": "2026-03-16", "count": 23 }
  }
}
```

De datum wordt vergeleken met de huidige dag (`YYYY-MM-DD`). Is de datum anders,
dan wordt de teller als nul beschouwd — automatisch reset elke dag.

---

## Frontmatter

Voeg toe aan een `.md`-bestand in `src/feed/`:

```yaml
# Standaard: altijd aan (geen veld nodig)

# Uitschakelen
likes: false

# Aan met opties
likes:
  types: ["♥️", "🔥"]   # overschrijft alles — hoogste prioriteit
  start: 15              # optelt bij de eerste knop (migratie-offset, display only)
```

### Type-prioriteit

De reactie-types worden bepaald in deze volgorde:

1. **`likes.types`** in frontmatter van het bericht (hoogste prioriteit)
2. **`site.likeTypesByFeedType[type]`** — standaard per feedtype
3. **`site.likeTypes`** — algemene fallback

### Standaard types instellen

In `src/includes/data/site.js`:

```js
// Algemene fallback
likeTypes: ["♥️", "🔥"],

// Per feedtype (type = frontmatter-veld `type` van het bericht)
likeTypesByFeedType: {
  music:    ["♥️", "🔥"],
  recipe:   ["😋", "🔥", "♥️"],
  activity: ["💪", "🔥", "♥️"],
  poi:      ["♥️", "🔥"],
}
```

Voeg een nieuw feedtype toe door een extra sleutel toe te voegen aan `likeTypesByFeedType`.
Gebruik Twemoji-ondersteunde emoji voor consistente weergave in alle browsers.

---

## API

### GET — tellers ophalen

```text
GET /.netlify/functions/likes?slug=<slug>
```

Response:

```json
{ "counts": { "2665-fe0f": 5, "1f525": 3 } }
```

Als een type nog nooit geliked is, staat het niet in `counts`.

### POST — likes registreren

```http
POST /.netlify/functions/likes
Content-Type: application/json

{ "slug": "02-ijsland-2", "type": "♥️", "count": 10 }
```

- `count`: geheel getal 1–100 (server valideert en weigert buiten dit bereik)
- Response: zelfde formaat als GET, bijgewerkte tellers

---

## Handmatig likes instellen

### Via Netlify CLI (aanbevolen)

```bash
# Lees huidige waarde
netlify blobs:get likes 02-ijsland-2

# Stel specifieke waarden in
netlify blobs:set likes 02-ijsland-2 '{"counts":{"2665-fe0f":12,"1f525":5}}'
```

### Via browser-console (op de live site)

```js
// Voeg N likes toe aan een specifiek type
await fetch('/.netlify/functions/likes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ slug: '02-ijsland-2', type: '♥️', count: 10 })
});
```

---

## Daglimiet

Per type per gebruiker mogen maximaal **100 likes per dag** worden gegeven.
De limiet wordt client-side bijgehouden in localStorage en vervalt automatisch
om middernacht (lokale tijd van de bezoeker).

- Bij het bereiken van de limiet gaat de knop naar de `maxed` state
- Op `localhost` en `127.0.0.1` geldt **geen** limiet (handig voor testen)
- De server accepteert alleen `count` waarden tussen 1 en 100 (extra veiligheidslaag)

---

## Technische details

### Hold-mechanisme

- **`pointerdown`**: direct +1; na **2 seconden** ingedrukt houden start de oploop (+10/s via `setInterval(100ms)`)
- **`setPointerCapture`**: het event volgt de pointer ook buiten de knop (mobile + desktop)
- **`pointerup` / `pointercancel` / `lostpointercapture`**: stop interval, stuur delta
- Bij een snelle tik (< 100ms) wordt precies 1 like verstuurd
- De oplopende teller is optimistisch (DOM); de server bevestigt de definitieve waarde

### Betrouwbaarheid

Twee maatregelen voorkomen verlies van likes:

1. **Client-side wachtrij** (`likeQueue`): POST-requests per container worden serieel
   verstuurd. De volgende start pas als de vorige klaar is. Geen gelijktijdige
   writes naar dezelfde Blob.

2. **`keepalive: true`** op de POST-fetch: het request wordt afgerond ook als de
   pagina wordt verlaten of herladen vóór het antwoord is ontvangen.

### Twemoji-integratie

De emoji staan als tekst in de HTML bij het laden van de pagina. Twemoji
converteert ze via `requestIdleCallback` na `window.load` naar `<img>`-tags.
JS past daarna **nooit** de emoji-inhoud aan — alleen state-attributen en de
teller. Zo blijven de Twemoji-afbeeldingen intact.

### State machine per knop

```text
loading → ready
loading → error
ready   → holding → sending → ready
ready   → holding → sending → maxed   (daglimiet bereikt)
sending → ready   (bij API-fout: rollback, daglimiet teruggedraaid)
```

### Blob-sleutel validatie (server)

- Slug: `/^[a-z0-9][a-z0-9-_]{0,99}$/`
- Type-sleutel (emoji als hex): `/^[0-9a-f]{1,6}(-[0-9a-f]{1,6}){0,9}$/`
- Count: geheel getal, 1–100

---

## Betrokken bestanden

| Bestand | Rol |
| ------- | --- |
| `netlify/functions/likes.mjs` | Serverloze API (GET + POST) |
| `src/js/modules/site/likes.js` | Client-side logica, state machine |
| `src/includes/partials/components/likes.njk` | Template component |
| `src/css/tw/components/likes.css` | Stijlen en animatie |
| `src/includes/data/site.js` | Standaard `likeTypes` en `likeTypesByFeedType` |
| `netlify.toml` | `node_bundler = "esbuild"` (vereist voor @netlify/blobs) |
