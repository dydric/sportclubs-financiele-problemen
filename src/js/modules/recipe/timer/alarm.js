import { warn } from '../../site/debug.js';

let audioCtx = null;

// Speelt een stil buffer af om iOS audio te ontgrendelen (vereist user-gesture)
const unlockAudio = (ctx) => {
	try {
		const buf = ctx.createBuffer(1, 1, 22050);
		const src = ctx.createBufferSource();
		src.buffer = buf;
		src.connect(ctx.destination);
		src.start(0);
	} catch {
		// Negeer fouten bij unlock
	}
};

// Moet aangeroepen worden vanuit een user-gesture zodat de context later werkt
const initAudio = () => {
	if (audioCtx) return;
	try {
		audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		unlockAudio(audioCtx);
	} catch {
		// AudioContext niet beschikbaar
	}
};

const beep = (ctx, freq, start, duration) => {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.connect(gain);
	gain.connect(ctx.destination);
	osc.frequency.value = freq;
	osc.type = 'sine';
	gain.gain.setValueAtTime(0.35, start);
	gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
	osc.start(start);
	osc.stop(start + duration);
};

const playAlarm = async () => {
	if (!audioCtx) return;
	try {
		if (audioCtx.state === 'suspended') await audioCtx.resume();
		const now = audioCtx.currentTime;
		beep(audioCtx, 880, now, 0.25);
		beep(audioCtx, 880, now + 0.35, 0.25);
		beep(audioCtx, 1100, now + 0.7, 0.5);
	} catch (err) {
		warn(`⏱️ Alarm geluid mislukt: ${err.message}`);
	}
};

export { initAudio, playAlarm };
