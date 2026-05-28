// File: js/modules/site/variables.js

import { log, warn } from './debug.js';

(function () {
	const DEBOUNCE_MS = 60;

	// ✅ Prevent ResizeObserver feedback loops
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
		if (!c) warn('⚠️ .container niet gevonden – fallback op root width');
		return c ? c.clientWidth : document.documentElement.clientWidth;
	}

	function getElemHeight(selector) {
		const el = document.querySelector(selector);
		if (!el) {
			warn(`⚠️ ${selector} niet gevonden – height=0`);
			return 0;
		}

		return Math.round(el.getBoundingClientRect().height);
	}

	function computeLayout() {
		const vw = document.documentElement.clientWidth;
		const mainEl = document.querySelector('main');
		const scrollbar = mainEl ? (mainEl.offsetWidth - mainEl.clientWidth) : 0;
		const vh = (window.innerHeight * 0.01);
		const containerWidth = getContainerWidth();
		const side = Math.max(0, (vw - containerWidth) / 2);

		const footerHeight = getElemHeight('footer');

		log(`📐 Layout berekend: vw=${vw}, scrollbar=${scrollbar}, vh=${vh.toFixed(2)}, side=${side}, footer=${footerHeight}`);

		return { vw, vh, scrollbar, containerWidth, side, footerHeight };
	}

	function setRootVars({ vh, scrollbar, containerWidth, footerHeight }) {
		const root = document.documentElement;

		root.style.setProperty('--vh', `${vh}px`);
		root.style.setProperty('--scrollbar', `${scrollbar}px`);
		root.style.setProperty('--container-width', `${containerWidth}px`);
		root.style.setProperty('--footer-height', `${footerHeight}px`);

		log('🪄 Root CSS vars bijgewerkt');
	}

	function updateLayoutVars() {
		const vals = computeLayout();
		setRootVars(vals);
	}

	let t;
	function onResize() {
		clearTimeout(t);
		t = setTimeout(scheduleUpdate, DEBOUNCE_MS);
		log('📏 Resize gedebounced');
	}

	function observeElem(selector) {
		const el = document.querySelector(selector);

		if (!el || typeof ResizeObserver === 'undefined') {
			warn(`⚠️ ${selector} niet gevonden of ResizeObserver niet beschikbaar`);
			return;
		}

		const ro = new ResizeObserver(() => {
			log(`🔍 ${selector} grootte gewijzigd`);
			scheduleUpdate();
		});

		ro.observe(el);
	}

	function bindVisualViewport() {
		if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
			window.visualViewport.addEventListener('resize', onResize, { passive: true });
			log('📱 visualViewport resize listener toegevoegd');
		}
	}

	window.addEventListener('DOMContentLoaded', () => {
		scheduleUpdate();

		observeElem('.container');
		observeElem('footer');

		bindVisualViewport();
		log('🧩 Layout variabelen geïnitialiseerd');
	});

	window.addEventListener('resize', onResize, { passive: true });
})();
