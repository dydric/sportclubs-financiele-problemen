function parseJsonScript(scriptId, fallbackValue, warningLabel) {
	if (!scriptId) return fallbackValue;
	const scriptNode = document.getElementById(scriptId);
	if (!scriptNode) return fallbackValue;

	try {
		return JSON.parse(scriptNode.textContent || '');
	} catch (error) {
		console.warn(`Unable to parse ${warningLabel}:`, error);
		return fallbackValue;
	}
}

export function getStreamData(mapNode) {
	return parseJsonScript(mapNode.dataset.streamId, null, 'activity stream JSON');
}

export function getSafeZones(mapNode) {
	const zones = parseJsonScript(mapNode.dataset.safeZonesId, [], 'safe zones JSON');
	return Array.isArray(zones) ? zones : [];
}

export async function getMapboxToken(mapNode) {
	const endpoint = mapNode.dataset.tokenEndpoint || '/.netlify/functions/mapbox-token';
	const response = await fetch(endpoint, { credentials: 'same-origin' });
	if (!response.ok) throw new Error(`Token endpoint failed (${response.status})`);
	const payload = await response.json();
	if (!payload || !payload.token) throw new Error('Token endpoint returned no token');
	return payload.token;
}
