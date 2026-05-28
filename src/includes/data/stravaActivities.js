import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getStravaActivities, getStravaActivityById, getStravaActivityStreams } from '../providers/strava.js';

const FEED_DIR = join(process.cwd(), 'src', 'feed');
const STRAVA_ID_REGEX = /^\s*strava:\s*["']?(?:https?:\/\/(?:www\.)?strava\.com\/activities\/)?([0-9]+)["']?\s*$/gm;
const MAX_STREAM_POINTS = 1400;

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function roundTo(value, decimals) {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

function encodeSigned(value) {
	let signed = value < 0 ? ~(value << 1) : (value << 1);
	let output = '';

	while (signed >= 0x20) {
		output += String.fromCharCode((0x20 | (signed & 0x1f)) + 63);
		signed >>= 5;
	}

	output += String.fromCharCode(signed + 63);
	return output;
}

function encodePolylineLatLng(points) {
	let previousLat = 0;
	let previousLng = 0;
	let encoded = '';

	for (const point of points) {
		if (!Array.isArray(point) || point.length < 2) continue;
		const lat = Number(point[0]);
		const lng = Number(point[1]);
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

		const latE5 = Math.round(lat * 1e5);
		const lngE5 = Math.round(lng * 1e5);
		encoded += encodeSigned(latE5 - previousLat);
		encoded += encodeSigned(lngE5 - previousLng);
		previousLat = latE5;
		previousLng = lngE5;
	}

	return encoded;
}

function buildSampleIndices(length, maxPoints) {
	if (length <= maxPoints) {
		return Array.from({ length }, (_, index) => index);
	}

	const target = clamp(maxPoints, 2, length);
	const step = (length - 1) / (target - 1);
	const indices = [];
	let previous = -1;

	for (let i = 0; i < target; i += 1) {
		const index = i === target - 1 ? (length - 1) : Math.round(i * step);
		const clamped = clamp(index, 0, length - 1);
		if (clamped === previous) continue;
		indices.push(clamped);
		previous = clamped;
	}

	if (indices[0] !== 0) indices.unshift(0);
	if (indices[indices.length - 1] !== length - 1) indices.push(length - 1);
	return indices;
}

function compactActivityStream(latlngData, speedData) {
	const length = latlngData.length;
	if (length < 2) return null;

	const indices = buildSampleIndices(length, MAX_STREAM_POINTS);
	const latlng = [];
	const velocitySmooth = [];

	for (const index of indices) {
		const point = latlngData[index];
		if (!Array.isArray(point) || point.length < 2) continue;

		const lat = Number(point[0]);
		const lng = Number(point[1]);
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

		latlng.push([
			roundTo(lat, 5),
			roundTo(lng, 5)
		]);

		if (Array.isArray(speedData) && speedData.length) {
			const speed = Number(speedData[index]);
			velocitySmooth.push(Number.isFinite(speed) ? Math.round(speed * 100) : 0);
		}
	}

	if (latlng.length < 2) return null;
	const polyline = encodePolylineLatLng(latlng);
	if (!polyline) return null;

	return {
		p: polyline,
		vs: velocitySmooth
	};
}

async function getStravaIdsFromFeed() {
	const ids = new Set();

	let files = [];
	try {
		files = await readdir(FEED_DIR);
	} catch {
		return ids;
	}

	for (const file of files) {
		if (!file.endsWith('.md')) continue;

		try {
			const contents = await readFile(join(FEED_DIR, file), 'utf8');
			for (const match of contents.matchAll(STRAVA_ID_REGEX)) {
				if (match && match[1]) ids.add(String(match[1]));
			}
		} catch {
			// Skip unreadable files
		}
	}

	return ids;
}

export default async function() {
	try {
		const activities = await getStravaActivities();
		const list = Array.isArray(activities) ? activities : [];
		const byId = {};
		const streamsById = {};

		for (const activity of list) {
			if (!activity || !activity.id) continue;
			byId[String(activity.id)] = activity;
		}

		const requestedIds = await getStravaIdsFromFeed();
		for (const activityId of requestedIds) {
			if (byId[activityId]) continue;
			const activity = await getStravaActivityById(activityId);
			if (!activity || !activity.id) continue;
			byId[String(activity.id)] = activity;
			list.push(activity);
		}

		for (const activityId of requestedIds) {
			const streams = await getStravaActivityStreams(activityId);
			if (!streams || !streams.latlng || !streams.latlng.data || streams.latlng.data.length < 2) continue;
			const compactStream = compactActivityStream(
				streams.latlng.data,
				streams.velocity_smooth && Array.isArray(streams.velocity_smooth.data)
					? streams.velocity_smooth.data
					: []
			);
			if (!compactStream) continue;
			streamsById[String(activityId)] = compactStream;
		}

		return {
			list,
			byId,
			streamsById
		};
	} catch (error) {
		console.error('Failed to load Strava activities data:', error);
		return {
			list: [],
			byId: {},
			streamsById: {}
		};
	}
}
