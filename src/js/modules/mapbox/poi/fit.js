import { getFitPadding } from '../activity/constants';

function clampDurationMs(value) {
	const duration = Number(value);
	if (!Number.isFinite(duration)) return 0;
	return Math.max(0, Math.min(duration, 2000));
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function parsePaddingOverride(rawValue) {
	if (!rawValue) return null;
	const value = Number(rawValue);
	if (!Number.isFinite(value) || value < 0) return null;
	return Math.round(value);
}

function readCssPx(name, fallback) {
	if (typeof window === 'undefined') return fallback;
	const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
	const value = parseFloat(raw);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getAdaptiveFitPadding(mapNode) {
	const base = getFitPadding(mapNode);
	const rect = mapNode?.getBoundingClientRect?.() || { width: 0, height: 0 };
	const width = Math.max(0, Math.round(rect.width || 0));
	const height = Math.max(0, Math.round(rect.height || 0));
	const shortSide = Math.max(220, Math.min(width || 220, height || 220));
	const edgePadding = clamp(Math.round(shortSide * 0.1), 20, 48);
	const isMobile = window.matchMedia('(max-width: 1023px)').matches;

	const headerHeight = readCssPx('--header-height', 77);
	const footerHeight = readCssPx('--footer-height', 74);
	const headerPad = Math.round(headerHeight + 12);
	const footerPad = Math.round(footerHeight + 12);
	const controlPadRight = isMobile ? 56 : 64;

	const adaptive = {
		top: Math.max(base.top, edgePadding, headerPad),
		right: Math.max(base.right, edgePadding, controlPadRight),
		bottom: Math.max(base.bottom, edgePadding, footerPad),
		left: Math.max(base.left, edgePadding)
	};

	if (isMobile) {
		const mobileBottom = clamp(Math.round((height || 320) * 0.18), 30, 82);
		adaptive.bottom = Math.max(adaptive.bottom, mobileBottom, footerPad);
	}

	const topOverride = parsePaddingOverride(mapNode?.dataset?.poiFitPaddingTop);
	const rightOverride = parsePaddingOverride(mapNode?.dataset?.poiFitPaddingRight);
	const bottomOverride = parsePaddingOverride(mapNode?.dataset?.poiFitPaddingBottom);
	const leftOverride = parsePaddingOverride(mapNode?.dataset?.poiFitPaddingLeft);
	const allOverride = parsePaddingOverride(mapNode?.dataset?.poiFitPadding);

	if (allOverride !== null) {
		return {
			top: allOverride,
			right: allOverride,
			bottom: allOverride,
			left: allOverride
		};
	}

	return {
		top: topOverride ?? adaptive.top,
		right: rightOverride ?? adaptive.right,
		bottom: bottomOverride ?? adaptive.bottom,
		left: leftOverride ?? adaptive.left
	};
}

export function getPoiAdaptiveFitPadding(mapNode) {
	return getAdaptiveFitPadding(mapNode);
}

function getPoiFitMaxZoom(mapNode) {
	const raw = Number(mapNode?.dataset?.poiFitMaxZoom);
	if (!Number.isFinite(raw)) return 16;
	return clamp(raw, 3, 20);
}

function getPoiBounds(mapboxgl, poiItems) {
	if (!Array.isArray(poiItems) || !poiItems.length) return null;
	const first = poiItems[0].coordinates;
	return poiItems.reduce((acc, poi) => acc.extend(poi.coordinates), new mapboxgl.LngLatBounds(first, first));
}

function getPoiFitOptions(mapNode, durationMs = 0) {
	return {
		padding: getAdaptiveFitPadding(mapNode),
		maxZoom: getPoiFitMaxZoom(mapNode),
		duration: clampDurationMs(durationMs)
	};
}

export function getPoiBoundsZoom(mapboxgl, map, poiItems, mapNode) {
	const bounds = getPoiBounds(mapboxgl, poiItems);
	if (!bounds || !map || typeof map.cameraForBounds !== 'function') return null;

	const camera = map.cameraForBounds(bounds, getPoiFitOptions(mapNode, 0));
	const zoom = Number(camera?.zoom);
	return Number.isFinite(zoom) ? zoom : null;
}

export function syncPoiMinZoom(mapboxgl, map, poiItems, mapNode, epsilon = 0.02) {
	if (!map || typeof map.setMinZoom !== 'function') return null;
	const fitZoom = getPoiBoundsZoom(mapboxgl, map, poiItems, mapNode);
	if (!Number.isFinite(fitZoom)) return null;
	const minZoom = Math.max(0, fitZoom - Math.max(0, Number(epsilon) || 0));
	map.setMinZoom(minZoom);
	return minZoom;
}

export function fitPoiBounds(mapboxgl, map, poiItems, mapNode, durationMs = 0) {
	const bounds = getPoiBounds(mapboxgl, poiItems);
	if (!bounds) return;
	map.fitBounds(bounds, getPoiFitOptions(mapNode, durationMs));
}
