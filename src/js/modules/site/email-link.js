// File: js/modules/site/email-link.js

import { error, log, warn } from './debug.js';

const initEmailLink = () => {
	const triggers = document.querySelectorAll('[data-js="email"]');

	if (!triggers.length) {
		warn('⚠️ [data-js="email"] not found');
		return;
	}

	const getEmail = () => {
		// Build email only at runtime (avoid exposing it in markup)
		const user = ['hey'].join('');
		const domain = ['die', 'de', 'rik', 'dijk', 'stra', '.', 'nl'].join('');

		return `${user}@${domain}`;
	};

	triggers.forEach((trigger) => {
		trigger.addEventListener('click', (e) => {
			// Prevent default in case this becomes an <a href="#">
			e.preventDefault();

			try {
				const email = getEmail();

				// Trigger mail client without exposing address in DOM
				window.location.href = `mailto:${email}`;

				log('✅ mailto triggered');
			} catch (err) {
				error('❌ Failed to trigger mailto:', err);
			}
		});
	});
};

export { initEmailLink };
