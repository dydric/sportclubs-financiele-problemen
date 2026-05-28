const DEFAULT_CATEGORY = 'overig';

const CATEGORY_ICON_KEYS = new Set([
	'activiteit',
	'bank',
	'bakker',
	'bioscoop',
	'cafe',
	'gebouw',
	'fitness',
	'hotel',
	'ijs',
	'koffie',
	'locatie',
	'markt',
	'museum',
	'muziek',
	'none',
	'restaurant',
	'strand',
	'supermarkt',
	'terras',
	'trein',
	'uitgaan',
	'vliegveld',
	'voetbal',
	'winkel',
	'ziekenhuis'
]);

function toSlug(value) {
	return String(value || '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function normalizeMapKey(value) {
	return toSlug(value);
}

export function normalizeCategoryKey(value) {
	const key = toSlug(value);
	if (!key) return DEFAULT_CATEGORY;
	return key;
}

export function getPoiCategoryIconKey(categoryValue) {
	const categoryKey = normalizeCategoryKey(categoryValue);
	return CATEGORY_ICON_KEYS.has(categoryKey) ? categoryKey : 'none';
}

export function getPoiCategoryIconPath(categoryValue) {
	return `/assets/poi/${getPoiCategoryIconKey(categoryValue)}.svg`;
}

export function enrichPoiItem(item = {}) {
	const rawCategory = String(item?.category || item?.categoryLabel || '').trim();
	const category = normalizeCategoryKey(rawCategory);

	return {
		...item,
		category,
		categoryLabel: String(item?.categoryLabel || rawCategory || DEFAULT_CATEGORY),
		iconPath: String(item?.iconPath || getPoiCategoryIconPath(category))
	};
}

export function sortPoiItems(items = []) {
	return items.map((item) => enrichPoiItem(item)).sort((a, b) => {
		const aCategory = String(a?.categoryLabel || a?.category || 'overig');
		const bCategory = String(b?.categoryLabel || b?.category || 'overig');
		const categoryCompare = aCategory.localeCompare(bCategory, 'nl', { sensitivity: 'base' });
		if (categoryCompare !== 0) return categoryCompare;

		const aName = String(a?.name || '');
		const bName = String(b?.name || '');
		return aName.localeCompare(bName, 'nl', { sensitivity: 'base' });
	});
}

function parseCoordinatePair(value) {
	if (Array.isArray(value) && value.length >= 2) {
		const lng = Number(value[0]);
		const lat = Number(value[1]);
		if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
	}

	if (value && typeof value === 'object') {
		const lng = Number(value.lng ?? value.lon ?? value.longitude);
		const lat = Number(value.lat ?? value.latitude);
		if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
	}

	if (typeof value === 'string') {
		const [lngRaw, latRaw] = value.split(',').map((part) => part.trim());
		const lng = Number(lngRaw);
		const lat = Number(latRaw);
		if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
	}

	return null;
}

function normalizePoiItem(item, index = 0) {
	if (!item || !item.data) return null;

	const mapKey = normalizeMapKey(item.data.kaart ?? item.data.map);
	if (!mapKey) return null;

	const name = String(item.data.naam ?? item.data.name ?? item.data.title ?? '').trim();
	if (!name) return null;

	const coordinates = parseCoordinatePair(item.data.coordinaten ?? item.data.coordinates);
	if (!coordinates) return null;

	const rawCategory = String(item.data.category || '').trim();
	const category = normalizeCategoryKey(rawCategory);
	const idBase = toSlug(item.data.id ?? item.fileSlug ?? name) || `poi-${index + 1}`;
	const rawUrl = String(item.data.url || '').trim();
	const url = /^https?:\/\//i.test(rawUrl) || rawUrl.startsWith('/') ? rawUrl : '';

	return {
		id: idBase,
		name,
		mapKey,
		category,
		categoryLabel: rawCategory || 'overig',
		iconPath: getPoiCategoryIconPath(category),
		coordinates,
		address: String(item.data.adres ?? item.data.address ?? item.data.locatie ?? '').trim(),
		description: String(item.data.omschrijving ?? item.data.description ?? '').trim(),
		url
	};
}

export function normalizePoiCollectionItems(items = []) {
	const normalized = [];

	items.forEach((item, index) => {
		const poi = normalizePoiItem(item, index);
		if (poi) normalized.push(poi);
	});

	return sortPoiItems(normalized);
}

export function getPoiItemsForMap(items = [], mapKeyValue = '') {
	const mapKey = normalizeMapKey(mapKeyValue);
	if (!mapKey) return [];

	return normalizePoiCollectionItems(items).filter((poi) => poi.mapKey === mapKey);
}
