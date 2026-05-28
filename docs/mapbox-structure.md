# Mapbox JS structuur

Mapbox activity code is opgesplitst in kleine modules:

- `src/js/modules/mapbox/activity-map.js`
  - Dunne entry die `initActivityMaps` exporteert.
- `src/js/modules/mapbox/activity/lifecycle.js`
  - Initialisatie, map lifecycle, resize/theme sync, route-animatie.
- `src/js/modules/mapbox/activity/route-layers.js`
  - Definitieve layer-opbouw voor route en speed overlay.
- `src/js/modules/mapbox/activity/stream.js`
  - Stream parsing (`latlng` of compacte `p` + `vs`) en speed smoothing.
- `src/js/modules/mapbox/activity/privacy.js`
  - Safe-zone filtering.
- `src/js/modules/mapbox/activity/palette.js`
  - Routekleuren via CSS variabelen.
- `src/js/modules/mapbox/activity/theme.js`
  - Basemap style/preset voor light/dark.
- `src/js/modules/mapbox/activity/data.js`
  - JSON script parsing en token-fetch.
- `src/js/modules/mapbox/activity/constants.js`
  - Shared constants en breedte/padding helpers.
- `src/js/modules/mapbox/activity/fit.js`
  - `fitBounds` helper.

## Huidige animatieflow

- Activiteit zonder speeddata:
  - Tijdelijke route-lijn tekent in.
  - Daarna wordt de definitieve route-laag gerenderd.
- Activiteit met speeddata:
  - De speedlijn wordt direct op de definitieve layer-id's geanimeerd.
  - Zodra de lijn compleet is stopt de animatie en blijft deze staan (geen extra swap/smooth stap).

## Optionele instellingen (data-attributen)

Op `[data-mapbox-activity]` kun je per kaart timings instellen:

- `data-route-draw-ms="2400"`
  - Voor route-animatie zonder speeddata.
- `data-speed-draw-ms="3200"`
  - Voor speed-animatie met kleursegmenten.

Ranges in code:

- min `500`
- max `6000`

Doel: makkelijk doorontwikkelen zonder monolithische file, met voorspelbare renderflow.

## POI modules

Voor de nieuwe POI-weergave is dezelfde opzet gebruikt:

- `src/js/modules/mapbox/poi-map.js`
  - Dunne entry die `initPoiMaps` exporteert.
- `src/js/modules/mapbox/poi/lifecycle.js`
  - Initialisatie, cluster/layer rendering, list interactie, theme/resize sync.
- `src/js/modules/mapbox/poi/data.js`
  - JSON script parsing voor POI's en lijst node resolven.
- `src/js/modules/mapbox/poi/icons.js`
  - Marker-SVG opbouw per category.
- `src/js/modules/mapbox/poi/marker-images.js`
  - Zet SVG's om naar Mapbox images (normaal + actief), schaalbaar voor grote sets.
- `src/js/modules/mapbox/poi/fit.js`
  - `fitBounds` helper met adaptive padding.
- `src/js/modules/mapbox/poi/constants.js`
  - Zoom defaults en category labels.
