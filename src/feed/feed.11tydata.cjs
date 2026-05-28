let getMusicCardDataCached = null;
let getPoiItemsForMapCached = null;
let sortPoiItemsCached = null;
const getMusicCardData = async (item) => {
	if (!getMusicCardDataCached) {
		const mod = await import("../lib/shortcodes/album.js");
		getMusicCardDataCached = mod.getMusicCardData;
	}
	return getMusicCardDataCached(item);
};

const getPoiItemsForMap = async (poiCollection, mapKey) => {
	if (!getPoiItemsForMapCached) {
		const mod = await import("../lib/poi/normalize.js");
		getPoiItemsForMapCached = mod.getPoiItemsForMap;
	}
	return getPoiItemsForMapCached(poiCollection, mapKey);
};

const sortPoiItems = async (items) => {
	if (!sortPoiItemsCached) {
		const mod = await import("../lib/poi/normalize.js");
		sortPoiItemsCached = mod.sortPoiItems;
	}
	return sortPoiItemsCached(items);
};

const toMusicItems = (musicData) => {
	if (!musicData) return [];
	if (Array.isArray(musicData)) return musicData;
	if (Array.isArray(musicData.items)) return musicData.items;
	return [];
};

const isAppleItem = (item = {}) =>
	Boolean(
		item.apple ||
		((item.kind === "album" && item.url) && (item.provider === "apple" || !item.provider))
	);

