const MAPBOX_VERSION = 'v3.14.0';
const MAPBOX_SCRIPT_SRC = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_VERSION}/mapbox-gl.js`;
const MAPBOX_STYLESHEET_HREF = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_VERSION}/mapbox-gl.css`;

let mapboxPromise = null;

function ensureMapboxStylesheet() {
	if (document.querySelector(`link[href="${MAPBOX_STYLESHEET_HREF}"]`)) return;

	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = MAPBOX_STYLESHEET_HREF;
	document.head.appendChild(link);
}

export function loadMapboxGL() {
	if (typeof window === 'undefined') return Promise.resolve(null);

	ensureMapboxStylesheet();

	if (window.mapboxgl) return Promise.resolve(window.mapboxgl);
	if (mapboxPromise) return mapboxPromise;

	mapboxPromise = new Promise((resolve, reject) => {
		const existingScript = document.querySelector(`script[src="${MAPBOX_SCRIPT_SRC}"]`);
		if (existingScript) {
			existingScript.addEventListener('load', () => resolve(window.mapboxgl), { once: true });
			existingScript.addEventListener('error', () => reject(new Error('Failed to load Mapbox GL JS')), { once: true });
			return;
		}

		const script = document.createElement('script');
		script.src = MAPBOX_SCRIPT_SRC;
		script.async = true;
		script.onload = () => resolve(window.mapboxgl);
		script.onerror = () => reject(new Error('Failed to load Mapbox GL JS'));
		document.head.appendChild(script);
	});

	return mapboxPromise;
}
