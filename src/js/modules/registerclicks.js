// Bestand: js/modules/registerclicks.js

import { log, warn } from './debug.js'; // ✅ Debug import

const registerClicks = () => {
	const expandableLinks = document.querySelectorAll('[data-expand]');
	const display = document.querySelector('[data-total-clicks]');

	if (!expandableLinks.length) return;

	expandableLinks.forEach(link => {
		if (link.dataset.boundClick) return;
		link.dataset.boundClick = 'true';

		link.addEventListener('click', () => {
			log('📌 Click registered for:', link.dataset.expand);

			// ⬆️ Direct +1 optellen in de UI
			if (display) {
				const current = parseInt(display.textContent, 10) || 0;
				const next = current + 1;
				display.textContent = `${next} clicks`;
				display.classList.remove('hidden');
			}

			// 📡 Click registreren via Netlify function
			fetch('/.netlify/functions/registerclicks', {
				method: 'POST'
			}).catch(err => {
				warn('❌ Click not registered:', err);
			});
		});
	});
};

export { registerClicks };
