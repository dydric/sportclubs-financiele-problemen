import Fetch from "@11ty/eleventy-fetch";

export default class LastFmAPI {
  constructor() {
    this.apiKey = process.env.LASTFM_KEY;
    this.user = "diederik_";
    this.baseUrl = "https://ws.audioscrobbler.com/2.0/";
  }

  // Algemene fetch helper
  async fetchFromLastFm(method, params) {
    const url = `${this.baseUrl}?method=${method}&user=${this.user}&api_key=${this.apiKey}&format=json&${params}`;
    try {
      const response = await Fetch(url, {
        duration: "1h", // Cache resultaten 1 uur
        type: "json",
      });
      if (!response) throw new Error(`No data from Last.fm method: ${method}`);
      return response;
    } catch (error) {
      console.error(`Failed to fetch data from Last.fm (${method}):`, error);
      return null;
    }
  }

  // Trends: totaal, week, maand
  async getTrends() {
    const userInfo = await this.fetchFromLastFm("user.getinfo", "");
    const weeklyTracks = await this.fetchFromLastFm("user.getweeklytrackchart", "");
    const lovedTracks = await this.fetchFromLastFm("user.getlovedtracks", "limit=1"); // Alleen de limiet opvragen om de lengte te bepalen

    return {
      totalScrobbles: userInfo?.user?.playcount || 0,
      weeklyScrobbles: weeklyTracks?.weeklytrackchart?.track.length || 0,
      lovedTracksCount: lovedTracks?.lovedtracks?.["@attr"]?.total || 0,
    };
  }

  // Top artiesten
  async getTopArtists(period = "overall") {
    const data = await this.fetchFromLastFm("user.gettopartists", `period=${period}&limit=10`);
    return data?.topartists?.artist.map(artist => ({
      name: artist.name,
      playcount: artist.playcount,
    })) || [];
  }

  // Top albums
  async getTopAlbums(period = "overall") {
    const data = await this.fetchFromLastFm("user.gettopalbums", `period=${period}&limit=10`);
    return data?.topalbums?.album.map(album => ({
      name: album.name,
      artist: album.artist.name,
      image: album.image?.find(img => img.size === "large")?.["#text"] || null, // Kies "large" formaat of null
    })) || [];
  }

  // Top tracks
  async getTopTracks(period = "overall") {
    const data = await this.fetchFromLastFm("user.gettoptracks", `period=${period}&limit=10`);
    return data?.toptracks?.track.map(track => ({
      name: track.name,
      artist: track.artist.name,
    })) || [];
  }

  // Loved tracks
  async getLovedTracks(limit = 100) {
    const data = await this.fetchFromLastFm("user.getlovedtracks", `limit=${limit}`);
    return data?.lovedtracks?.track.map(track => ({
      name: track.name,
      artist: track.artist.name,
      album: track.album?.["#text"] || null, // Album (indien beschikbaar)
      image: track.image?.find(img => img.size === "large")?.["#text"] || null, // Grote afbeelding of null
      date: track.date?.uts ? new Date(track.date.uts * 1000).toISOString() : null, // Datum in ISO-formaat
    })) || [];
  }

  // Recente tracks
  async getRecentTracks(limit = 10) {
    const data = await this.fetchFromLastFm("user.getrecenttracks", `limit=${limit}`);
    return data?.recenttracks?.track.map(track => ({
      name: track.name,
      artist: track.artist["#text"],
      album: track.album["#text"],
      date: track.date?.["#text"] || null, // Null als het nu aan het spelen is
      nowPlaying: track["@attr"]?.nowplaying === "true", // Boolean voor nu afspelen
    })) || [];
  }
}

// Exports
export async function getLastFmTrends() {
  const api = new LastFmAPI();
  return await api.getTrends();
}

export async function getLastFmTopArtists(period = "overall") {
  const api = new LastFmAPI();
  return await api.getTopArtists(period);
}

export async function getLastFmTopAlbums(period = "overall") {
  const api = new LastFmAPI();
  return await api.getTopAlbums(period);
}

export async function getLastFmTopTracks(period = "overall") {
  const api = new LastFmAPI();
  return await api.getTopTracks(period);
}

export async function getLastFmRecentTracks(limit = 10) {
  const api = new LastFmAPI();
  return await api.getRecentTracks(limit);
}

export async function getLastFmLovedTracks(limit = 100) {
  const api = new LastFmAPI();
  return await api.getLovedTracks(limit);
}
