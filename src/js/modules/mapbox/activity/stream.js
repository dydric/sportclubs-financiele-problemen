import { decodePolyline } from '../polyline';

function getSpeedStopsBySport(sportTypeValue) {
	const sportType = String(sportTypeValue || '').toLowerCase();

	if (sportType.includes('run')) return [7, 9.5, 11.5];
	if (sportType.includes('ride') || sportType.includes('cycle') || sportType.includes('bike')) return [18, 26, 34];
	if (sportType.includes('nordic') || sportType.includes('xc ski') || sportType.includes('cross country')) return [8, 13, 20];
	if (sportType.includes('alpine') || sportType.includes('snowboard') || sportType.includes('ski')) return [18, 32, 52];
	if (sportType.includes('walk') || sportType.includes('hike')) return [4, 5.5, 7];
	return [6, 10, 14];
}

export function getSpeedThresholds(segmentCollection, sportTypeValue) {
	const fallbackStops = getSpeedStopsBySport(sportTypeValue);
	const speeds = (segmentCollection?.features || [])
		.map((feature) => Number(feature?.properties?.speedKmh))
		.filter((value) => Number.isFinite(value) && value > 0);

	if (speeds.length < 8) return { low: fallbackStops[1], high: fallbackStops[2] };

	const sorted = [...speeds].sort((a, b) => a - b);
	const percentile = (p) => {
		const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
		return sorted[idx];
	};

	const low = percentile(0.35);
	const high = percentile(0.7);
	if (!Number.isFinite(low) || !Number.isFinite(high) || (high - low) < 0.6) {
		return { low: fallbackStops[1], high: fallbackStops[2] };
	}

	return {
		low: Number(low.toFixed(2)),
		high: Number(high.toFixed(2))
	};
}

function smoothSpeedValues(values) {
	if (!values.length) return [];

	const windowSize = 11;
	const halfWindow = Math.floor(windowSize / 2);
	const smoothed = new Array(values.length);

	for (let index = 0; index < values.length; index += 1) {
		let sum = 0;
		let count = 0;
		const start = Math.max(0, index - halfWindow);
		const end = Math.min(values.length - 1, index + halfWindow);

		for (let cursor = start; cursor <= end; cursor += 1) {
			const value = values[cursor];
			if (!Number.isFinite(value)) continue;
			sum += value;
			count += 1;
		}

		const average = count ? (sum / count) : values[index];
		smoothed[index] = Number.isFinite(average) ? Number(average.toFixed(2)) : 0;
	}

	return smoothed;
}

export function buildSmoothedSpeedFeatures(segmentCollection) {
	const sourceFeatures = segmentCollection?.features || [];
	if (!sourceFeatures.length) return [];

	const speeds = sourceFeatures.map((feature) => Number(feature?.properties?.speedKmh));
	const smoothedSpeeds = smoothSpeedValues(speeds);
	if (!smoothedSpeeds.length) return [];

	const features = [];
	for (let index = 0; index < sourceFeatures.length; index += 1) {
		const feature = sourceFeatures[index];
		const speedKmhSmoothed = smoothedSpeeds[index];
		if (!feature?.geometry) continue;
		features.push({
			type: 'Feature',
			geometry: feature.geometry,
			properties: {
				speedKmhSmoothed
			}
		});
	}

	return features;
}

export function getStreamLatlng(streamData) {
	if (!streamData) return [];
	if (Array.isArray(streamData.latlng)) return streamData.latlng;
	if (typeof streamData.p === 'string' && streamData.p) {
		const decoded = decodePolyline(streamData.p); // [lng, lat]
		return decoded.map((point) => [point[1], point[0]]);
	}
	return [];
}

export function getStreamSpeedValues(streamData) {
	if (!streamData) return [];
	if (Array.isArray(streamData.velocity_smooth)) return streamData.velocity_smooth;
	if (Array.isArray(streamData.vs)) return streamData.vs.map((value) => Number(value) / 100);
	return [];
}

export function toSegmentFeatureCollection(streamData) {
	const latlng = getStreamLatlng(streamData);
	const speedValues = getStreamSpeedValues(streamData);

	if (latlng.length < 2 || speedValues.length < 2) return null;

	const features = [];
	const coordinates = [];

	for (let index = 1; index < latlng.length; index += 1) {
		const previous = latlng[index - 1];
		const current = latlng[index];
		if (!Array.isArray(previous) || !Array.isArray(current) || previous.length < 2 || current.length < 2) continue;

		const start = [previous[1], previous[0]];
		const end = [current[1], current[0]];
		const speedMS = Number(speedValues[index] ?? speedValues[index - 1] ?? 0);
		const speedKmh = speedMS > 0 ? speedMS * 3.6 : 0;

		coordinates.push(start);
		features.push({
			type: 'Feature',
			geometry: {
				type: 'LineString',
				coordinates: [start, end]
			},
			properties: {
				speedKmh: Number(speedKmh.toFixed(2))
			}
		});
	}

	if (!features.length) return null;
	coordinates.push(features[features.length - 1].geometry.coordinates[1]);

	return {
		type: 'FeatureCollection',
		features,
		coordinatesForBounds: coordinates
	};
}

export function toCoordinatesFromStreamLatlng(streamData) {
	const latlng = getStreamLatlng(streamData);
	if (latlng.length < 2) return [];

	const coordinates = [];
	for (const point of latlng) {
		if (!Array.isArray(point) || point.length < 2) continue;
		coordinates.push([point[1], point[0]]);
	}
	return coordinates;
}
