// File: src/lib/shortcodes/album.js

import fs from 'node:fs/promises';
import path from 'node:path';

const CACHE_DIR = '.cache/albums';
const LOOKUP_CACHE_TTL = 1000 * 60 * 60 * 24 * 365; // 365 days
const SEARCH_CACHE_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days
const SEARCH_CACHE_PRUNE_AGE = 1000 * 60 * 60 * 24 * 30; // 30 days

// Limit concurrent fetches to avoid request bursts during builds
const MAX_CONCURRENT = 4;
let active = 0;
const queue = [];
let didPruneSearchCache = false;

const withLimit = async (fn) => {
	if (active >= MAX_CONCURRENT) {
		await new Promise((resolve) => queue.push(resolve));
	}

	active++;

	try {
		return await fn();
	} finally {
		active--;
		if (queue.length) queue.shift()();
	}
};

const ensureDir = async (dir) => {
	try {
		await fs.mkdir(dir, { recursive: true });
	} catch {
		// Ignore
	}
};

const isSearchCacheKey = (key = '') => String(key).startsWith('apple-search-');

const getCacheTtlForKey = (key = '') => {
	return isSearchCacheKey(key) ? SEARCH_CACHE_TTL : LOOKUP_CACHE_TTL;
};

const pruneOldSearchCacheOnce = async () => {
	if (didPruneSearchCache) return;
	didPruneSearchCache = true;

	try {
		await ensureDir(CACHE_DIR);
		const entries = await fs.readdir(CACHE_DIR, { withFileTypes: true });
		const now = Date.now();

		await Promise.all(
			entries
				.filter((entry) => entry.isFile() && entry.name.startsWith('apple-search-') && entry.name.endsWith('.json'))
				.map(async (entry) => {
					const file = path.join(CACHE_DIR, entry.name);
					try {
						const stat = await fs.stat(file);
						if (now - stat.mtimeMs > SEARCH_CACHE_PRUNE_AGE) {
							await fs.unlink(file);
						}
					} catch {
						// Ignore single file issues
					}
				})
		);
	} catch {
		// Ignore prune failures
	}
};

const getCache = async (key) => {
	try {
		const file = path.join(CACHE_DIR, `${key}.json`);
		const stat = await fs.stat(file);
		const ttl = getCacheTtlForKey(key);

		// Expire cache after TTL
		if (Date.now() - stat.mtimeMs > ttl) return null;

		return JSON.parse(await fs.readFile(file, 'utf-8'));
	} catch {
		return null;
	}
};

const setCache = async (key, data) => {
	await ensureDir(CACHE_DIR);
	await pruneOldSearchCacheOnce();

	// Do not keep empty search responses; they create noisy cache files.
	if (isSearchCacheKey(key) && Number(data?.resultCount || 0) === 0) {
		return;
	}

	await fs.writeFile(
		path.join(CACHE_DIR, `${key}.json`),
		JSON.stringify(data, null, 2),
		'utf-8'
	);
};

const getAppleId = (url = '') => {
	// Apple Music album URLs usually end with /<name>/<id>
	// Example: https://music.apple.com/nl/album/.../1234567890
	const match = String(url).match(/\/(\d+)(\?.*)?$/);
	return match ? match[1] : null;
};

const normalizeCountry = (value = '') => {
	const country = String(value || '').trim().toLowerCase();
	return /^[a-z]{2}$/.test(country) ? country : 'us';
};

const getAppleMusicCountry = (url = '') => {
	try {
		const parsed = new URL(String(url));
		const parts = parsed.pathname.split('/').filter(Boolean);
		return normalizeCountry(parts[0] || '');
	} catch {
		return 'us';
	}
};

const getAppleTrackIdFromUrl = (url = '') => {
	try {
		const parsed = new URL(String(url));
		const idFromQuery = parsed.searchParams.get('i');
		if (idFromQuery && /^\d+$/.test(idFromQuery)) return idFromQuery;
		return null;
	} catch {
		return null;
	}
};

const getAppleLookupIdFromUrl = (url = '') => {
	try {
		const parsed = new URL(String(url));
		const pathMatch = parsed.pathname.match(/\/id(\d+)$/);
		if (pathMatch) return pathMatch[1];

		const fallbackMatch = parsed.pathname.match(/\/(\d+)$/);
		return fallbackMatch ? fallbackMatch[1] : null;
	} catch {
		return null;
	}
};

