import { initPoiMaps } from '../modules/mapbox/poi/index';

// Debounce helper: voorkomt dubbele initialisatie bij snelle DOM-mutaties
const scheduleInit = (() => {
	let timer = null;
	return () => {
		window.clearTimeout(timer);
		timer = window.setTimeout(() => initPoiMaps(), 60);
	};
})();

const isPoiNode = (node) => {
	if (!(node instanceof Element)) return false;
	if (node.matches('[data-mapbox-poi]')) return true;
	if (node.matches('script[id^="poi-data-"]')) return true;
	if (node.querySelector('[data-mapbox-poi]')) return true;
	if (node.querySelector('script[id^="poi-data-"]')) return true;
	return false;
};

const observer = new MutationObserver((mutations) => {
	for (const mutation of mutations) {
		if (mutation.type === 'childList') {
			for (const node of mutation.addedNodes) {
				if (isPoiNode(node)) { scheduleInit(); return; }
			}
		}
		if (mutation.type === 'attributes' || mutation.type === 'characterData') {
			const target = mutation.target instanceof Element
				? mutation.target
				: mutation.target?.parentElement ?? null;
			if (target?.closest('[data-mapbox-poi]') || target?.closest('script[id^="poi-data-"]')) {
				scheduleInit(); return;
			}
		}
	}
});

window.addEventListener('DOMContentLoaded', () => {
	initPoiMaps();
	observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
});
