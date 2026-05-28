import { log } from '../../site/debug.js';
import { addTimer, getTimers, removeTimer, remainingSeconds } from './store.js';
import { createInlineTimer, tickInlineTimers, timerEls } from './ui.js';
import { initAudio, playAlarm } from './alarm.js';
import { requestPermission, sendNotification } from './notify.js';
import { initTimerLinks } from './links.js';

// Bijhouden welke timers al alarm hebben gehad (voorkomt herhaling)
const firedIds = new Set();

// Originele paginatitel bewaren voor herstel
let originalTitle = null;

const updateDocTitle = () => {
	const timers = getTimers();
	if (!timers.length) {
		if (originalTitle !== null) {
			document.title = originalTitle;
			originalTitle = null;
		}
		return;
	}

	if (originalTitle === null) originalTitle = document.title;

	// Toon de kortst-lopende actieve timer in de tab-titel
	const secs = Math.min(...timers.map(remainingSeconds));
	const m = Math.floor(secs / 60);
	const s = secs % 60;
	document.title = `⏱ ${m}:${s.toString().padStart(2, '0')} — ${originalTitle}`;
};

const handleExpiry = (timer) => {
	if (firedIds.has(timer.id)) return;
	firedIds.add(timer.id);

	playAlarm();
	sendNotification(timer.label);

	// Scroll expired timer in beeld (iOS visuele fallback)
	const el = timerEls.get(timer.id);
	if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

	// Verwijder de inline timer na 8 seconden automatisch
	setTimeout(() => {
		removeTimer(timer.id);
		const expiredEl = timerEls.get(timer.id);
		if (expiredEl) expiredEl.remove();
		timerEls.delete(timer.id);
	}, 8000);
};

const getLiEl = (linkEl) => linkEl.closest('li') || linkEl.parentElement;

const initTimer = () => {
	// Herstel actieve timers bij paginawissel: koppel aan overeenkomende links op deze pagina
	const stored = getTimers();
	if (stored.length) {
		const links = document.querySelectorAll('a[href^="timer:"]');
		stored.forEach((timer) => {
			const match = [...links].find((l) => l.textContent.trim() === timer.label);
			if (match) {
				createInlineTimer(getLiEl(match), timer, (id) => firedIds.delete(id));
			}
		});
	}

	const start = async (label, seconds, linkEl) => {
		// Voorkom duplicaat: als er al een actieve timer met dit label loopt, niets doen
		const already = getTimers().find((t) => t.label === label);
		if (already) return;

		initAudio(); // Maak AudioContext aan vanuit user-gesture
		await requestPermission();
		const timer = addTimer(label, seconds);
		createInlineTimer(getLiEl(linkEl), timer, (id) => firedIds.delete(id));
		log(`⏱️ Timer gestart: "${label}" (${seconds}s)`);
	};

	initTimerLinks(start);

	// Tick elke seconde
	window.setInterval(() => {
		tickInlineTimers(handleExpiry);
		updateDocTitle();
	}, 1000);

	// Herrender direct als tab weer actief wordt (vang gemiste expirations op)
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') {
			tickInlineTimers(handleExpiry);
			updateDocTitle();
		}
	});

	log('⏱️ Timer module klaar');
};

export { initTimer };