const normalizeText = (value = '') => {
	return String(value || '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
};

const normalizeArtistName = (value = '') => {
	return normalizeText(value).replace(/\s+/g, ' ').trim();
};

const scoreSongMatch = (song, track, preferredLookupId = '') => {
	const songTitle = normalizeText(song?.trackName);
	const songArtist = normalizeText(song?.artistName);
	const trackTitle = normalizeText(track?.title || track?.trackName);
	const trackArtist = normalizeText(track?.artist || track?.artistName);
	const lookupId = String(preferredLookupId || '');

	let score = 0;

	if (trackTitle && songTitle) {
		if (songTitle === trackTitle) score += 6;
		else if (songTitle.includes(trackTitle) || trackTitle.includes(songTitle)) score += 3;
	}

	if (trackArtist && songArtist) {
		if (songArtist === trackArtist) score += 5;
		else if (songArtist.includes(trackArtist) || trackArtist.includes(songArtist)) score += 2;
	}

	if (lookupId && String(song?.collectionId || '') === lookupId) score += 2;
	return score;
};

const findBestSongMatch = (results, track, preferredLookupId = '') => {
	const candidates = Array.isArray(results)
		? results.filter((entry) => entry?.wrapperType === 'track')
		: [];

	if (!candidates.length) return null;

	const ranked = candidates
		.map((entry) => ({ entry, score: scoreSongMatch(entry, track, preferredLookupId) }))
		.sort((a, b) => b.score - a.score);

	if (!ranked.length || ranked[0].score < 3) return null;
	return ranked[0].entry;
};

const toArrayOfTrackNumbers = (value) => {
	if (!Array.isArray(value)) return [];
	return value
		.map((entry) => Number(entry))
		.filter((entry) => Number.isFinite(entry) && entry > 0);
};

const resolveTrackSelection = (tracksOption, allTracks, maxTracksInput) => {
	const maxTracks = Number(maxTracksInput || 25);
	const limit = Number.isFinite(maxTracks) && maxTracks > 0 ? maxTracks : 25;

	if (tracksOption === undefined || tracksOption === null || tracksOption === '') {
		return [];
	}

	if (tracksOption === 'all' || tracksOption === true || String(tracksOption) === 'true') {
		return allTracks.slice(0, limit);
	}

	if (Array.isArray(tracksOption)) {
		const selected = new Set(toArrayOfTrackNumbers(tracksOption));
		return allTracks
			.filter((track) => selected.has(Number(track.trackNumber)))
			.slice(0, limit);
	}

	return [];
};

const fetchAppleAlbum = async (appleId, countryInput = 'us') => {
	const country = normalizeCountry(countryInput);
	return withLimit(async () => {
		const cacheKey = `apple-${country}-${appleId}`;
		const cached = await getCache(cacheKey);

		if (cached) return cached;

		const res = await fetch(
			`https://itunes.apple.com/lookup?id=${encodeURIComponent(appleId)}&entity=song&country=${encodeURIComponent(country)}`,
			{
				headers: {
					// Some endpoints behave nicer with a UA header
					'User-Agent': 'Eleventy Album Card (+https://diederikdijkstra.nl)',
				},
			}
		);

		if (!res.ok) {
			throw new Error(`Apple lookup failed (${res.status})`);
		}

		const json = await res.json();
		await setCache(cacheKey, json);

		return json;
	});
};

const fetchAppleSongs = async (songIds = [], countryInput = 'us') => {
	const ids = Array.from(new Set(songIds.map((value) => String(value).trim()).filter(Boolean)));
	if (!ids.length) return [];
	const country = normalizeCountry(countryInput);

	return withLimit(async () => {
		const cacheKey = `apple-songs-${country}-${ids.sort().join('-')}`;
		const cached = await getCache(cacheKey);
		if (cached) return cached;

		const res = await fetch(
			`https://itunes.apple.com/lookup?id=${encodeURIComponent(ids.join(','))}&entity=song&country=${encodeURIComponent(country)}`,
			{
				headers: {
					'User-Agent': 'Eleventy Music Card (+https://diederikdijkstra.nl)',
				},
			}
		);

		if (!res.ok) {
			throw new Error(`Apple song lookup failed (${res.status})`);
		}

		const json = await res.json();
		await setCache(cacheKey, json);
		return json;
	});
};

const fetchAppleSongsBySearch = async (query, countryInput = 'us') => {
	const term = String(query || '').trim();
	if (!term) return null;
	const country = normalizeCountry(countryInput);

	return withLimit(async () => {
		const cacheKey = `apple-search-${country}-${encodeURIComponent(term)}`;
		const cached = await getCache(cacheKey);
		if (cached) return cached;

		const res = await fetch(
			`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=10&country=${encodeURIComponent(country)}`,
			{
				headers: {
					'User-Agent': 'Eleventy Music Card (+https://diederikdijkstra.nl)',
				},
			}
		);

		if (!res.ok) {
			throw new Error(`Apple search failed (${res.status})`);
		}

		const json = await res.json();
		await setCache(cacheKey, json);
		return json;
	});
};

const buildTrackMaps = (results = []) => {
	const trackPool = Array.isArray(results)
		? results.filter((entry) => entry?.wrapperType === 'track')
		: [];

	const byTrackId = new Map();
	const byCollectionId = new Map();

	for (const entry of trackPool) {
		const trackId = String(entry?.trackId || '');
		if (trackId) byTrackId.set(trackId, entry);

		const collectionId = String(entry?.collectionId || '');
		if (collectionId) {
			const list = byCollectionId.get(collectionId) || [];
			list.push(entry);
			byCollectionId.set(collectionId, list);
		}
	}

	return { trackPool, byTrackId, byCollectionId };
};

const getMusicAlbumData = async (item = {}) => {
	const appleUrl = item?.apple || item?.url;
	const spotifyUrl = item?.spotify || '';
	if (!appleUrl) return null;

	const appleId = getAppleId(appleUrl);
	if (!appleId) return null;
	const country = getAppleMusicCountry(appleUrl);

	try {
		const json = await fetchAppleAlbum(appleId, country);
		const results = Array.isArray(json.results) ? json.results : [];
		const album = results[0];
		const allTracks = results.slice(1);

		if (!album) return null;

		const visibleTracks = resolveTrackSelection(item?.tracks, allTracks, item?.maxTracks);
		const cover = String(album.artworkUrl100 || '').replace('100x100bb', '600x600bb');

		return {
			type: 'album',
			appleUrl,
			spotifyUrl: String(spotifyUrl || '').trim(),
			title: String(album.collectionName || ''),
			subtitle: String(album.artistName || ''),
			cover,
			tracks: visibleTracks.map((track) => ({
				trackNumber: track.trackNumber,
				trackName: track.trackName,
				artistName: track.artistName || '',
				artistDiffers: normalizeArtistName(track.artistName || '') !== normalizeArtistName(album.artistName || ''),
				appleUrl: '',
				previewUrl: track.previewUrl || '',
			})),
		};
	} catch {
		return {
			type: 'album',
			appleUrl,
			spotifyUrl: String(spotifyUrl || '').trim(),
			title: 'Album',
			subtitle: 'Kon data niet laden',
			cover: '',
			tracks: [],
		};
	}
};

const normalizePlaylistTrack = (track = {}) => {
	if (typeof track === 'string') {
		return {
			title: '',
			artist: '',
			apple: track,
		};
	}

	return {
		title: String(track.title || '').trim(),
		artist: String(track.artist || '').trim(),
		apple: String(track.apple || track.url || '').trim(),
		preview: String(track.preview || track.previewUrl || '').trim(),
		note: String(track.note || track.text || '').trim(),
	};
};

const getMusicPlaylistData = async (item = {}) => {
	const tracks = Array.isArray(item?.tracks) ? item.tracks.map(normalizePlaylistTrack) : [];
	const appleUrl = String(item?.apple || item?.url || '').trim();
	const spotifyUrl = String(item?.spotify || '').trim();
	const fallbackTitle = String(item?.title || 'Playlist').trim() || 'Playlist';
	const fallbackSubtitle = String(item?.description || '').trim();
	const cover = String(item?.cover || '').trim();
	const defaultCountry = getAppleMusicCountry(appleUrl);
	const sourceTracks = tracks.slice(0, 25).map((track, index) => {
		const country = track.apple ? getAppleMusicCountry(track.apple) : defaultCountry;
		return {
			...track,
			index,
			country,
			trackId: getAppleTrackIdFromUrl(track.apple),
			lookupId: getAppleLookupIdFromUrl(track.apple),
		};
	});

	const idsByCountry = new Map();
	for (const track of sourceTracks) {
		const ids = idsByCountry.get(track.country) || new Set();
		// Prefer explicit song ids; only fallback to lookup id when song id is missing.
		// This avoids sending album ids (from /album/.../<id>?i=<trackId>) in bulk lookups,
		// which returns large extra result sets.
		if (track.trackId) {
			ids.add(String(track.trackId));
		} else if (track.lookupId) {
			ids.add(String(track.lookupId));
		}
		if (ids.size) idsByCountry.set(track.country, ids);
	}

	const trackPoolByCountry = new Map();
	const songByTrackIdByCountry = new Map();
	const songsByCollectionIdByCountry = new Map();

	await Promise.all(
		Array.from(idsByCountry.entries()).map(async ([country, ids]) => {
			try {
				const response = await fetchAppleSongs(Array.from(ids), country);
				const { trackPool, byTrackId, byCollectionId } = buildTrackMaps(response?.results || []);
				trackPoolByCountry.set(country, trackPool);
				songByTrackIdByCountry.set(country, byTrackId);
				songsByCollectionIdByCountry.set(country, byCollectionId);
			} catch {
				trackPoolByCountry.set(country, []);
				songByTrackIdByCountry.set(country, new Map());
				songsByCollectionIdByCountry.set(country, new Map());
			}
		})
	);

	const resolveTrack = async (track) => {
		const byTrackId = songByTrackIdByCountry.get(track.country) || new Map();
		const byCollectionId = songsByCollectionIdByCountry.get(track.country) || new Map();
		const trackPool = trackPoolByCountry.get(track.country) || [];

		let lookupTrack = track.trackId ? byTrackId.get(String(track.trackId)) : null;

		if (!lookupTrack && track.lookupId) {
			// /song/id<id> may already be a track id
			lookupTrack = byTrackId.get(String(track.lookupId)) || null;
		}

		if (!lookupTrack && track.lookupId) {
			lookupTrack = findBestSongMatch(byCollectionId.get(String(track.lookupId)) || [], track, track.lookupId);
		}

		if (!lookupTrack && trackPool.length) {
			lookupTrack = findBestSongMatch(trackPool, track, '');
		}

		if (!lookupTrack && track.title) {
			try {
				const query = [track.artist, track.title].filter(Boolean).join(' ');
				const json = await fetchAppleSongsBySearch(query, track.country);
				lookupTrack = findBestSongMatch(json?.results, track, '');
			} catch {
				lookupTrack = null;
			}
		}

		// Some storefronts miss previews; fallback to US once for the same id(s).
		if (
			lookupTrack &&
			!lookupTrack.previewUrl &&
			track.country !== 'us' &&
			(track.trackId || track.lookupId)
		) {
			try {
				const usIds = Array.from(new Set([track.trackId, track.lookupId].filter(Boolean).map(String)));
				const usResponse = await fetchAppleSongs(usIds, 'us');
				const { trackPool: usTrackPool, byTrackId: usByTrackId, byCollectionId: usByCollectionId } = buildTrackMaps(usResponse?.results || []);

				let usMatch = null;
				if (track.trackId) usMatch = usByTrackId.get(String(track.trackId)) || null;
				if (!usMatch && track.lookupId) usMatch = usByTrackId.get(String(track.lookupId)) || null;
				if (!usMatch && track.lookupId) {
					usMatch = findBestSongMatch(usByCollectionId.get(String(track.lookupId)) || [], track, track.lookupId);
				}
				if (!usMatch) usMatch = findBestSongMatch(usTrackPool, track, '');

				if (usMatch?.previewUrl) {
					lookupTrack = {
						...lookupTrack,
						previewUrl: usMatch.previewUrl,
					};
				}
			} catch {
				// Keep current lookupTrack
			}
		}

		return {
			trackNumber: track.index + 1,
			trackName: track.title || String(lookupTrack?.trackName || ''),
			artistName: track.artist || String(lookupTrack?.artistName || ''),
			artistDiffers: true,
			appleUrl: String(lookupTrack?.trackViewUrl || track.apple || ''),
			previewUrl: track.preview || String(lookupTrack?.previewUrl || ''),
			note: track.note || '',
		};
	};

	const visibleTracks = await Promise.all(sourceTracks.map(resolveTrack));

	return {
		type: 'playlist',
		appleUrl,
		spotifyUrl,
		title: fallbackTitle,
		subtitle: fallbackSubtitle,
		cover,
		tracks: visibleTracks,
	};
};

const getMusicCardData = async (item = {}) => {
	if (item?.kind === 'playlist' || item?.playlist === true) {
		return getMusicPlaylistData(item);
	}
	return getMusicAlbumData(item);
};

export { getMusicAlbumData, getMusicPlaylistData, getMusicCardData };