const normalizeMapKey = (value) =>
	String(value || "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

const formatMapLabel = (value) => {
	const raw = String(value || "").trim();
	if (!raw) return "";
	const normalized = raw.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
	if (!normalized) return "";
	return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

const toArray = (value) => (Array.isArray(value) ? value : (value == null ? [] : [value]));

const normalizeMapEntry = (value) => {
	if (value == null) return null;
	if (typeof value === "object" && !Array.isArray(value)) {
		const rawKey = value.key ?? value.map ?? value.kaart ?? value.value ?? value.id ?? value.name ?? value.title ?? "";
		const key = normalizeMapKey(rawKey);
		if (!key) return null;
		const labelRaw = String(value.label ?? value.title ?? value.name ?? "").trim();
		return { key, label: labelRaw || formatMapLabel(rawKey || key) };
	}

	const key = normalizeMapKey(value);
	if (!key) return null;
	return { key, label: formatMapLabel(value || key) };
};

const uniqueMapEntries = (entries = []) => {
	const map = new Map();
	for (const entry of entries) {
		if (!entry?.key) continue;
		if (!map.has(entry.key)) map.set(entry.key, entry);
	}
	return Array.from(map.values());
};

const extractPoiMapConfig = (data = {}) => {
	const kaartValue = data?.kaart;
	const mapValue = data?.map;
	const subsValue = data?.subs;

	let mainEntries = [];
	let subEntries = [];

	let hasStructuredMainSubs = false;
	if (kaartValue && typeof kaartValue === "object" && !Array.isArray(kaartValue)) {
		hasStructuredMainSubs = true;
		const primarySource = kaartValue.main ?? kaartValue.primary ?? kaartValue.map ?? kaartValue.kaart ?? kaartValue.key ?? mapValue;
		mainEntries = toArray(primarySource).map(normalizeMapEntry).filter(Boolean);
		subEntries = toArray(kaartValue.subs ?? subsValue).map(normalizeMapEntry).filter(Boolean);
	} else {
		const primarySource = kaartValue ?? mapValue;
		mainEntries = toArray(primarySource).map(normalizeMapEntry).filter(Boolean);
		subEntries = toArray(subsValue).map(normalizeMapEntry).filter(Boolean);
	}

	const entries = uniqueMapEntries([...mainEntries, ...subEntries]);
	const mapKeys = entries.map((entry) => entry.key);
	const primaryMapKey = mapKeys[0] || "";

	const groupsEnabled = entries.length > 1;
	const mainKeys = uniqueMapEntries(mainEntries).map((entry) => entry.key);
	const subKeys = uniqueMapEntries(subEntries).map((entry) => entry.key);
	const displayEntries = hasStructuredMainSubs
		? uniqueMapEntries([...mainEntries, ...subEntries])
		: entries;
	const groupDefs = groupsEnabled
		? displayEntries.map((entry) => ({
			...entry,
			isPrimary: mainKeys.includes(entry.key),
		}))
		: [];

	return { primaryMapKey, mapKeys, groupDefs, mainKeys, subKeys, hasStructuredMainSubs };
};

const poiMatchesMapKey = (poi, mapKey) => {
	if (!poi || !mapKey) return false;
	if (Array.isArray(poi.mapKeys) && poi.mapKeys.length) return poi.mapKeys.includes(mapKey);
	return poi.mapKey === mapKey;
};

const dedupePoiItems = (items = []) => {
	const map = new Map();
	for (const item of items) {
		if (!item || !item.id) continue;
		if (!map.has(item.id)) map.set(item.id, item);
	}
	return Array.from(map.values());
};

const getPoiItemsForMapKeysFromNotion = (notionPoiByMap, mapKeys = []) => {
	if (!notionPoiByMap || typeof notionPoiByMap !== "object" || !mapKeys.length) return [];
	const merged = [];
	for (const key of mapKeys) {
		const list = notionPoiByMap[key];
		if (Array.isArray(list) && list.length) merged.push(...list);
	}
	return dedupePoiItems(merged);
};

const buildPoiGroups = async (groupDefs = [], items = [], options = {}) => {
	if (!Array.isArray(groupDefs) || groupDefs.length < 2 || !Array.isArray(items) || !items.length) return [];
	const mainKeys = Array.isArray(options.mainKeys) ? options.mainKeys : [];
	const subKeys = Array.isArray(options.subKeys) ? options.subKeys : [];
	const structuredMode = Boolean(options.structuredMode);

	const groups = groupDefs.map((group) => ({
		key: group.key,
		title: group.label || formatMapLabel(group.key),
		isPrimary: Boolean(group.isPrimary),
		items: [],
	}));

	for (const poi of items) {
		let group = null;
		if (structuredMode && subKeys.length) {
			group = groups.find((entry) => subKeys.includes(entry.key) && poiMatchesMapKey(poi, entry.key));
			if (!group && mainKeys.length) {
				group = groups.find((entry) => mainKeys.includes(entry.key) && poiMatchesMapKey(poi, entry.key));
			}
		} else {
			group = groups.find((entry) => poiMatchesMapKey(poi, entry.key));
		}
		if (group) group.items.push(poi);
	}

	for (const group of groups) {
		group.items = await sortPoiItems(group.items);
	}

	return groups.filter((group) => group.items.length);
};

const resolvePoiItems = async (data = {}) => {
	const { mapKeys, primaryMapKey } = extractPoiMapConfig(data);
	if (!mapKeys.length || !primaryMapKey) return [];

	const notionPoiByMap = data?.notionPoi?.byMap || null;
	const notionByMapItems = getPoiItemsForMapKeysFromNotion(notionPoiByMap, mapKeys);
	if (notionByMapItems.length) {
		return sortPoiItems(notionByMapItems);
	}

	const notionPoiItems = data?.notionPoi?.items || data?.notionPoi || [];
	if (Array.isArray(notionPoiItems) && notionPoiItems.length) {
		return sortPoiItems(notionPoiItems.filter((poi) => {
			if (!poi) return false;
			return mapKeys.some((key) => poiMatchesMapKey(poi, key));
		}));
	}

	const poiCollection = data?.collections?.POI || data?.collections?.poi || [];
	if (!Array.isArray(poiCollection) || !poiCollection.length) return [];

	const fromCollection = [];
	for (const mapKey of mapKeys) {
		const items = await getPoiItemsForMap(poiCollection, mapKey);
		if (Array.isArray(items) && items.length) fromCollection.push(...items);
	}
	return sortPoiItems(dedupePoiItems(fromCollection));
};

const getFeedPermalinkSlug = (fileSlug) => {
	const slug = String(fileSlug || "").trim();
	if (!slug) return "";

	const match = slug.match(/^(\d+)-(.+)$/);
	if (match && match[2]) return match[2];
	return slug;
};

module.exports = {
	eleventyComputed: {
		permalink: (data) => {
			if (typeof data?.permalink === "string" && data.permalink.trim()) {
				return data.permalink;
			}

			const slug = getFeedPermalinkSlug(data?.page?.fileSlug);
			if (!slug) return "/archief/";
			const typePrefix = { recipe: "recept", poi: "kaart", music: "muziek", activity: "activiteit" }[data?.type];
			return typePrefix ? `/${typePrefix}/${slug}/` : `/${slug}/`;
		},
		musicCards: async (data) => {
			const items = toMusicItems(data?.music);
			if (!items.length) return [];

			const cards = [];
			for (const item of items) {
				let albumData = null;
				if (isAppleItem(item)) {
					try {
						albumData = await getMusicCardData(item);
					} catch {
						albumData = null;
					}
				}
				cards.push({ item, albumData });
			}
			return cards;
		},
		poiMapKey: (data) => extractPoiMapConfig(data).primaryMapKey,
		poiMapKeys: (data) => extractPoiMapConfig(data).mapKeys,
		poiItems: async (data) => {
			if (data?.type !== "poi") return [];
			return resolvePoiItems(data);
		},
		poiGroups: async (data) => {
			if (data?.type !== "poi") return [];
			const { groupDefs, mainKeys, subKeys, hasStructuredMainSubs } = extractPoiMapConfig(data);
			if (!groupDefs.length) return [];
			const items = Array.isArray(data?.poiItems) && data.poiItems.length ? data.poiItems : await resolvePoiItems(data);
			return buildPoiGroups(groupDefs, items, { mainKeys, subKeys, structuredMode: hasStructuredMainSubs });
		}
	},
};
