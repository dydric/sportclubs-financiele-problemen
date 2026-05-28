// File: js/modules/site/clock.js

import { log, warn } from './debug.js';

const initClock = () => {
	const clockEl = document.querySelector('[data-js="clock"]');
	const offsetEl = document.querySelector('[data-js="utc-offset"]');

	if (!clockEl && !offsetEl) {
		warn('⚠️ No [data-js="clock"] or [data-js="utc-offset"] found');
		return;
	}

	const timeZone = 'Europe/Amsterdam';

	// Create formatter once (better performance)
	const formatter = new Intl.DateTimeFormat('en-GB', {
		timeZone,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});

	const getAmsterdamUtcOffset = (date = new Date()) => {
		// Determine UTC offset for Europe/Amsterdam, regardless of visitor timezone
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone,
			timeZoneName: 'shortOffset',
		}).formatToParts(date);

		const tz = parts.find(p => p.type === 'timeZoneName')?.value || 'UTC';

		// tz looks like "GMT+1" / "GMT+2" / "UTC"
		if (tz === 'UTC' || tz === 'GMT') return 'UTC+0';

		const match = tz.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);

		if (!match) return 'UTC+0';

		const hours = match[1]; // e.g. "+1" or "+2"
		const mins = match[2] ? `:${match[2]}` : '';

		return `UTC${hours}${mins}`;
	};

	const update = () => {
		if (clockEl) {
			// Example: 14:03:09
			clockEl.textContent = formatter.format(new Date());
		}

		if (offsetEl) {
			offsetEl.textContent = getAmsterdamUtcOffset();
		}
	};

	// Initial paint + interval
	update();
	window.setInterval(update, 1000);

	log('🕒 Local time clock started');
};

export { initClock };
