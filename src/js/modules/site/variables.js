(function () {
	const DEBOUNCE_MS = 60;

	let rafId = 0;
	let pending = false;

	function scheduleUpdate() {
		if (pending) return;
		pending = true;
		cancelAnimationFrame(rafId);
		rafId = requestAnimationFrame(() => {
			pending = false;
			updateLayoutVars();
		});
	}

	function getContainerWidth() {
		const c = document.querySelector('.container');
		return c ? c.clientWidth : document.documentElement.clientWidth;
	}

	function computeLayout() {
		const vw = document.documentElement.clientWidth;
		const mainEl = document.querySelector('main');
		const scrollbar = mainEl ? (mainEl.offsetWidth - mainEl.clientWidth) : 0;
		const vh = (window.innerHeight * 0.01);
		const containerWidth = getContainerWidth();

		return { vw, vh, scrollbar, containerWidth };
	}

	function setRootVars({ vh, scrollbar, containerWidth }) {
		const root = document.documentElement;
		root.style.setProperty('--vh', `${vh}px`);
		root.style.setProperty('--scrollbar', `${scrollbar}px`);
		root.style.setProperty('--container-width', `${containerWidth}px`);
	}

	function updateLayoutVars() {
		setRootVars(computeLayout());
	}

	let t;
	function onResize() {
		clearTimeout(t);
		t = setTimeout(scheduleUpdate, DEBOUNCE_MS);
	}

	function observeElem(selector) {
		const el = document.querySelector(selector);
		if (!el || typeof ResizeObserver === 'undefined') return;
		const ro = new ResizeObserver(() => scheduleUpdate());
		ro.observe(el);
	}

	function bindVisualViewport() {
		if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
			window.visualViewport.addEventListener('resize', onResize, { passive: true });
		}
	}

	window.addEventListener('DOMContentLoaded', () => {
		scheduleUpdate();
		observeElem('.container');
		bindVisualViewport();
	});

	window.addEventListener('resize', onResize, { passive: true });
})();
