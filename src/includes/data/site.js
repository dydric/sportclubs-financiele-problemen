export default {

  // Global data
  name: "Diederik",
  description: 'Hey! Ik ben Diederik Dijkstra, een ervaren digital designer. Al meer dan twintig jaar bouw ik websites en digitale ervaringen die er niet alleen goed uitzien, maar vooral ook fijn werken. Ik woon in <a href="/kaart/leeuwarden/">Leeuwarden</a> met Lotte, Elin en Fedde.',
  lang: "nl",
  url: "https://diederikdijkstra.nl", // Don't end with a slash /
  dateNow: new Date(),
  env: process.env.NODE_ENV,
  mapboxToken: process.env.MAPBOX_TOKEN || process.env.MAPBOX_ACCESS_TOKEN || process.env.mapbox_token || "",
  mapboxStyles: {
    light: process.env.MAPBOX_STYLE_LIGHT || "mapbox://styles/mapbox/standard",
    dark: process.env.MAPBOX_STYLE_DARK || "mapbox://styles/mapbox/standard"
  },
  mapPrivacyZones: [
    {
      label: "It Dwershus 4",
      lat: 53.168581,
      lng: 5.797153,
      radiusMeters: 200
    }
  ],
  author: {
    name: 'Diederik Dijkstra',
    email: 'hey@diederikdijkstra.nl'
  },

  // Standaard like-types als algemene fallback (geen feedtype of type niet gevonden).
  // Per bericht te overschrijven via frontmatter: likes: { types: ["♥️", "🔥"] }
  // Gebruik Twemoji-ondersteunde emoji voor consistente weergave.
  likeTypes: ["♥️", "🔥"],

  // Standaard like-types per feedtype.
  // Wordt gebruikt als een bericht een `type` heeft maar geen eigen likes.types.
  // Volgorde: per-bericht frontmatter > likeTypesByFeedType > likeTypes (fallback).
  // Voeg hier een nieuw feedtype toe om het systeem uit te breiden.
  likeTypesByFeedType: {
    music:    ["♥️", "🔥", "💿", "🪩"],
    recipe:   ["😋", "♥️"],
    activity: ["💪", "🔥", "♥️"],
    poi:      ["♥️", "✈️"],
  }

};
