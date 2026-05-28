# Afbeeldingen

Afbeeldingen worden lokaal verwerkt met `@11ty/eleventy-img`. Elke `<img>` in de HTML output wordt automatisch omgezet naar een `<picture>` met WebP + JPEG srcset.

## Configuratie

In `eleventy.config.js`:

```js
eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
  extensions: "html",
  formats: ["webp", "jpeg"],
  widths: [400, 800, 1200, "auto"],
  outputDir: "./_site/media/processed/",
  urlPath: "/media/processed/",
  defaultAttributes: {
    loading: "lazy",
    decoding: "async",
  },
});
```

- **Formats**: WebP (primair) + JPEG (fallback). Geen AVIF — te langzaam bij build.
- **Widths**: 400px (mobile), 800px (tablet), 1200px (desktop), origineel als plafond.
- **Output**: Verwerkte afbeeldingen worden direct naar `_site/media/processed/` geschreven. Dit voorkomt timing-issues met passthrough copy.
- **Netlify**: De `.cache/` directory (remote fetch cache) wordt bewaard tussen deploys via `netlify-plugin-cache` (zie `netlify.toml`).

## Bestanden plaatsen

| Type | Locatie | Voorbeeld |
|---|---|---|
| Losse afbeeldingen | `src/media/` | `src/media/foto.jpg` |
| Gallery afbeeldingen | `src/media/galleries/<naam>/` | `src/media/galleries/ijsland/gletsjer.jpg` |

## Afbeelding in content (Markdown)

Gewone Markdown syntax. De afbeelding breekt automatisch uit naar de viewport-breedte (tot `--breakout-max: 1200px`):

```markdown
![Alt tekst](/media/foto.jpg)
```

De `eleventyImageTransformPlugin` converteert dit automatisch naar een `<picture>` met responsive srcset.

## Hero image via frontmatter

Zet `image` in de frontmatter van een feed bericht. Accepteert een pad relatief aan `src/media/` of een volledige URL:

```yaml
---
title: IJsland
image: ijsland-hero.jpg
imageAlt: Gletsjer in IJsland
imageCaption: Optioneel bijschrift
---
```

Of met een externe URL:

```yaml
---
title: Demo
image: https://picsum.photos/seed/hero/1600/900
imageAlt: Placeholder afbeelding
---
```

Gedrag per feed type:

| Type | Positie |
|---|---|
| Default / recipe / music | Onder de titel, in de content kolom (met breakout) |
| Activity | Boven de titel, full-width in de overlay |
| POI | Boven de titel, full-width in de overlay |

Beschikbare frontmatter velden:

- `image` — bestandsnaam relatief aan `src/media/` (verplicht voor hero)
- `imageAlt` — alt-tekst (valt terug op `title`)
- `imageCaption` — optioneel bijschrift onder de afbeelding

## Gallery shortcode

Gebruik de `gallery` paired shortcode voor een raster van afbeeldingen. Afbeeldingen worden opgehaald uit `src/media/galleries/<naam>/`.

### Syntax

```markdown
{% gallery "<naam>", [rij1, rij2, ...] %}
bestandsnaam.jpg | Alt tekst
bestandsnaam.jpg | Alt tekst
{% endgallery %}
```

- **`<naam>`** — mapnaam in `src/media/galleries/` (of willekeurige naam bij remote URLs)
- **`[rij1, rij2, ...]`** — array met het aantal afbeeldingen per rij
- **Regels** — één per regel, drie formaten:
  - `bestandsnaam.jpg | alt tekst` — lokaal bestand in `src/media/galleries/<naam>/`
  - `https://example.com/foto.jpg | alt tekst` — remote URL (dimensies automatisch uit picsum/unsplash URLs)
  - `https://example.com/foto.jpg | alt tekst | 1600x1067` — remote URL met expliciete dimensies

### Voorbeeld met lokale bestanden

```markdown
{% gallery "ijsland", [1, 3, 2] %}
gletsjer.jpg | Vatnajökull gletsjer
waterval.jpg | Skógafoss
vulkaan.jpg | Fagradalsfjall
kust.jpg | Reynisfjara
puffin.jpg | Papegaaiduiker
noorderlicht.jpg | Aurora borealis
{% endgallery %}
```

### Voorbeeld met remote URLs

```markdown
{% gallery "demo", [1, 3] %}
https://picsum.photos/seed/a/1600/1067 | Landschap
https://picsum.photos/seed/b/1600/1067 | Stad
https://picsum.photos/seed/c/1200/1800 | Portret
https://picsum.photos/seed/d/1600/900 | Panorama
{% endgallery %}
```

Dimensie-detectie uit URLs:
- **picsum.photos**: `/seed/<naam>/<breedte>/<hoogte>` wordt automatisch geparsed
- **Unsplash**: `?w=...&h=...` query parameters worden gelezen
- **Overig**: gebruik het derde veld `1600x1067` als expliciete dimensie-hint

### Hoe het werkt

1. Lokale bestanden: de shortcode leest de afmetingen met Sharp.
2. Remote URLs: dimensies worden uit de URL geparsed (of via expliciet `WxH` veld).
3. Elke afbeelding krijgt `flex-grow` op basis van de aspect ratio — landschap wordt breder dan portret.
4. De output `<img>` tags worden automatisch verwerkt door `eleventyImageTransformPlugin`.
5. De gallery krijgt dezelfde breakout-styling als losse afbeeldingen.

