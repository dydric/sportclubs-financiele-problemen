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

function isValidCoordinates(value) {
	return Array.isArray(value)
		&& value.length >= 2
		&& Number.isFinite(Number(value[0]))
		&& Number.isFinite(Number(value[1]));
}

function parseFavoriteFlag(value) {
	if (value === true || value === 1) return true;
	if (value === false || value === 0 || value == null) return false;
	const normalized = String(value).trim().toLowerCase();
	return ['true', '1', 'yes', 'ja', 'on'].includes(normalized);
}

export function getPoiItems(mapNode) {
	const raw = parseJsonScript(mapNode.dataset.poisId, [], 'POI JSON');
	if (!Array.isArray(raw)) return [];

	return raw
		.filter((item) => item && typeof item === 'object' && isValidCoordinates(item.coordinates))
		.map((item) => ({
			id: String(item.id || ''),
			category: String(item.category || ''),
			favorite: parseFavoriteFlag(item.favorite),
			coordinates: [Number(item.coordinates[0]), Number(item.coordinates[1])]
		}))
		.filter((item) => item.id);
}

export function getPoiListNode(mapNode) {
	const listId = mapNode.dataset.poiListId;
	if (!listId) return null;
	return document.getElementById(listId);
}
