import { createPoiMarkerSvg, getPoiIconKey } from './icons';

const MARKER_ID_PREFIX = 'poi-marker';
const MARKER_RENDER_SIZE = 192;
const MARKER_PIXEL_RATIO = 4;

function toDataUrl(svg) {
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadImageElement(src) {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('Unable to load POI marker svg image'));
		image.src = src;
	});
}

export function getMarkerImageId(categoryValue, active = false, favorite = false) {
	const key = getPoiIconKey(categoryValue);
	return `${MARKER_ID_PREFIX}-${key}${favorite ? '-fav' : ''}${active ? '-active' : ''}`;
}

function getRequiredImageIds(poiItems) {
	const variants = new Set();

	for (const poi of poiItems) {
		const key = String(getPoiIconKey(poi.category));
		const favorite = Boolean(poi.favorite);
		variants.add(`${key}|${favorite ? '1' : '0'}`);
	}

	return Array.from(variants).flatMap((variant) => {
		const [categoryKey, favoriteFlag] = variant.split('|');
		const favorite = favoriteFlag === '1';
		return [
			getMarkerImageId(categoryKey, false, favorite),
			getMarkerImageId(categoryKey, true, favorite)
		];
	});
}

export function hasMarkerImages(map, poiItems) {
	return getRequiredImageIds(poiItems).every((id) => map.hasImage(id));
}

export async function ensureMarkerImages(map, poiItems) {
	const variants = new Set();

	for (const poi of poiItems) {
		const key = String(getPoiIconKey(poi.category));
		const favorite = Boolean(poi.favorite);
		variants.add(`${key}|${favorite ? '1' : '0'}`);
	}

	await Promise.all(Array.from(variants, async (variant) => {
		const [categoryKey, favoriteFlag] = variant.split('|');
		const favorite = favoriteFlag === '1';
		const normalId = getMarkerImageId(categoryKey, false, favorite);
		const activeId = getMarkerImageId(categoryKey, true, favorite);

		if (!map.hasImage(normalId)) {
			const normalSvg = await createPoiMarkerSvg(categoryKey, false, MARKER_RENDER_SIZE, favorite);
			const normalImage = await loadImageElement(toDataUrl(normalSvg));
			map.addImage(normalId, normalImage, { pixelRatio: MARKER_PIXEL_RATIO });
		}

		if (!map.hasImage(activeId)) {
			const activeSvg = await createPoiMarkerSvg(categoryKey, true, MARKER_RENDER_SIZE, favorite);
			const activeImage = await loadImageElement(toDataUrl(activeSvg));
			map.addImage(activeId, activeImage, { pixelRatio: MARKER_PIXEL_RATIO });
		}
	}));
}
