import { log } from '../../site/debug.js';

// Parseert `timer:11` (minuten) of `timer:11:30` (minuten:seconden)
const parseTimerHref = (href) => {
	const match = href.match(/^timer:(\d+)(?::(\d+))?$/);
	if (!match) return null;
	const minutes = parseInt(match[1], 10);
	const seconds = match[2] ? parseInt(match[2], 10) : 0;
	return minutes * 60 + seconds;
};

// onStart(label, seconds, linkEl)
const initTimerLinks = (onStart) => {
	const links = document.querySelectorAll('a[href^="timer:"]');
	if (!links.length) return;

	log(`⏱️ ${links.length} timer-link(s) gevonden`);

	links.forEach((link) => {
		const seconds = parseTimerHref(link.getAttribute('href'));
		if (!seconds) return;

		// Visuele hint dat het een klikbare timer is
		link.setAttribute('role', 'button');
		link.setAttribute('title', `Start timer: ${link.textContent.trim()}`);

		link.addEventListener('click', (e) => {
			e.preventDefault();
			onStart(link.textContent.trim(), seconds, link);
		});
	});
};

export { initTimerLinks, parseTimerHref };
