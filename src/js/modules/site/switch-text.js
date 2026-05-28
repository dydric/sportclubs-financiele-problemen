// File: js/modules/site/switch-text.js

import { log, warn } from './debug.js';

const initSwitch = () => {
	const switches = document.querySelectorAll('[data-js="switch"]');

	if (!switches.length) {
		log('📍 No [data-js="switch"] elements found');
		return;
	}

	log(`📍 ${switches.length} location switch(es) found`);

	switches.forEach((el, index) => {
		const altText = el.getAttribute('data-switch-content');

		if (!altText) {
			warn(`⚠️ Switch ${index} skipped – missing data-switch-content`);
			return;
		}

		const defaultText = el.textContent.trim();
		let isAlt = false;

		const toggleText = () => {
			el.textContent = isAlt ? defaultText : altText;
			isAlt = !isAlt;
		};

		// Manual toggle on click
		el.addEventListener('click', () => {
			log(`🖱️ Manual toggle for switch ${index}`);
			toggleText();
		});

		// Automatic toggle every 3 seconds
		window.setInterval(() => {
			log(`⏱️ Automatic toggle for switch ${index}`);
			toggleText();
		}, 3000);
	});
};

export { initSwitch };
