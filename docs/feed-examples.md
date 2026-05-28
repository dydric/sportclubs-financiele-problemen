# Feed voorbeelden

## Activiteit

```yaml
---
title: Trainingsrit
date: 2026-02-24
type: activity
strava: 17483275548
---
```

## Album

```yaml
---
title: IJsland 2
date: 2026-02-24
type: music
music:
  - apple: https://music.apple.com/nl/album/ijsland-2/1873335530
    spotify: https://open.spotify.com/album/1qwQoDUVZNAGP8g9vBoHug
    tracks: all
    favs: [2, 9]
---
```

## Playlist

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
    tracks:
      - title: Prizefighter
        artist: Youth Lagoon
        apple: https://music.apple.com/nl/album/prizefighter/1848169870?i=1848169895
      - title: Flags
        artist: SYML
        apple: https://music.apple.com/nl/album/flags/1870313498?i=1870313502
---
```

## Bericht met hero image

```yaml
---
title: IJsland
date: 2026-03-31
image: ijsland-hero.jpg
imageAlt: Gletsjer
imageCaption: Optioneel bijschrift
---
```

## Gallery

```markdown
{% gallery "ijsland", [1, 3, 2] %}
gletsjer.jpg | Vatnajökull
waterval.jpg | Skógafoss
vulkaan.jpg | Fagradalsfjall
kust.jpg | Reynisfjara
puffin.jpg | Papegaaiduiker
noorderlicht.jpg | Aurora borealis
{% endgallery %}
```

## YouTube embed

```markdown
{% youtube "dQw4w9WgXcQ", "Rick Astley" %}
```

## SoundCloud embed

```markdown
{% soundcloud "https://soundcloud.com/artist/track", "Track naam" %}
```

## Mixcloud embed

```markdown
{% mixcloud "/user/show/", "Show naam" %}
```

## Zichtbaarheid (`hide`)

```yaml
---
title: Alleen in RSS
date: 2026-02-24
type: music
hide: website
---
```

Mogelijke waarden:

- `hide: all`
- `hide: feed`
- `hide: website`
