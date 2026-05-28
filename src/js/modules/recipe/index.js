import { log, warn } from '../site/debug.js';

const initRecipe = () => {
	const root = document.querySelector('[data-recipe]');
	if (!root) return;

	const servesDisplay = root.querySelector('[data-recipe-serves]');
	const btnMinus = root.querySelector('[data-recipe-minus]');
	const btnPlus = root.querySelector('[data-recipe-plus]');
	const amountEls = root.querySelectorAll('[data-recipe-amount]');

	if (!servesDisplay || !btnMinus || !btnPlus) return;

	const baseServes = parseInt(root.dataset.recipe, 10);
	let currentServes = baseServes;

	// --- Personen schalen ---

	const update = () => {
		const factor = currentServes / baseServes;

		servesDisplay.textContent = currentServes;
		btnMinus.classList.toggle('hidden', currentServes <= 1);

		amountEls.forEach((el) => {
			const base = parseFloat(el.dataset.recipeAmount);
			if (isNaN(base)) return;
			const scaled = base * factor;
			el.textContent = Number.isInteger(scaled) ? scaled : parseFloat(scaled.toFixed(1));
		});
	};

	btnMinus.addEventListener('click', () => {
		if (currentServes <= 1) return;
		currentServes -= 1;
		update();
	});

	btnPlus.addEventListener('click', () => {
		currentServes += 1;
		update();
	});

	update();
	log(`🍳 Recipe initialized: ${baseServes} serves`);

	// --- Kookmodus (Wake Lock) ---

	const wakeLockRow = document.querySelector('[data-recipe-wakelock-row]');
	const btnWakeLock = document.querySelector('[data-recipe-wakelock]');
	const thumb = document.querySelector('[data-recipe-wakelock-thumb]');

	if (!btnWakeLock || !wakeLockRow || !('wakeLock' in navigator)) {
		log('💡 Wake Lock not supported');
		return;
	}

	let wakeLock = null;
	let cookingMode = false;

	// Toon de rij alleen als Wake Lock ondersteund wordt
	wakeLockRow.classList.remove('hidden');
	wakeLockRow.classList.add('flex');

	const setToggleState = (active) => {
		btnWakeLock.setAttribute('aria-checked', active ? 'true' : 'false');
		btnWakeLock.classList.toggle('bg-accent-1', active);
		btnWakeLock.classList.toggle('bg-neutral-400', !active);
		btnWakeLock.classList.toggle('dark:bg-neutral-700', !active);
		if (thumb) thumb.classList.toggle('translate-x-4', active);
	};

	const acquireWakeLock = async () => {
		try {
			wakeLock = await navigator.wakeLock.request('screen');
			wakeLock.addEventListener('release', () => {
				log('💡 Wake Lock released by browser');
			});
			log('💡 Wake Lock acquired');
		} catch (err) {
			warn(`💡 Wake Lock failed: ${err.message}`);
			cookingMode = false;
			setToggleState(false);
		}
	};

	const releaseWakeLock = async () => {
		if (!wakeLock) return;
		await wakeLock.release();
		wakeLock = null;
		log('💡 Wake Lock released');
	};

	// Heractiveer wake lock als tab weer zichtbaar wordt
	document.addEventListener('visibilitychange', () => {
		if (cookingMode && document.visibilityState === 'visible') {
			acquireWakeLock();
		}
	});

	btnWakeLock.addEventListener('click', async () => {
		cookingMode = !cookingMode;
		setToggleState(cookingMode);

		if (cookingMode) {
			await acquireWakeLock();
		} else {
			await releaseWakeLock();
		}
	});
};

export { initRecipe };
