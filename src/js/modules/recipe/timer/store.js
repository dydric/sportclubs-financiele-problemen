const STORAGE_KEY = 'recipe-timers';

const load = () => {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
	} catch {
		return [];
	}
};

const save = (timers) => {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
};

// On module init: load and immediately drop already-expired timers
let timers = load().filter((t) => t.endTime > Date.now());
save(timers);

const addTimer = (label, seconds) => {
	const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
	const timer = { id, label, endTime: Date.now() + seconds * 1000 };
	timers = [...timers, timer];
	save(timers);
	return timer;
};

const removeTimer = (id) => {
	timers = timers.filter((t) => t.id !== id);
	save(timers);
};

const getTimers = () => timers;

const remainingSeconds = (timer) => Math.max(0, Math.ceil((timer.endTime - Date.now()) / 1000));

const isExpired = (timer) => Date.now() >= timer.endTime;

export { addTimer, removeTimer, getTimers, remainingSeconds, isExpired };
