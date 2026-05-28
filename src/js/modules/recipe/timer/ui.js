import { getTimers, isExpired, remainingSeconds, removeTimer } from './store.js';

const formatTime = (secs) => {
	const h = Math.floor(secs / 3600);
	const m = Math.floor((secs % 3600) / 60);
	const s = secs % 60;
	if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	return `${m}:${s.toString().padStart(2, '0')}`;
};

// Map van timer.id → inline DOM element
const timerEls = new Map();

const createInlineTimer = (liEl, timer, onRemove) => {
	// Voorkom duplicaat als timer al inline getoond wordt
	if (timerEls.has(timer.id)) return timerEls.get(timer.id);

	const el = document.createElement('div');
	el.dataset.timerId = timer.id;
	el.className = 'mt-2';

	const pill = document.createElement('span');
	pill.className =
		'inline-flex items-stretch u-text-sm bg-neutral-800 dark:bg-white text-white dark:text-neutral-900 rounded-sm overflow-hidden select-none transition-colors';

	const display = document.createElement('span');
	display.dataset.timerDisplay = '';
	display.className = 'px-2.5 flex items-center font-mono tabular-nums';
	display.textContent = formatTime(remainingSeconds(timer));

	const cancel = document.createElement('button');
	cancel.type = 'button';
	cancel.className =
		'w-7 h-7 flex items-center justify-center leading-none border-l border-neutral-700 dark:border-neutral-200 hover:bg-neutral-700 dark:hover:bg-neutral-100 cursor-pointer';
	cancel.setAttribute('aria-label', 'Timer annuleren');
	cancel.textContent = '×';
	cancel.addEventListener('click', () => {
		removeTimer(timer.id);
		el.remove();
		timerEls.delete(timer.id);
		onRemove(timer.id);
	});

	pill.appendChild(display);
	pill.appendChild(cancel);
	el.appendChild(pill);

	liEl.appendChild(el);
	timerEls.set(timer.id, el);

	return el;
};

const tickInlineTimers = (onExpire) => {
	const timers = getTimers();
	const activeIds = new Set(timers.map((t) => t.id));

	// Verwijder elementen van timers die niet meer in de store zitten
	timerEls.forEach((el, id) => {
		if (!activeIds.has(id)) {
			el.remove();
			timerEls.delete(id);
		}
	});

	timers.forEach((timer) => {
		const el = timerEls.get(timer.id);
		if (!el) return;

		const display = el.querySelector('[data-timer-display]');
		if (!display) return;

		display.textContent = formatTime(remainingSeconds(timer));

		const expired = isExpired(timer);
		const wasExpired = el.dataset.expired === 'true';

		if (expired && !wasExpired) {
			el.dataset.expired = 'true';
			const pill = el.querySelector('span');
			if (pill) {
				pill.classList.remove('bg-neutral-800', 'dark:bg-white', 'text-white', 'dark:text-neutral-900');
				pill.classList.add('bg-accent-1', 'text-white', 'animate-pulse');
				setTimeout(() => pill.classList.remove('animate-pulse'), 8000);
			}
			onExpire(timer);
		}
	});
};

export { createInlineTimer, tickInlineTimers, timerEls };
