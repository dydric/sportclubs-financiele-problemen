function haversineDistanceMeters(a, b) {
	const earthRadius = 6371000;
	const toRadians = (degrees) => (degrees * Math.PI) / 180;

	const [lng1, lat1] = a;
	const [lng2, lat2] = b;
	const dLat = toRadians(lat2 - lat1);
	const dLng = toRadians(lng2 - lng1);
	const lat1Rad = toRadians(lat1);
	const lat2Rad = toRadians(lat2);

	const sinLat = Math.sin(dLat / 2);
	const sinLng = Math.sin(dLng / 2);
	const value = (sinLat * sinLat) + (Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinLng * sinLng);
	const c = 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));

	return earthRadius * c;
}

export function isInsideSafeZone(coordinate, safeZones) {
	if (!safeZones.length) return false;

	for (const zone of safeZones) {
		const zoneLat = Number(zone.lat);
		const zoneLng = Number(zone.lng);
		const radiusMeters = Number(zone.radiusMeters || 100);
		if (!Number.isFinite(zoneLat) || !Number.isFinite(zoneLng) || !Number.isFinite(radiusMeters)) continue;

		const distance = haversineDistanceMeters(coordinate, [zoneLng, zoneLat]);
		if (distance <= radiusMeters) return true;
	}

	return false;
}

export function sanitizeSpeedFeatureCollection(segmentCollection, safeZones) {
	if (!segmentCollection?.features?.length || !safeZones.length) return segmentCollection;

	const sanitizedFeatures = [];
	const coordinatesForBounds = [];

	for (const feature of segmentCollection.features) {
		const points = feature?.geometry && Array.isArray(feature.geometry.coordinates)
			? feature.geometry.coordinates
			: [];
		if (points.length < 2) continue;

		const start = points[0];
		const end = points[1];
		if (isInsideSafeZone(start, safeZones) || isInsideSafeZone(end, safeZones)) continue;

		sanitizedFeatures.push(feature);
		coordinatesForBounds.push(start, end);
	}

	if (!sanitizedFeatures.length) return null;

	return {
		type: 'FeatureCollection',
		features: sanitizedFeatures,
		coordinatesForBounds
	};
}

export function toSolidFeatureCollection(coordinates, safeZones) {
	if (!coordinates || coordinates.length < 2) return null;

	const features = [];
	const coordinatesForBounds = [];
	let currentChunk = [];

	for (const point of coordinates) {
		if (!Array.isArray(point) || point.length < 2) continue;

		if (isInsideSafeZone(point, safeZones)) {
			if (currentChunk.length >= 2) {
				features.push({
					type: 'Feature',
					geometry: {
						type: 'LineString',
						coordinates: currentChunk
					},
					properties: {}
				});
				coordinatesForBounds.push(...currentChunk);
			}
			currentChunk = [];
			continue;
		}

		currentChunk.push(point);
	}

	if (currentChunk.length >= 2) {
		features.push({
			type: 'Feature',
			geometry: {
				type: 'LineString',
				coordinates: currentChunk
			},
			properties: {}
		});
		coordinatesForBounds.push(...currentChunk);
	}

	if (!features.length) return null;

	return {
		type: 'FeatureCollection',
		features,
		coordinatesForBounds
	};
}
