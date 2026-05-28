---
title: "Voorbeeldpost: Markdown & media"
date: 2026-03-31
category: demo
hide: all
image: https://picsum.photos/seed/hero/1600/900
imageAlt: Landschap als hero image
imageCaption: Hero image via frontmatter — breekt uit de content kolom
tags:
  - markdown
  - lorem-ipsum
---

Dit bericht demonstreert alle Markdown onderdelen en media mogelijkheden.

## Typografie

Lorem ipsum dolor sit amet, **consectetur adipiscing elit**. _Sed do eiusmod tempor incididunt_ ut labore et dolore magna aliqua. [Lees meer](https://example.com).

### Subtitel niveau 3

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

---

## Ongeordende lijst

- Lorem ipsum dolor sit amet.
- Consectetur adipiscing elit.
- Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
  - Geneste bullet één.
  - Geneste bullet twee.

## Geordende lijst

1. Eerste stap: lorem ipsum.
2. Tweede stap: dolor sit amet.
3. Derde stap: consectetur adipiscing elit.

## Checklist

- [x] Basis tekst toegevoegd.
- [x] Lijsten toegevoegd.
- [ ] Nog finetunen na review.

## Blockquote

> Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## Tabel

| Onderdeel | Omschrijving | Status |
| --- | --- | --- |
| Titel | Lorem ipsum heading | Gereed |
| Paragraaf | Dolor sit amet tekst | Gereed |
| Code | Voorbeeld codeblok | Gereed |

## Inline code en codeblok

Gebruik `npm run build` om een productiebuild te draaien.

```js
const lorem = "Lorem ipsum dolor sit amet";
const words = lorem.split(" ");
console.log(words.length);
```

## Details/Summary

<details>
  <summary>Toon extra lorem ipsum</summary>
  <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
</details>

## Enkele afbeelding in content

Een gewone Markdown afbeelding breekt automatisch uit naar de randen van het scherm (tot maximaal de breakout-breedte):

![Uitzicht over bergen](https://picsum.photos/seed/inline/1600/1067)

Tekst gaat gewoon verder na de afbeelding. De afbeelding wordt automatisch omgezet naar WebP met responsive srcset.

## Gallery

Een gallery met layout `[1, 3, 2, 1]` — oftewel: 1 beeld op de eerste rij, 3 op de tweede, 2 op de derde en 1 op de laatste:

{% gallery "demo", [1, 3, 2, 1] %}
https://picsum.photos/seed/gallery1/1600/1067 | Uitzicht over de bergen
https://picsum.photos/seed/gallery2/1600/1067 | Weerspiegeling in het meer
https://picsum.photos/seed/gallery3/1200/1800 | Pad door het bos
https://picsum.photos/seed/gallery4/1600/900 | Zonsondergang aan de horizon
https://picsum.photos/seed/gallery5/1600/1067 | Rotsachtige kustlijn
https://picsum.photos/seed/gallery6/1200/1800 | Slingerend bospad
https://picsum.photos/seed/gallery7/1600/900 | Panorama uitzicht
{% endgallery %}

De gallery breekt ook uit naar de randen, net als losse afbeeldingen.

## Nog een gallery

Met layout `[2, 2, 3]`:

{% gallery "demo", [2, 2, 3] %}
https://picsum.photos/seed/gallery7/1600/900 | Panorama
https://picsum.photos/seed/gallery4/1600/900 | Zonsondergang
https://picsum.photos/seed/gallery1/1600/1067 | Bergen
https://picsum.photos/seed/gallery5/1600/1067 | Kust
https://picsum.photos/seed/gallery2/1600/1067 | Meer
https://picsum.photos/seed/gallery3/1200/1800 | Bos
https://picsum.photos/seed/gallery6/1200/1800 | Pad
{% endgallery %}

## Video

Een zelf-gehoste video. Staande video's blijven binnen de content-breedte, liggende breken uit net als afbeeldingen:

{% video "galleries/artemis-ii/launch-1.mp4", "Raketlancering" %}

## YouTube

Een YouTube video zonder cookies, responsive 16:9 en met dezelfde breakout als afbeeldingen:

{% youtube "dQw4w9WgXcQ", "Rick Astley - Never Gonna Give You Up" %}

## SoundCloud

{% soundcloud "https://soundcloud.com/dydric/mixtape", "Dydric - Mixtape" %}

## Mixcloud

{% mixcloud "/dydric058/mixtape/", "Dydric - Mixtape" %}

## Hoe het werkt

- **Hero image**: zet `image: bestandsnaam.jpg` of volledige URL in frontmatter
- **Inline afbeelding**: gebruik gewoon `![alt](/media/pad/naar/foto.jpg)` of een URL in Markdown
- **Gallery**: gebruik de `gallery` shortcode met lokale bestanden of URLs
{% raw %}- **Video**: `{% video "bestand.mp4", "Titel" %}` (autoplay, muted, loop)
- **YouTube**: `{% youtube "VIDEO_ID", "Titel" %}` (nocookie, responsive)
- **SoundCloud**: `{% soundcloud "URL", "Titel" %}`
- **Mixcloud**: `{% mixcloud "/user/show/", "Titel" %}`{% endraw %}

## Afsluitende paragraaf

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam.
