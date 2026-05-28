export const DEFAULT_STYLE_LIGHT = 'mapbox://styles/mapbox/standard';
export const DEFAULT_STYLE_DARK = 'mapbox://styles/mapbox/standard';
export const DEFAULT_MAP_THEME = 'monochrome';
export const DEFAULT_LIGHT_PRESET_LIGHT = 'day';
export const DEFAULT_LIGHT_PRESET_DARK = 'night';
export const DEFAULT_LINE_COLOR = '#f97316';
export const MAP_REVEAL_TIMEOUT_MS = 3000;

export const DEFAULT_SPEED_COLORS = {
	slow: '#ef4444',
	medium: '#f59e0b',
	fast: '#22c55e'
};

export function isDesktopViewport() {
	return window.matchMedia('(min-width: 1024px)').matches;
}

export function buildZoomWidthExpression(minWidth, midWidth, maxWidth) {
	return [
		'interpolate',
		['linear'],
		['zoom'],
		8, minWidth,
		12, midWidth,
		16, maxWidth
	];
}

export function getRouteWidthConfig() {
	if (isDesktopViewport()) {
		return {
			line: buildZoomWidthExpression(7.6, 10.2, 13.2),
			casing: buildZoomWidthExpression(12.4, 16.4, 21)
		};
	}

	return {
		line: buildZoomWidthExpression(5.8, 7.6, 10),
		casing: buildZoomWidthExpression(9.4, 12.2, 15.6)
	};
}

function readCssPx(name, fallback) {
	if (typeof window === 'undefined') return fallback;
	const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
	const value = parseFloat(raw);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getFitPadding() {
	const base = isDesktopViewport()
		? { top: 36, right: 36, bottom: 36, left: 36 }
		: { top: 28, right: 28, bottom: 28, left: 28 };

	const headerPad = Math.round(readCssPx('--header-height', 77) + 12);
	const footerPad = Math.round(readCssPx('--footer-height', 74) + 12);

	return {
		top: Math.max(base.top, headerPad),
		right: base.right,
		bottom: Math.max(base.bottom, footerPad),
		left: base.left
	};
}
