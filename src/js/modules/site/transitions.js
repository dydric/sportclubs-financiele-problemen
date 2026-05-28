// Bestand: js/modules/site/transitions.js

import { log } from './debug.js';

const PAGE_ENTER_KEY = 'dd:page-enter';
const LEAVE_MS = 220;
const ENTER_CLEANUP_MS = 700;

const shouldHandleLink = (link, event) => {
	if (!link || !link.href) return false;
	if (event.defaultPrevented) return false;
	if (event.button !== 0) return false;
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
	if (link.target && link.target !== '_self') return false;
	if (link.hasAttribute('download')) return false;

	const url = new URL(link.href, window.location.href);
	if (url.origin !== window.location.origin) return false;
	if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return false;
	return true;
};

const markNextPageEnter = () => {
	try {
		sessionStorage.setItem(PAGE_ENTER_KEY, '1');
	} catch { /* noop */ }
};

const hasPrePaintEnter = () =>
	document.documentElement.classList.contains('is-page-entering');

const transitions = () => {
	if (hasPrePaintEnter()) {
		window.setTimeout(() => {
			document.documentElement.classList.remove('is-page-entering');
		}, ENTER_CLEANUP_MS);
	}

	// BFCache/history restore: ensure old "leaving" state never keeps content hidden.
	window.addEventListener('pageshow', () => {
		document.body.classList.remove('is-page-leaving');
	});

	document.addEventListener('click', (event) => {
		const link = event.target?.closest?.('a[href]');
		if (!shouldHandleLink(link, event)) return;

		event.preventDefault();
		markNextPageEnter();
		document.body.classList.add('is-page-leaving');

		window.setTimeout(() => {
			window.location.href = link.href;
		}, LEAVE_MS);
	});

	log('View Transitions: JS enter + leave fallback actief');
};

export { transitions };
