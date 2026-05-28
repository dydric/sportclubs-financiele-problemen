import https from 'https';

export async function handler(event, context) {
  const apiKey = process.env.LASTFM_KEY;
  const user = 'diederik_';
  const limit = parseInt(event.queryStringParameters?.limit || '10', 10);
  const lastFmEndpoint = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${user}&api_key=${apiKey}&format=json&limit=${limit}`;

  try {
    // Haal de gegevens op van de Last.fm API
    const data = await fetchData(lastFmEndpoint);

    // Controleer of de response de tracks bevat
    if (!data || !data.recenttracks || !data.recenttracks.track) {
      return {
        statusCode: 200,
        body: JSON.stringify({ tracks: [], nowPlaying: null })
      };
    }

    // Formatteer de tracks
    const tracks = data.recenttracks.track.map((track) => ({
      name: track.name,
      artist: track.artist['#text'],
      album: track.album['#text'],
      image: track.image?.[2]?.['#text'] || null,
      date: track.date?.['#text'] || null,
      nowPlaying: track['@attr']?.nowplaying === 'true',
    }));

    // Bepaal of er een track "nu aan het spelen" is
    const nowPlayingTrack = tracks.find((track) => track.nowPlaying) || null;

    // Verwijder dubbele en beperk tot limiet
    const uniqueTracks = nowPlayingTrack
      ? [nowPlayingTrack, ...tracks.filter((track) => track.name !== nowPlayingTrack.name).slice(0, limit - 1)]
      : tracks.slice(0, limit);

    return {
      statusCode: 200,
      body: JSON.stringify({ tracks: uniqueTracks, nowPlaying: nowPlayingTrack })
    };
  } catch (error) {
    console.error('Error fetching recent tracks:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Something went wrong' })
    };
  }
}

/**
 * Functie om gegevens op te halen met de ingebouwde https-module
 * @param {string} url - De URL van de API-endpoint
 * @returns {Promise<object>} - De JSON-response
 */
function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      // Gegevens verzamelen
      res.on('data', (chunk) => {
        data += chunk;
      });

      // Wanneer alle gegevens binnen zijn
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (error) {
          reject(new Error('Failed to parse response from the API'));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}
