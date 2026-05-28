import {
	DEFAULT_LIGHT_PRESET_DARK,
	DEFAULT_LIGHT_PRESET_LIGHT,
	DEFAULT_MAP_THEME,
	DEFAULT_STYLE_DARK,
	DEFAULT_STYLE_LIGHT
} from './constants';

function isDarkModeActive() {
	const root = document.documentElement;
	if (root.classList.contains('dark')) return true;
	if (root.dataset && root.dataset.theme === 'dark') return true;
	return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function getPreferredStyle(mapNode) {
	const lightStyle = mapNode.dataset.mapStyleLight || DEFAULT_STYLE_LIGHT;
	const darkStyle = mapNode.dataset.mapStyleDark || DEFAULT_STYLE_DARK;
	return isDarkModeActive() ? darkStyle : lightStyle;
}

export function getPreferredLightPreset(mapNode) {
	return isDarkModeActive()
		? (mapNode.dataset.lightPresetDark || DEFAULT_LIGHT_PRESET_DARK)
		: (mapNode.dataset.lightPresetLight || DEFAULT_LIGHT_PRESET_LIGHT);
}

export function applyBasemapPresentation(map, mapNode) {
	if (!map || typeof map.setConfigProperty !== 'function') return;

	const theme = mapNode.dataset.mapTheme || DEFAULT_MAP_THEME;
	const lightPreset = getPreferredLightPreset(mapNode);

	try {
		map.setConfigProperty('basemap', 'theme', theme);
		map.setConfigProperty('basemap', 'lightPreset', lightPreset);
	} catch (error) {
		console.warn('Unable to apply basemap presentation config:', error);
	}
}
