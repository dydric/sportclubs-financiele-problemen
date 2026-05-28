// Bestand: js/modules/site/likes.js
//
// Like/reactie knoppen — ingedrukt houden verhoogt de teller.
//
// Interactie:
//   - Indrukken: direct +1, daarna 10 per seconde zolang ingedrukt
//   - Loslaten: opgelopen delta wordt in één POST naar server verstuurd
//   - Max 100 likes per type per dag per gebruiker (localStorage)
//   - Op localhost: geen limiet, handig voor testen
//
// States per knop (data-state):
//   loading  → tellers worden opgehaald
//   ready    → actief, indrukbaar
//   holding  → knop ingedrukt, teller loopt op
//   sending  → delta wordt verstuurd, teller bevroren
//   maxed    → daglimiet bereikt
//   error    → API niet bereikbaar bij ophalen

import { log, warn, error } from './debug.js';

const API_URL   = '/.netlify/functions/likes';
const DAILY_MAX = 100;

// Interval (ms) tussen ticks als functie van ramp-elapsed (ms).
// Start traag (~500ms/tick = 2/s), versnelt exponentieel naar 50ms/tick (20/s).
// Na ~4s oploop is de maximumsnelheid bereikt en duurt het nog ~3.5s om 100 te halen.
const getTickInterval = (rampMs) => Math.max(50, 500 * Math.exp(-rampMs / 3000));

// Werk CSS-variabelen bij zodat de animatie meeversnelt en de emoji meegroeit.
// p = 0.0 (begin) → 1.0 (bij +100 likes): schaal en snelheid groeien lineair mee.
// --hold-scale: basischaal van de emoji (1× → 2.5×)
// --hold-speed: animatieduur van de puls  (600ms → 150ms)
const updateHoldAnimation = (btn, p) => {
	btn.style.setProperty('--hold-scale', (1 + p * 1.5).toFixed(3));
	btn.style.setProperty('--hold-speed', `${Math.round(600 - p * 450)}ms`);
};

// Op localhost geldt geen daglimiet
const IS_DEV = window.location.hostname === 'localhost'
	|| window.location.hostname === '127.0.0.1';

// Emoji → stabiele ASCII-sleutel (zelfde logica in likes.mjs)
const emojiToKey = (emoji) =>
	[...emoji].map(c => c.codePointAt(0).toString(16)).join('-');

// --- Daglimiet via localStorage ---

const STORAGE_KEY = 'likes-daily';
const today = () => new Date().toISOString().slice(0, 10);

const getDailyCount = (slug, typeKey) => {
	try {
		const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		const entry = data[slug]?.[typeKey];
		return entry?.date === today() ? (entry.count ?? 0) : 0;
	} catch { return 0; }
};

const addDailyCount = (slug, typeKey, delta) => {
	try {
		const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		if (!data[slug]) data[slug] = {};
		const prev = data[slug][typeKey]?.date === today()
			? (data[slug][typeKey].count ?? 0) : 0;
		data[slug][typeKey] = { date: today(), count: prev + delta };
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch {}
};

// --- API ---

const fetchCounts = async (slug) => {
	const res = await fetch(`${API_URL}?slug=${encodeURIComponent(slug)}`);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return (await res.json()).counts ?? {};
};

const postLike = async (slug, type, count) => {
	const res = await fetch(API_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ slug, type, count }),
		// keepalive: request wordt afgerond ook als de pagina wordt verlaten
		keepalive: true,
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return (await res.json()).counts ?? {};
};

// --- UI helpers ---

// Compacte notatie: < 1000 exact, 1000–9999 met één decimaal, ≥ 10000 afgerond.
const formatCount = (n) => {
	if (n < 1000)  return String(n);
	if (n < 10000) { const d = (n / 1000).toFixed(1); return `${d.endsWith('.0') ? d.slice(0, -2) : d}k`; }
	return `${Math.floor(n / 1000)}k`;
};

// Lees het ruwe getal van data-count (niet uit de geformatteerde tekst).
const readCount = (btn) => {
	const n = parseInt(btn.dataset.count ?? '', 10);
	return isNaN(n) ? 0 : n;
};

const buildAriaLabel = (emoji, state, count) => {
	const times = count === 1 ? '1 keer' : `${count} keer`;
	if (state === 'holding' || state === 'sending') return `${emoji}: ${times}`;
	if (state === 'maxed') return `${emoji}: daglimiet bereikt`;
	return `Reageer met ${emoji}${count > 0 ? `, ${times}` : ''}`;
};

