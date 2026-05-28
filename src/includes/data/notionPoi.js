import { getNotionPoiPages } from '../providers/notion-poi.js';
import { normalizeCategoryKey, normalizeMapKey } from '../../lib/poi/normalize.js';

const DEBUG_NOTION_POI = process.env.DEBUG_NOTION_POI === '1';

function debugLog(message, payload = null) {
	if (!DEBUG_NOTION_POI) return;
	if (payload) {
		console.log(`[notion-poi] ${message}`, payload);
		return;
	}
	console.log(`[notion-poi] ${message}`);
}

function toSlug(value) {
	return String(value || '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function getPropertyByCandidates(properties, candidates = []) {
	const entries = Object.entries(properties || {});
	for (const candidate of candidates) {
		const wanted = String(candidate).toLowerCase();
		const hit = entries.find(([key]) => {
			const normalizedKey = String(key).toLowerCase();
			return normalizedKey === wanted || normalizedKey.includes(wanted);
		});
		if (hit) return hit[1];
	}
	return null;
}

function getPageLabel(page) {
	const properties = page?.properties || {};
	const titleProp = Object.values(properties).find((prop) => prop?.type === 'title');
	const title = getTextPropertyValue(titleProp);
	return title || String(page?.id || 'unknown-page');
}

function plainTextFromRichItems(items = []) {
	if (!Array.isArray(items)) return '';
	return items.map((item) => String(item?.plain_text || '')).join('').trim();
}

function getTextPropertyValue(property) {
	if (!property || typeof property !== 'object') return '';

	if (property.type === 'title') return plainTextFromRichItems(property.title);
	if (property.type === 'rich_text') return plainTextFromRichItems(property.rich_text);
	if (property.type === 'select') return String(property.select?.name || '').trim();
	if (property.type === 'url') return String(property.url || '').trim();
	if (property.type === 'email') return String(property.email || '').trim();
	if (property.type === 'phone_number') return String(property.phone_number || '').trim();
	if (property.type === 'number') return Number.isFinite(property.number) ? String(property.number) : '';
	if (property.type === 'formula') {
		const formula = property.formula || {};
		if (formula.type === 'string') return String(formula.string || '').trim();
		if (formula.type === 'number' && Number.isFinite(formula.number)) return String(formula.number);
	}

	return '';
}

function getMapKeysPropertyValue(property) {
	if (!property || typeof property !== 'object') return [];

	if (property.type === 'multi_select') {
		const values = Array.isArray(property.multi_select) ? property.multi_select : [];
		return values
			.map((entry) => normalizeMapKey(String(entry?.name || '').trim()))
			.filter(Boolean);
	}

	if (property.type === 'select') {
		const single = normalizeMapKey(String(property.select?.name || '').trim());
		return single ? [single] : [];
	}

	const raw = getTextPropertyValue(property);
	if (!raw) return [];

	return String(raw)
		.split(/[;,|]/)
		.map((part) => normalizeMapKey(part))
		.filter(Boolean);
}

function getUrlPropertyValue(property) {
	const value = getTextPropertyValue(property);
	if (!value) return '';
	if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value;
	return '';
}

function getCheckboxPropertyValue(property) {
	if (!property || typeof property !== 'object') return false;
	if (property.type === 'checkbox') return Boolean(property.checkbox);

	const value = getTextPropertyValue(property).toLowerCase();
	if (!value) return false;
	return ['true', 'yes', 'ja', '1', 'aan', 'on'].includes(value);
}

function parseCoordinatesFromString(value) {
	const raw = String(value || '').trim();
	if (!raw) return null;

	const numericTokens = raw.match(/-?\d+(?:[.,]\d+)?/g) || [];
	if (numericTokens.length < 2) return null;

	let first = null;
	let second = null;

	// Locale fallback: "5,7991,53,2017" -> 5.7991 / 53.2017
	if (numericTokens.length >= 4 && raw.includes(',') && !raw.includes('.')) {
		first = Number(`${numericTokens[0]}.${numericTokens[1]}`);
		second = Number(`${numericTokens[2]}.${numericTokens[3]}`);
	} else {
		first = Number(String(numericTokens[0]).replace(',', '.'));
		second = Number(String(numericTokens[1]).replace(',', '.'));
	}

	if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

	let lng = first;
	let lat = second;

	// Heuristics to support either "lng,lat" or "lat,lng"
	if (Math.abs(first) <= 90 && Math.abs(second) > 90) {
		lng = second;
		lat = first;
	} else if (Math.abs(first) <= 90 && Math.abs(second) <= 90 && Math.abs(first) > (Math.abs(second) + 8)) {
		// Example NL style "53.20, 5.79" -> lat,lng
		lng = second;
		lat = first;
	}

	if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
	return [lng, lat];
}

function parseCoordinates(properties) {
	const coordinateTextProp = getPropertyByCandidates(properties, ['coordinaten', 'coordinates', 'lnglat', 'latlng']);
	const fromText = parseCoordinatesFromString(getTextPropertyValue(coordinateTextProp));
	if (fromText) return fromText;

	const lngProp = getPropertyByCandidates(properties, ['lng', 'lon', 'longitude']);
	const latProp = getPropertyByCandidates(properties, ['lat', 'latitude']);
	const lngRaw = getTextPropertyValue(lngProp);
	const latRaw = getTextPropertyValue(latProp);
	if (!lngRaw || !latRaw) return null;

	const lng = Number(String(lngRaw).replace(',', '.'));
	const lat = Number(String(latRaw).replace(',', '.'));
	if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
	if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
	return [lng, lat];

	return null;
}

function isPublished(properties) {
	const statusProp = getPropertyByCandidates(properties, ['status', 'public', 'published']);
	if (!statusProp) return true;

	const value = getTextPropertyValue(statusProp).toLowerCase();
	if (!value) return true;
	if (['no', 'false', 'draft', 'concept'].includes(value)) return false;
	return true;
}

function normalizeNotionPoiPage(page, index) {
	const properties = page?.properties || {};
	if (!isPublished(properties)) return { item: null, reason: 'not_published' };

	const nameProp = getPropertyByCandidates(properties, ['naam', 'name', 'titel', 'title']);
	const mapProp = getPropertyByCandidates(properties, ['kaart', 'map', 'gebied', 'area']);
	const categoryProp = getPropertyByCandidates(properties, ['category', 'categorie']);
	const addressProp = getPropertyByCandidates(properties, ['adres', 'address', 'locatie']);
	const descriptionProp = getPropertyByCandidates(properties, ['omschrijving', 'description', 'beschrijving']);
	const urlProp = getPropertyByCandidates(properties, ['url', 'link', 'website']);
	const favoriteProp = getPropertyByCandidates(properties, ['favoriet', 'favorite', 'favourite', 'fav']);

	const name = getTextPropertyValue(nameProp);
	const mapKeys = getMapKeysPropertyValue(mapProp);
	const mapKey = mapKeys[0] || '';
	const rawCategory = getTextPropertyValue(categoryProp);
	const category = normalizeCategoryKey(rawCategory);
	const coordinates = parseCoordinates(properties);

	if (!name) return { item: null, reason: 'missing_name' };
	if (!mapKey) return { item: null, reason: 'missing_map' };
	if (!coordinates) return { item: null, reason: 'missing_or_invalid_coordinates' };

	const fallbackId = `notion-poi-${index + 1}`;
	const notionId = String(page?.id || '').replace(/-/g, '');
	const id = toSlug(name) || notionId || fallbackId;

	return {
		reason: null,
		item: {
		id,
		name,
		mapKey,
			mapKeys,
			category,
				categoryLabel: rawCategory || category,
				coordinates,
				address: getTextPropertyValue(addressProp),
				description: getTextPropertyValue(descriptionProp),
				url: getUrlPropertyValue(urlProp),
				favorite: getCheckboxPropertyValue(favoriteProp)
				}
			};
}

export default async function notionPoi() {
	const pages = await getNotionPoiPages();
	if (!pages.length) {
		debugLog('No pages returned from Notion. Fallback to local src/poi collection will be used.');
		return { items: [], byMap: {}, meta: { sourceCount: 0, normalizedCount: 0 } };
	}

	const reasonCounts = new Map();
	const skippedSamples = [];
	const normalized = pages
		.map((page, index) => ({ page, result: normalizeNotionPoiPage(page, index) }))
		.map((result) => {
			const page = result.page;
			const normalizedResult = result.result;
			if (!normalizedResult?.item && normalizedResult?.reason) {
				reasonCounts.set(normalizedResult.reason, (reasonCounts.get(normalizedResult.reason) || 0) + 1);
				if (skippedSamples.length < 8) {
					skippedSamples.push({
						reason: normalizedResult.reason,
						label: getPageLabel(page),
						properties: Object.keys(page?.properties || {})
					});
				}
			}
			return normalizedResult?.item || null;
		})
		.filter(Boolean)
		.sort((a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }));

	const byMap = normalized.reduce((acc, item) => {
		const mapKeys = Array.isArray(item.mapKeys) && item.mapKeys.length
			? item.mapKeys
			: [item.mapKey].filter(Boolean);
		for (const key of mapKeys) {
			if (!acc[key]) acc[key] = [];
			acc[key].push(item);
		}
		return acc;
	}, {});

	const mapKeys = Array.from(new Set(normalized.flatMap((item) => (
		Array.isArray(item.mapKeys) && item.mapKeys.length ? item.mapKeys : [item.mapKey]
	)))).filter(Boolean).sort();
	debugLog(`Fetched ${pages.length} Notion rows; normalized ${normalized.length} POIs.`);
	if (reasonCounts.size) debugLog('Skipped rows by reason', Object.fromEntries(reasonCounts));
	if (skippedSamples.length) debugLog('Skipped row samples', skippedSamples);
	debugLog('Detected map keys', mapKeys);

	return {
		items: normalized,
		byMap,
		meta: {
			sourceCount: pages.length,
			normalizedCount: normalized.length
		}
	};
}
