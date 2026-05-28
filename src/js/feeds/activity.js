import { initActivityMaps } from '../modules/mapbox/activity/index';

// Debounce helper: voorkomt dubbele initialisatie bij snelle DOM-mutaties
const scheduleInit = (() => {
	let timer = null;
	return () => {
		window.clearTimeout(timer);
		timer = window.setTimeout(() => initActivityMaps(), 60);
	};
})();

const isActivityNode = (node) => {
	if (!(node instanceof Element)) return false;
	if (node.matches('[data-mapbox-activity]')) return true;
	if (node.matches('script[id^="activity-stream-"]')) return true;
	if (node.matches('script[id^="activity-privacy-zones-"]')) return true;
	if (node.querySelector('[data-mapbox-activity]')) return true;
	if (node.querySelector('script[id^="activity-stream-"]')) return true;
	if (node.querySelector('script[id^="activity-privacy-zones-"]')) return true;
	return false;
};

const observer = new MutationObserver((mutations) => {
	for (const mutation of mutations) {
		if (mutation.type === 'childList') {
			for (const node of mutation.addedNodes) {
				if (isActivityNode(node)) { scheduleInit(); return; }
			}
		}
		if (mutation.type === 'attributes' || mutation.type === 'characterData') {
			const target = mutation.target instanceof Element
				? mutation.target
				: mutation.target?.parentElement ?? null;
			if (target?.closest('[data-mapbox-activity]') || target?.closest('script[id^="activity-stream-"]')) {
				scheduleInit(); return;
			}
		}
	}
});

window.addEventListener('DOMContentLoaded', () => {
	initActivityMaps();
	observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
});
