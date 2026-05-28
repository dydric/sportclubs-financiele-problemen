import { getPoiCategoryIconKey, getPoiCategoryIconPath } from '../../../../lib/poi/normalize.js';

const ICON_CACHE = new Map();
const ICON_SCALE = 14 / 24;
const ICON_TRANSLATE = 21 - (12 * ICON_SCALE);

function readThemeColor({ className, property, fallback }) {
	const probe = document.createElement('span');
	probe.className = className;
	probe.style.position = 'absolute';
	probe.style.opacity = '0';
	probe.style.pointerEvents = 'none';
	probe.style.width = '0';
	probe.style.height = '0';
	probe.style.overflow = 'hidden';
	document.body.appendChild(probe);

	const value = getComputedStyle(probe)[property];
	probe.remove();

	return (!value || value === 'rgba(0, 0, 0, 0)' || value === 'transparent') ? fallback : value;
}

function getMarkerThemeColors() {
	const accent1 = readThemeColor({
		className: 'bg-accent-1',
		property: 'backgroundColor',
		fallback: 'rgb(29, 78, 216)'
	});
	return { fill: accent1, icon: 'rgb(255, 255, 255)' };
}

function extractSvgInnerMarkup(svgText) {
	const match = String(svgText || '').match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
	return (match && match[1]) ? match[1].trim() : '';
}

async function loadIconMarkup(iconKey) {
	if (ICON_CACHE.has(iconKey)) return ICON_CACHE.get(iconKey);

	const iconPromise = (async () => {
		const primaryUrl = getPoiCategoryIconPath(iconKey);
		const fallbackUrl = getPoiCategoryIconPath('none');

		const loadFromUrl = async (url) => {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`Unable to load ${url}`);
			return extractSvgInnerMarkup(await response.text());
		};

		try {
			return await loadFromUrl(primaryUrl);
		} catch {
			return loadFromUrl(fallbackUrl);
		}
	})();

	ICON_CACHE.set(iconKey, iconPromise);
	return iconPromise;
}

export function getPoiIconKey(categoryValue) {
	return getPoiCategoryIconKey(categoryValue);
}

export async function createPoiMarkerSvg(categoryValue, active = false, renderSize = 96, favorite = false) {
	const iconKey = getPoiIconKey(categoryValue);
	const themeColors = getMarkerThemeColors();
	const useInvertedPalette = favorite || active;
	const palette = useInvertedPalette
		? { fill: themeColors.icon, icon: themeColors.fill }
		: themeColors;
	const iconMarkup = await loadIconMarkup(iconKey);
	const radius = active ? 16 : 13;

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${renderSize}" height="${renderSize}" viewBox="0 0 42 42" role="img" aria-hidden="true"><circle cx="21" cy="21" r="${radius}" fill="${palette.fill}" stroke="${palette.icon}" stroke-width="2"/><g transform="translate(${ICON_TRANSLATE} ${ICON_TRANSLATE}) scale(${ICON_SCALE})" fill="${palette.icon}">${iconMarkup}</g></svg>`;
}