// Stel de state van één knop in.
// De emoji-tekst in .like-icon wordt NIET aangepast: Twemoji heeft die
// bij het laden al vervangen door een <img> en die mag intact blijven.
const setButtonState = (btn, state, count) => {
	const countEl = btn.querySelector('.like-count');
	const emoji = btn.dataset.type ?? '';

	btn.dataset.state = state;
	btn.dataset.count = count; // ruw getal bewaren zodat readCount() correct blijft

	const showCount = state !== 'loading' && state !== 'error';
	if (countEl) {
		countEl.hidden = !showCount;
		// Tijdens inhouden: exact getal tonen zodat je ziet wat er oploopt.
		// In rust: compact formaat (1.1k etc.)
		countEl.textContent = showCount ? (state === 'holding' ? String(count) : formatCount(count)) : '';
	}

	switch (state) {
		case 'loading':
			btn.disabled = true;
			btn.removeAttribute('aria-disabled');
			btn.setAttribute('aria-pressed', 'false');
			btn.setAttribute('aria-label', `Reageer met ${emoji}, wordt geladen`);
			break;
		case 'ready':
			btn.disabled = false;
			btn.removeAttribute('aria-disabled');
			btn.setAttribute('aria-pressed', 'false');
			btn.setAttribute('aria-label', buildAriaLabel(emoji, 'ready', count));
			break;
		case 'holding':
			btn.disabled = false;
			btn.removeAttribute('aria-disabled');
			btn.setAttribute('aria-pressed', 'true');
			btn.setAttribute('aria-label', buildAriaLabel(emoji, 'holding', count));
			break;
		case 'sending':
			btn.disabled = true;
			btn.removeAttribute('aria-disabled');
			btn.setAttribute('aria-pressed', 'true');
			btn.setAttribute('aria-label', buildAriaLabel(emoji, 'sending', count));
			break;
		case 'maxed':
			btn.disabled = false;
			btn.setAttribute('aria-disabled', 'true');
			btn.setAttribute('aria-pressed', 'false');
			btn.setAttribute('aria-label', buildAriaLabel(emoji, 'maxed', count));
			break;
		case 'error':
			btn.disabled = true;
			btn.removeAttribute('aria-disabled');
			btn.setAttribute('aria-pressed', 'false');
			btn.setAttribute('aria-label', `${emoji} niet beschikbaar`);
			break;
	}
};

// --- Initialiseer één like-container ---

