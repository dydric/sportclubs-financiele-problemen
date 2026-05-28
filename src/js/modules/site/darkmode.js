// Bestand: js/modules/site/darkmode.js
// Status: niet in gebruik — beschikbaar voor toekomstige implementatie

import { log, warn } from './debug.js';

const darkMode = () => {
	let preference = localStorage.getItem('theme') || 'system';
	log(`🌓 Start darkMode met voorkeur: ${preference}`);

	// 🌗 Pas systeemvoorkeur of gebruikerskeuze toe
	const systemPreference = (val) => {
		if (val === 'system') {
			localStorage.removeItem('theme');
			log('⚙️ Thema-instelling op systeem gezet');
		} else {
			localStorage.setItem('theme', val);
			log(`⚙️ Thema-instelling opgeslagen: ${val}`);
		}

		if (val === 'dark' || (val === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
			document.documentElement.classList.add('dark');
			updateThemeColor('#171717');
			log('🌑 Donker thema toegepast');
		} else {
			document.documentElement.classList.remove('dark');
			updateThemeColor('#e5e7eb');
			log('🌕 Licht thema toegepast');
		}
	};

	// 🎨 Update de meta theme-color
	const updateThemeColor = (color) => {
		let themeMetaTag = document.querySelector('meta[name="theme-color"]');
		if (!themeMetaTag) {
			themeMetaTag = document.createElement('meta');
			themeMetaTag.setAttribute('name', 'theme-color');
			document.head.appendChild(themeMetaTag);
			log('🧩 Meta-tag theme-color aangemaakt');
		}
		themeMetaTag.setAttribute('content', color);
	};

	// 🚀 Initieel instellen bij paginalaad
	systemPreference(preference);

	// 🕵️‍♂️ Detecteer systeemwijziging
	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	mediaQuery.addEventListener('change', (event) => {
		if (preference === 'system') {
			systemPreference(preference);
			log('🔄 Systeemvoorkeur voor darkmode gewijzigd');
		}
	});

	// 🔓 Open modal
	const openModal = () => {
		const modal = document.getElementById('darkmode-modal');
		if (!modal) {
			warn('⚠️ Geen #darkmode-modal gevonden');
			return;
		}
		modal.classList.remove('hidden');
		modal.setAttribute('aria-hidden', 'false');
		log('🪟 Darkmode-modal geopend');

		const closeButton = document.getElementById('close-darkmode-btn');
		if (closeButton) closeButton.focus();
	};

	// 🔐 Sluit modal
	const closeModal = () => {
		const modal = document.getElementById('darkmode-modal');
		if (!modal) {
			warn('⚠️ Geen #darkmode-modal gevonden om te sluiten');
			return;
		}
		modal.classList.add('hidden');
		modal.setAttribute('aria-hidden', 'true');
		log('❌ Darkmode-modal gesloten');

		const openButton = document.getElementById('open-darkmode-btn');
		if (openButton) openButton.focus();
	};

	// ⌨️ Escape-toets sluit modal
	const handleEscapeKey = (event) => {
		if (event.key === 'Escape') {
			closeModal();
		}
	};

	// 🌈 Keuze uit modus (licht/donker/systeem)
	const buttons = document.querySelectorAll('[data-darkmode-option]');
	if (buttons.length > 0) {
		buttons.forEach((button) => {
			button.addEventListener('click', (event) => {
				const newPreference = event.currentTarget.getAttribute('data-darkmode-option');
				if (!newPreference) {
					warn('⚠️ Geen geldige waarde in data-darkmode-option');
					return;
				}
				preference = newPreference;
				systemPreference(preference);
				closeModal();
			});
		});
	} else {
		warn('⚠️ Geen darkmode-optieknoppen gevonden');
	}

	// 🎯 Open modal knop
	const openButton = document.getElementById('open-darkmode-btn');
	if (openButton) {
		openButton.addEventListener('click', openModal);
	} else {
		warn('⚠️ Geen #open-darkmode-btn gevonden');
	}

	// ❌ Sluit modal knop
	const closeButton = document.getElementById('close-darkmode-btn');
	if (closeButton) {
		closeButton.addEventListener('click', closeModal);
	} else {
		warn('⚠️ Geen #close-darkmode-btn gevonden');
	}

	// 🔑 Escape afsluiten
	document.addEventListener('keydown', handleEscapeKey);
};

export { darkMode };
