/**
 * Lazy autoplay voor video's: pauzeert video's buiten viewport,
 * speelt af wanneer ze in beeld komen. Voorkomt dat de browser
 * alle video-data direct downloadt.
 */

function setupLazyVideo() {
	const videos = document.querySelectorAll('video[autoplay]');
	if (!videos.length) return;

	// Pauzeer alle autoplay video's direct — de browser heeft ze
	// mogelijk al gestart voordat dit script laadt.
	videos.forEach(v => {
		v.pause();
		v.removeAttribute('autoplay');
		v.preload = 'none';
	});

	const observer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (entry.isIntersecting) {
				entry.target.play();
			} else {
				entry.target.pause();
			}
		}
	}, { rootMargin: '200px' });

	videos.forEach(v => observer.observe(v));
}

export function initLazyVideo() {
	setupLazyVideo();
	// Op iOS Safari wordt de content uitgesteld ingevoegd na page load.
	// Herinitialiseer de observer zodra de content is teruggeplaatst.
	document.addEventListener('ios:content-revealed', setupLazyVideo);
}