### Layout tips

- `[1]` — één volledige breedte beeld
- `[2, 2]` — twee rijen van twee
- `[1, 3, 2, 4]` — afwisselend ritme (Flickr/Tumblr stijl)
- Mix landschap- en portretfoto's voor een dynamisch raster
- Het totaal aan afbeeldingen moet matchen met de som van de layout array

## Breakout CSS

Afbeeldingen en gallery's breken uit de content kolom naar viewport-breedte, begrensd door `--breakout-max`:

```css
:root {
  --breakout-max: 1200px;
  --image-radius: 0.375rem;
  --gallery-gap: 4px;
}
```

De breakout werkt via negatieve margins:

```css
.content > .md-p:has(> picture),
.content > .gallery {
  width: 100vw;
  max-width: var(--breakout-max);
  margin-inline: max(calc(50% - 50vw), calc(50% - var(--breakout-max) / 2));
}
```

Hierop wordt `overflow-x-clip` op `<main>` gebruikt om scrollbar-artefacten te voorkomen.

## Video shortcode

Zelf-gehoste video's met autoplay, muted en loop. Ondersteunt lokale bestanden (`src/media/video/`) en externe URLs.

### Syntax

```markdown
{% video "bestand.mp4" %}
{% video "bestand.mp4", "Titel" %}
{% video "https://example.com/video.mp4", "Titel", "1920x1080" %}
```

- Eerste parameter: bestandsnaam (relatief aan `src/media/video/`) of volledige URL
- Tweede parameter (optioneel): titel/aria-label
- Derde parameter (optioneel): dimensies als `BxH` (alleen nodig voor externe URLs)

### Gedrag

| Oriëntatie | Weergave |
|---|---|
| Liggend (landscape) | Zelfde breakout als YouTube embed (16:9, viewport-breed) |
| Staand (portrait) | Binnen de content-kolom, geen breakout |

Standaard attributen: `autoplay muted loop playsinline loading="lazy"`.

Dimensies worden automatisch gelezen uit lokale MP4 bestanden. Voor externe URLs kun je het `BxH` hint-veld gebruiken.

### Video in gallery

Video's kunnen ook in een gallery worden gebruikt door `.mp4`/`.webm`/`.mov` bestanden op te nemen:

```markdown
{% gallery "missie", [2, 1] %}
foto-1.jpg | Lancering
foto-2.jpg | Opstijgen
launch-video.mp4 | Lancering video
{% endgallery %}
```

Video's in gallery's krijgen dezelfde autoplay/muted/loop behandeling en schalen proportioneel op basis van hun aspect ratio.

### Bestanden plaatsen

| Type | Locatie |
|---|---|
| Video's | `src/media/video/` |
| Gallery video's | `src/media/galleries/<naam>/` of `src/media/video/` |

## Embeds (YouTube, SoundCloud, Mixcloud)

Embed shortcodes voor video en audio. Ze krijgen dezelfde breakout-breedte als afbeeldingen en gallery's.

### YouTube

Gebruikt `youtube-nocookie.com` (geen cookies). Responsive 16:9.

```markdown
{% youtube "VIDEO_ID", "Titel" %}
```

- Eerste parameter: video ID of volledige YouTube URL
- Tweede parameter (optioneel): titel voor het iframe

Voorbeelden:

```markdown
{% youtube "dQw4w9WgXcQ" %}
{% youtube "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "Rick Astley" %}
{% youtube "https://youtu.be/dQw4w9WgXcQ" %}
```

### SoundCloud

```markdown
{% soundcloud "TRACK_URL", "Titel" %}
```

- Eerste parameter: volledige SoundCloud URL van track of playlist
- Tweede parameter (optioneel): titel voor het iframe

Voorbeeld:

```markdown
{% soundcloud "https://soundcloud.com/artist/track-name", "Track naam" %}
```

### Mixcloud

```markdown
{% mixcloud "/USER/SHOW/", "Titel" %}
```

- Eerste parameter: Mixcloud pad (begint en eindigt met `/`)
- Tweede parameter (optioneel): titel voor het iframe

Voorbeeld:

```markdown
{% mixcloud "/sparar/bijzonder-klansen/", "Bijzonder Klansen" %}
```

### RSS

Embed iframes worden meegenomen in de RSS feed. RSS readers die iframes ondersteunen tonen de embed; andere tonen niets. De `absoluteImageUrls` filter converteert embed URLs niet (ze zijn al absoluut).

## Aanpassen

| Variabele | Default | Effect |
|---|---|---|
| `--breakout-max` | `1200px` | Maximale breedte van uitgebroken afbeeldingen/gallery |
| `--gallery-gap` | `4px` | Ruimte tussen gallery items |

## Build performance

| Scenario | Verwachte build tijd |
|---|---|
| Cold cache, 100 images | ~1–2 min |
| Cold cache, 1000 images | ~5–15 min |
| Warm cache (herhaalde build) | Near-instant (alleen nieuwe/gewijzigde afbeeldingen) |
| Development (`eleventy --serve`) | Afbeeldingen worden on-request verwerkt |

### Cache wissen

```bash
npm run clean-cache   # Wist _site, .cache én src/media/processed
```

Of selectief alleen de image cache:

```bash
rm -rf .cache/eleventy-img
```