const initLikes = (container) => {
	const slug = container.dataset.slug?.trim();
	const btns = [...container.querySelectorAll('.like-btn')];

	if (!slug || !btns.length) {
		warn('Like component: geen [data-slug] of .like-btn gevonden');
		return;
	}

	// Startwaarde: optionele offset voor de eerste knop (migratie van oude teller)
	const startCount = Math.max(0, parseInt(container.dataset.start ?? '0', 10) || 0);

	// Seriële wachtrij: like-verzoeken worden één voor één verstuurd zodat
	// er nooit gelijktijdige schrijfopdrachten naar de Blob plaatsvinden.
	let likeQueue = Promise.resolve();
	const enqueue = (fn) => {
		const result = likeQueue.then(() => fn(), () => fn());
		likeQueue = result.then(() => {}, () => {});
		return result;
	};

	// Initieel laden
	btns.forEach(btn => setButtonState(btn, 'loading', 0));

	fetchCounts(slug)
		.then((counts) => {
			btns.forEach((btn, i) => {
				const typeKey = emojiToKey(btn.dataset.type ?? '');
				const raw = counts[typeKey] ?? 0;
				const count = raw + (i === 0 ? startCount : 0);
				const todayCount = IS_DEV ? 0 : getDailyCount(slug, typeKey);
				setButtonState(btn, todayCount >= DAILY_MAX ? 'maxed' : 'ready', count);
			});
			log(`Likes geladen voor "${slug}":`, counts);
		})
		.catch((err) => {
			error('Fout bij ophalen likes:', err);
			btns.forEach(btn => setButtonState(btn, 'error', 0));
			container.hidden = true;
		});

	// Hold-interactie per knop
	btns.forEach((btn, i) => {
		const emoji = btn.dataset.type ?? '';
		const typeKey = emojiToKey(emoji);
		const isFirst = i === 0;

		let rafId       = null;  // requestAnimationFrame handle
		let pressTime   = 0;    // e.timeStamp van pointerdown
		let lastTick    = 0;    // timestamp van laatste tick
		let rampStarted = false;
		let isHolding   = false;
		let accumulated = 0;
		let baseCount   = 0;
		let maxThisHold = 0;

		// Verstuur de opgelopen delta naar de server
		const doSend = async (delta) => {
			setButtonState(btn, 'sending', baseCount + delta);
			try {
				if (!IS_DEV) addDailyCount(slug, typeKey, delta);
				const confirmedCounts = await enqueue(() => postLike(slug, emoji, delta));
				const raw = confirmedCounts[typeKey] ?? 0;
				// Nooit lager dan de optimistische waarde tonen
				const finalCount = Math.max(raw + (isFirst ? startCount : 0), baseCount + delta);
				const todayCount = IS_DEV ? 0 : getDailyCount(slug, typeKey);
				setButtonState(btn, todayCount >= DAILY_MAX ? 'maxed' : 'ready', finalCount);
				log(`❤️ Like verstuurd: "${slug}" ${emoji} ×${delta} → totaal ${raw}`);
			} catch (err) {
				error('Fout bij versturen like:', err);
				if (!IS_DEV) addDailyCount(slug, typeKey, -delta); // rollback daglimiet
				setButtonState(btn, 'ready', baseCount);
			}
		};

		// RAF-loop: verwerkt de versnellende oploop; animatie wordt per tick bijgewerkt.
		const holdRaf = (ts) => {
			if (!isHolding) return;
			const holdElapsed = ts - pressTime;
			const rampMs = Math.max(0, holdElapsed - 2000);

			if (holdElapsed >= 2000) {
				if (!rampStarted) { rampStarted = true; lastTick = ts; }
				if (ts - lastTick >= getTickInterval(rampMs)) {
					lastTick = ts;
					accumulated = Math.min(accumulated + 1, maxThisHold);
					// Groei loopt van 0 → 1 naarmate accumulated → maxThisHold
					updateHoldAnimation(btn, accumulated / maxThisHold);
					setButtonState(btn, 'holding', baseCount + accumulated);
					if (accumulated >= maxThisHold) { stopHolding(); return; }
				}
			}

			rafId = requestAnimationFrame(holdRaf);
		};

		// Stop de hold-lus en verstuur wat er is opgelopen.
		// isHolding-vlag voorkomt dubbel vuren (pointerup + lostpointercapture).
		const stopHolding = () => {
			if (!isHolding) return;
			isHolding   = false;
			rampStarted = false;
			if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
			btn.style.removeProperty('--hold-scale');
			btn.style.removeProperty('--hold-speed');
			const delta = accumulated;
			accumulated = 0;
			if (delta === 0) { setButtonState(btn, 'ready', baseCount); return; }
			doSend(delta);
		};

		btn.addEventListener('pointerdown', (e) => {
			if (btn.dataset.state !== 'ready') return;
			if (e.pointerType === 'mouse' && e.button !== 0) return;

			const todayCount = IS_DEV ? 0 : getDailyCount(slug, typeKey);
			maxThisHold = Math.max(0, DAILY_MAX - todayCount); // altijd max 100 per hold
			if (maxThisHold <= 0) {
				setButtonState(btn, 'maxed', readCount(btn));
				return;
			}

			baseCount   = readCount(btn);
			accumulated = 1; // direct +1 bij indrukken
			isHolding   = true;
			pressTime   = e.timeStamp;
			btn.setPointerCapture(e.pointerId);
			setButtonState(btn, 'holding', baseCount + 1);
			updateHoldAnimation(btn, 0); // p=0: beginschaal 1×, langzame puls
			rafId = requestAnimationFrame(holdRaf);
		});

		// Loslaten → verstuur (pointerup en lostpointercapture kunnen allebei vuren;
		// de isHolding-vlag in stopHolding zorgt dat er slechts één verzending plaatsvindt)
		btn.addEventListener('pointerup', stopHolding);
		btn.addEventListener('pointercancel', stopHolding);
		btn.addEventListener('lostpointercapture', stopHolding);

		// Voorkom het long-press contextmenu op mobiel (zou afbeeldingen "pakken")
		btn.addEventListener('contextmenu', (e) => e.preventDefault());
	});
};

// --- Initialiseer alle like-containers op de pagina ---

const initAllLikes = () => {
	const containers = document.querySelectorAll('[data-js="likes"]');
	if (!containers.length) return;
	containers.forEach(initLikes);
	log(`Like-componenten geïnitialiseerd: ${containers.length}`);
};

export { initAllLikes };
