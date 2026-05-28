import { loadMapboxGL } from '../load-mapbox';
import { DEFAULT_MAP_THEME } from '../activity/constants';
import { getMapboxToken } from '../activity/data';
import { applyBasemapPresentation, getPreferredLightPreset, getPreferredStyle } from '../activity/theme';
import { POI_MIN_ITEMS, POI_ZOOM_DEFAULT, POI_ZOOM_FOCUS } from './constants';
import { getPoiItems, getPoiListNode } from './data';
import { fitPoiBounds, getPoiAdaptiveFitPadding, syncPoiMinZoom } from './fit';
import { ensureMarkerImages, getMarkerImageId, hasMarkerImages } from './marker-images';
const POI_CLUSTER_THRESHOLD = 2;
const POI_CLUSTER_MIN_POINTS = 3;
const POI_CLUSTER_RADIUS = 24;
const POI_CLUSTER_MAX_ZOOM = 13;
const POI_MARKER_RADIUS = 13;

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function parseAlphaValue(value) {
	if (!value) return 1;
	const raw = String(value).trim();
	if (!raw) return 1;
	if (raw.endsWith('%')) return clamp(Number(raw.slice(0, -1)) / 100, 0, 1);
	return clamp(Number(raw), 0, 1);
}

function toSrgbChannel(value) {
	const channel = clamp(value, 0, 1);
	if (channel <= 0.0031308) return 12.92 * channel;
	return 1.055 * (channel ** (1 / 2.4)) - 0.055;
}

function oklchToRgbaString(value) {
	if (typeof value !== 'string') return value;
	const input = value.trim();
	const match = input.match(/^oklch\(\s*([0-9.]+)%\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)$/i);
	if (!match) return value;

	const lightness = clamp(Number(match[1]) / 100, 0, 1);
	const chroma = Math.max(0, Number(match[2]));
	const hueRad = (Number(match[3]) * Math.PI) / 180;
	const alpha = parseAlphaValue(match[4]);

	if (!Number.isFinite(lightness) || !Number.isFinite(chroma) || !Number.isFinite(hueRad) || !Number.isFinite(alpha)) {
		return value;
	}

	const a = chroma * Math.cos(hueRad);
	const b = chroma * Math.sin(hueRad);
	const lPrime = lightness + (0.3963377774 * a) + (0.2158037573 * b);
	const mPrime = lightness - (0.1055613458 * a) - (0.0638541728 * b);
	const sPrime = lightness - (0.0894841775 * a) - (1.291485548 * b);
	const l = lPrime ** 3;
	const m = mPrime ** 3;
	const s = sPrime ** 3;
	const rLinear = (4.0767416621 * l) - (3.3077115913 * m) + (0.2309699292 * s);
	const gLinear = (-1.2684380046 * l) + (2.6097574011 * m) - (0.3413193965 * s);
	const bLinear = (-0.0041960863 * l) - (0.7034186147 * m) + (1.707614701 * s);
	const r = Math.round(clamp(toSrgbChannel(rLinear), 0, 1) * 255);
	const g = Math.round(clamp(toSrgbChannel(gLinear), 0, 1) * 255);
	const bChannel = Math.round(clamp(toSrgbChannel(bLinear), 0, 1) * 255);
	return `rgba(${r}, ${g}, ${bChannel}, ${alpha})`;
}

function isClusterEnabled(mapNode) {
	const raw = String(mapNode?.dataset?.poiClusters || '').trim().toLowerCase();
	if (!raw) return true;
	return !['0', 'false', 'off', 'no'].includes(raw);
}

function normalizeCssColorForMapbox(colorValue, fallback) {
	if (!colorValue) return fallback;
	const host = document.body || document.documentElement;
	if (!host) return fallback;
	const probe = document.createElement('span');
	probe.style.color = oklchToRgbaString(String(colorValue).trim());
	probe.style.position = 'absolute';
	probe.style.opacity = '0';
	probe.style.pointerEvents = 'none';
	probe.style.width = '0';
	probe.style.height = '0';
	host.appendChild(probe);
	const normalized = getComputedStyle(probe).color;
	probe.remove();
	const resolved = oklchToRgbaString(normalized);
	if (!resolved || resolved === 'rgba(0, 0, 0, 0)' || resolved === 'transparent') return fallback;

	// Mapbox GL can fail on newer CSS color syntaxes (for example oklch()).
	// Convert through canvas to a broadly supported RGB/HEX output.
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return normalized;
	const sentinel = '#010203';
	ctx.fillStyle = sentinel;
	ctx.fillStyle = resolved;
	const coerced = ctx.fillStyle;
	if (!coerced || (coerced === sentinel && resolved !== sentinel)) return fallback;
	return coerced;
}

function getClusterPalette() {
	const root = document.documentElement;
	const isDarkMode = root.classList.contains('dark')
		|| root.dataset.theme === 'dark'
		|| (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

	const styles = getComputedStyle(root);
	const accentVar = styles.getPropertyValue('--color-accent-1').trim();
	const accent = normalizeCssColorForMapbox(accentVar, '#1d4ed8');

	if (isDarkMode) {
		return { bg: accent, text: '#ffffff', stroke: '#ffffff' };
	}

	return { bg: '#ffffff', text: accent, stroke: accent };
}

function getPoiFallbackPalette() {
	const styles = getComputedStyle(document.documentElement);
	const accentVar = styles.getPropertyValue('--color-accent-1').trim();
	return { fill: normalizeCssColorForMapbox(accentVar, '#1d4ed8') };
}

function createLayerIds(mapNode) {
	const key = String(mapNode.dataset.poisId || 'poi')
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-');

	return {
		sourceId: `poi-source-${key}`,
		favoriteSourceId: `poi-favorite-source-${key}`,
		clusterLayerId: `poi-cluster-${key}`,
		clusterCountLayerId: `poi-cluster-count-${key}`,
		pointFallbackLayerId: `poi-point-fallback-${key}`,
		pointLayerId: `poi-point-${key}`,
		favoritePointFallbackLayerId: `poi-point-favorite-fallback-${key}`,
		favoritePointLayerId: `poi-point-favorite-${key}`
	};
}

function buildPoiFeatureCollection(poiItems, activePoiId) {
	const hasActiveSelection = Boolean(activePoiId);
	return {
		type: 'FeatureCollection',
		features: poiItems.map((poi, index) => {
			const active = poi.id === activePoiId;
			const markerCategory = String(poi.category || '');
			const favorite = Boolean(poi.favorite);
			const markerRadius = active ? 16 : (hasActiveSelection ? 11 : 13);
			const iconScale = active ? 1 : (hasActiveSelection ? 0.86 : 1);
			return {
				type: 'Feature',
				id: index,
				properties: {
					poiId: poi.id,
					markerSort: active ? 100 : (favorite ? 2 : 1),
					markerRadius,
					iconScale,
					markerImage: getMarkerImageId(markerCategory, active, favorite)
				},
				geometry: {
					type: 'Point',
					coordinates: poi.coordinates
				}
			};
		})
	};
}

function setupThemeStyleSync(map, mapNode, renderLayers) {
	let activeStyle = getPreferredStyle(mapNode);

	const applyStyle = () => {
		const nextStyle = getPreferredStyle(mapNode);
		if (nextStyle === activeStyle) {
			applyBasemapPresentation(map, mapNode);
			return;
		}
		activeStyle = nextStyle;
		map.setStyle(nextStyle);
	};

	const observer = new MutationObserver(() => applyStyle());
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['class', 'data-theme']
	});

	const media = window.matchMedia('(prefers-color-scheme: dark)');
	const mediaListener = () => applyStyle();
	media.addEventListener('change', mediaListener);

	map.on('style.load', async () => {
		applyBasemapPresentation(map, mapNode);
		await renderLayers();
	});
}

function setupResponsiveResize(mapboxgl, map, poiItems, mapNode, onAfterResize = null) {
	let resizeTimer = null;
	const runResize = () => {
		map.resize();
		if (!mapNode.__poiSelectionActive) fitPoiBounds(mapboxgl, map, poiItems, mapNode);
		if (typeof onAfterResize === 'function') onAfterResize();
	};
	const onResize = () => {
		window.clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(() => {
			runResize();
		}, 120);
	};

	window.addEventListener('resize', onResize, { passive: true });

	let observer = null;
	if (typeof ResizeObserver === 'function') {
		observer = new ResizeObserver(() => onResize());
		observer.observe(mapNode);
		const mapShell = mapNode.closest('.poi-map');
		if (mapShell) observer.observe(mapShell);
	}

	return () => {
		window.removeEventListener('resize', onResize);
		window.clearTimeout(resizeTimer);
		if (observer) observer.disconnect();
	};
}

function createMapReveal(mapNode) {
	const loader = mapNode.closest('.poi-map')?.querySelector('[data-poi-map-loader]');
	mapNode.style.visibility = 'hidden';
	if (loader) loader.hidden = false;
	return () => {
		mapNode.style.visibility = 'visible';
		if (loader) loader.hidden = true;
	};
}

function revealWhenReady(map, revealMap, fallbackDelayMs = 2600) {
	let done = false;
	const reveal = () => {
		if (done) return;
		done = true;
		revealMap();
	};

	map.once('idle', reveal);
	window.setTimeout(reveal, fallbackDelayMs);
}

function syncPoiListState(registry, activePoiId) {
	registry.forEach((entry, id) => {
		const active = id === activePoiId;
		if (entry.listButton) entry.listButton.classList.toggle('is-active', active);
		if (entry.listButton) entry.listButton.setAttribute('aria-current', active ? 'true' : 'false');
		if (entry.listButton) entry.listButton.setAttribute('aria-expanded', active ? 'true' : 'false');
		if (entry.listPanel) entry.listPanel.hidden = !active;
	});
}

function parsePxValue(value) {
	const num = Number.parseFloat(String(value || '').replace('px', '').trim());
	return Number.isFinite(num) ? num : 0;
}

function getFixedViewportOffsets() {
	const rootStyles = getComputedStyle(document.documentElement);
	const cssHeader = parsePxValue(rootStyles.getPropertyValue('--header-height'));
	const cssFooter = parsePxValue(rootStyles.getPropertyValue('--footer-height'));

	const headerEl = document.querySelector('header');
	const footerEl = document.querySelector('footer');
	const measuredHeader = headerEl ? Math.round(headerEl.getBoundingClientRect().height) : 0;
	const measuredFooter = footerEl ? Math.round(footerEl.getBoundingClientRect().height) : 0;

	return {
		top: Math.max(cssHeader, measuredHeader, 0),
		bottom: Math.max(cssFooter, measuredFooter, 0)
	};
}

function getViewportSafeArea(mapNode, margin = 12) {
	const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
	const offsets = getFixedViewportOffsets();
	let safeTop = offsets.top + margin;
	const safeBottom = viewportHeight - offsets.bottom - margin;

	// Mobile: when the map block is sticky, it visually covers top content.
	// Keep list scrolling below that sticky map area.
	const isMobile = window.matchMedia('(max-width: 1023px)').matches;
	if (isMobile && mapNode) {
		const stickyMap = mapNode.closest('.poi')?.querySelector('.poi-map');
		if (stickyMap) {
			const mapRect = stickyMap.getBoundingClientRect();
			const mapIsBlockingTop = mapRect.top <= safeTop && mapRect.bottom > safeTop;
			if (mapIsBlockingTop) {
				safeTop = Math.min(safeBottom, Math.max(safeTop, mapRect.bottom + margin));
			}
		}
	}

	return { safeTop, safeBottom };
}

function isElementInViewport(element, mapNode, margin = 12) {
	if (!element) return true;
	const rect = element.getBoundingClientRect();
	const { safeTop, safeBottom } = getViewportSafeArea(mapNode, margin);
	return rect.top >= safeTop && rect.bottom <= safeBottom;
}

function ensureActiveListItemVisible(registry, activePoiId, mapNode) {
	if (!activePoiId) return;
	const entry = registry.get(activePoiId);
	const target = entry?.listButton?.closest('.poi-list-item') || entry?.listButton || null;
	if (!target) return;
	if (isElementInViewport(target, mapNode)) return;

	const rect = target.getBoundingClientRect();
	const margin = 12;
	const { safeTop, safeBottom } = getViewportSafeArea(mapNode, margin);

	let delta = 0;
	if (rect.top < safeTop) {
		delta = rect.top - safeTop;
	} else if (rect.bottom > safeBottom) {
		delta = rect.bottom - safeBottom;
	}

	if (delta !== 0) {
		const overlay = target.closest('.activity-overlay');
		const inner = overlay?.querySelector('.scroll-container');
		const scrollTarget = inner && inner.scrollHeight > inner.clientHeight ? inner : overlay && overlay.scrollHeight > overlay.clientHeight ? overlay : null;
		const scrollContainer = scrollTarget || document.querySelector('main');
		if (scrollContainer) {
			scrollContainer.scrollBy({ top: delta, behavior: 'smooth' });
		}
	}
}

function setupClusterLayers(map, layerIds) {
	const clusterPalette = getClusterPalette();
	const fallbackPalette = getPoiFallbackPalette();
	const clusterRadius = POI_MARKER_RADIUS;

	if (!map.getLayer(layerIds.clusterLayerId)) {
		map.addLayer({
			id: layerIds.clusterLayerId,
			type: 'circle',
			source: layerIds.sourceId,
			filter: ['has', 'point_count'],
			paint: {
				'circle-color': clusterPalette.bg,
				'circle-stroke-color': clusterPalette.stroke,
				'circle-stroke-width': 2.4,
				'circle-opacity': 0.96,
				'circle-emissive-strength': 1,
				'circle-radius': clusterRadius
			}
		});
	}
	if (map.getLayer(layerIds.clusterLayerId)) {
		map.setPaintProperty(layerIds.clusterLayerId, 'circle-color', clusterPalette.bg);
		map.setPaintProperty(layerIds.clusterLayerId, 'circle-stroke-color', clusterPalette.stroke);
		map.setPaintProperty(layerIds.clusterLayerId, 'circle-stroke-width', 2.4);
		map.setPaintProperty(layerIds.clusterLayerId, 'circle-opacity', 0.96);
		map.setPaintProperty(layerIds.clusterLayerId, 'circle-emissive-strength', 1);
		map.setPaintProperty(layerIds.clusterLayerId, 'circle-radius', clusterRadius);
	}

	if (!map.getLayer(layerIds.clusterCountLayerId)) {
		map.addLayer({
			id: layerIds.clusterCountLayerId,
			type: 'symbol',
			source: layerIds.sourceId,
			filter: ['has', 'point_count'],
			layout: {
				'text-field': ['get', 'point_count_abbreviated'],
				'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
				'text-size': 12
			},
			paint: {
				'text-color': clusterPalette.text
			}
		});
	}
	if (map.getLayer(layerIds.clusterCountLayerId)) {
		map.setPaintProperty(layerIds.clusterCountLayerId, 'text-color', clusterPalette.text);
	}

	if (!map.getLayer(layerIds.pointFallbackLayerId)) {
		map.addLayer({
			id: layerIds.pointFallbackLayerId,
			type: 'circle',
			source: layerIds.sourceId,
			filter: ['!', ['has', 'point_count']],
			layout: {
				'circle-sort-key': ['get', 'markerSort']
			},
			paint: {
				'circle-color': fallbackPalette.fill,
				'circle-radius': ['get', 'markerRadius'],
				'circle-opacity': 0.98
			}
		});
	}
	if (map.getLayer(layerIds.pointFallbackLayerId)) {
		map.setPaintProperty(layerIds.pointFallbackLayerId, 'circle-color', fallbackPalette.fill);
	}

	if (!map.getLayer(layerIds.pointLayerId)) {
		map.addLayer({
			id: layerIds.pointLayerId,
			type: 'symbol',
			source: layerIds.sourceId,
			filter: ['!', ['has', 'point_count']],
			layout: {
				'icon-image': ['get', 'markerImage'],
				'symbol-sort-key': ['get', 'markerSort'],
				'icon-size': ['coalesce', ['get', 'iconScale'], 1],
				'icon-allow-overlap': true,
				'icon-ignore-placement': true
			}
		});
	}
}

function setupFavoriteLayers(map, layerIds) {
	const fallbackPalette = getPoiFallbackPalette();

	if (!map.getLayer(layerIds.favoritePointFallbackLayerId)) {
		map.addLayer({
			id: layerIds.favoritePointFallbackLayerId,
			type: 'circle',
			source: layerIds.favoriteSourceId,
			layout: {
				'circle-sort-key': ['get', 'markerSort']
			},
			paint: {
				'circle-color': fallbackPalette.fill,
				'circle-radius': ['get', 'markerRadius'],
				'circle-opacity': 0.98
			}
		});
	}
	if (map.getLayer(layerIds.favoritePointFallbackLayerId)) {
		map.setPaintProperty(layerIds.favoritePointFallbackLayerId, 'circle-color', fallbackPalette.fill);
	}

	if (!map.getLayer(layerIds.favoritePointLayerId)) {
		map.addLayer({
			id: layerIds.favoritePointLayerId,
			type: 'symbol',
			source: layerIds.favoriteSourceId,
			layout: {
				'icon-image': ['get', 'markerImage'],
				'symbol-sort-key': ['get', 'markerSort'],
				'icon-size': ['coalesce', ['get', 'iconScale'], 1],
				'icon-allow-overlap': true,
				'icon-ignore-placement': true
			}
		});
	}
}

function queueMarkerImagePreparation(map, poiItems, state, rerender) {
	if (state.markerImagesReady || state.markerImagesPromise) return;
	state.markerImagesPromise = ensureMarkerImages(map, poiItems)
		.then(async () => {
			state.markerImagesReady = hasMarkerImages(map, poiItems);
			state.markerImagesPromise = null;
			if (typeof rerender === 'function') await rerender();
		})
		.catch((error) => {
			console.warn('Unable to prepare POI marker images:', error);
			state.markerImagesPromise = null;
		});
}

function renderPoiLayers(map, layerIds, poiItems, activePoiId, mapNode, state, rerender) {
	state.markerImagesReady = hasMarkerImages(map, poiItems);
	const favoriteItems = poiItems.filter((poi) => Boolean(poi.favorite));
	const nonFavoriteItems = poiItems.filter((poi) => !poi.favorite);
	const collection = buildPoiFeatureCollection(nonFavoriteItems, activePoiId);
	const favoriteCollection = buildPoiFeatureCollection(favoriteItems, activePoiId);
	const shouldCluster = isClusterEnabled(mapNode) && nonFavoriteItems.length > POI_CLUSTER_THRESHOLD;
	state.shouldCluster = shouldCluster;

	if (!map.getSource(layerIds.sourceId)) {
		map.addSource(layerIds.sourceId, {
			type: 'geojson',
			data: collection,
			cluster: true,
			clusterMinPoints: POI_CLUSTER_MIN_POINTS,
			clusterMaxZoom: POI_CLUSTER_MAX_ZOOM,
			clusterRadius: POI_CLUSTER_RADIUS
		});
	} else {
		const source = map.getSource(layerIds.sourceId);
		if (source && typeof source.setData === 'function') source.setData(collection);
	}

	if (!map.getSource(layerIds.favoriteSourceId)) {
		map.addSource(layerIds.favoriteSourceId, {
			type: 'geojson',
			data: favoriteCollection
		});
	} else {
		const favoriteSource = map.getSource(layerIds.favoriteSourceId);
		if (favoriteSource && typeof favoriteSource.setData === 'function') favoriteSource.setData(favoriteCollection);
	}

	setupClusterLayers(map, layerIds);
	setupFavoriteLayers(map, layerIds);
	queueMarkerImagePreparation(map, poiItems, state, rerender);
	if (map.getLayer(layerIds.clusterLayerId)) {
		map.setLayoutProperty(layerIds.clusterLayerId, 'visibility', shouldCluster ? 'visible' : 'none');
	}
	if (map.getLayer(layerIds.clusterCountLayerId)) {
		map.setLayoutProperty(layerIds.clusterCountLayerId, 'visibility', shouldCluster ? 'visible' : 'none');
	}
}

function syncSelectionLayerState(map, layerIds, activePoiId, mapNode, poiItems, state) {
	const hasSymbolLayer = map.getLayer(layerIds.pointLayerId);
	const hasFallbackLayer = map.getLayer(layerIds.pointFallbackLayerId);
	const hasFavoriteSymbolLayer = map.getLayer(layerIds.favoritePointLayerId);
	const hasFavoriteFallbackLayer = map.getLayer(layerIds.favoritePointFallbackLayerId);
	if (!hasSymbolLayer && !hasFallbackLayer && !hasFavoriteSymbolLayer && !hasFavoriteFallbackLayer) return;
	const shouldCluster = Boolean(state?.shouldCluster);
	const markerVisibility = state?.markerImagesReady ? 'visible' : 'none';
	const fallbackVisibility = state?.markerImagesReady ? 'none' : 'visible';
	const nonFavoriteFilter = ['!', ['has', 'point_count']];
	const favoriteFilter = ['all'];

	if (hasSymbolLayer) {
		map.setFilter(layerIds.pointLayerId, nonFavoriteFilter);
		map.setLayoutProperty(layerIds.pointLayerId, 'visibility', markerVisibility);
	}
	if (hasFallbackLayer) {
		map.setFilter(layerIds.pointFallbackLayerId, nonFavoriteFilter);
		map.setLayoutProperty(layerIds.pointFallbackLayerId, 'visibility', fallbackVisibility);
	}
	if (hasFavoriteSymbolLayer) {
		map.setFilter(layerIds.favoritePointLayerId, favoriteFilter);
		map.setLayoutProperty(layerIds.favoritePointLayerId, 'visibility', markerVisibility);
	}
	if (hasFavoriteFallbackLayer) {
		map.setFilter(layerIds.favoritePointFallbackLayerId, favoriteFilter);
		map.setLayoutProperty(layerIds.favoritePointFallbackLayerId, 'visibility', fallbackVisibility);
	}

	if (map.getLayer(layerIds.clusterLayerId)) {
		map.setLayoutProperty(layerIds.clusterLayerId, 'visibility', shouldCluster ? 'visible' : 'none');
	}
	if (map.getLayer(layerIds.clusterCountLayerId)) {
		map.setLayoutProperty(layerIds.clusterCountLayerId, 'visibility', shouldCluster ? 'visible' : 'none');
	}
}

function nextFrame() {
	return new Promise((resolve) => {
		window.requestAnimationFrame(() => resolve());
	});
}

function captureMapCamera(map) {
	const center = map.getCenter();
	return {
		center: [center.lng, center.lat],
		zoom: map.getZoom(),
		bearing: map.getBearing(),
		pitch: map.getPitch()
	};
}

async function applyPoiSelection({ mapboxgl, map, mapNode, poiItems, registry, layerIds, state }, activePoiId, shouldFly = true) {
	const previousActivePoiId = state.activePoiId;
	if (activePoiId && shouldFly && activePoiId !== previousActivePoiId) {
		state.returnCamera = captureMapCamera(map);
	}

	state.activePoiId = activePoiId;
	mapNode.__poiSelectionActive = Boolean(activePoiId);
	state.selectionNonce = (state.selectionNonce || 0) + 1;
	const selectionNonce = state.selectionNonce;
	syncPoiListState(registry, activePoiId);
	ensureActiveListItemVisible(registry, activePoiId, mapNode);
	renderPoiLayers(map, layerIds, poiItems, activePoiId, mapNode, state, () => {
		renderPoiLayers(map, layerIds, poiItems, state.activePoiId, mapNode, state, null);
		syncSelectionLayerState(map, layerIds, state.activePoiId, mapNode, poiItems, state);
		map.triggerRepaint();
	});
	syncSelectionLayerState(map, layerIds, activePoiId, mapNode, poiItems, state);
	map.triggerRepaint();
	await nextFrame();
	if (selectionNonce !== state.selectionNonce) return;

	if (!activePoiId) {
		const returnCamera = shouldFly ? state.returnCamera : null;
		state.returnCamera = null;
		if (returnCamera && shouldFly) {
			map.flyTo({
				center: returnCamera.center,
				zoom: returnCamera.zoom,
				bearing: returnCamera.bearing,
				pitch: returnCamera.pitch,
				duration: 650,
				essential: true
			});
		} else {
			fitPoiBounds(mapboxgl, map, poiItems, mapNode, shouldFly ? 700 : 0);
			syncPoiMinZoom(mapboxgl, map, poiItems, mapNode);
		}
		return;
	}

	const activePoi = poiItems.find((poi) => poi.id === activePoiId);
	if (!activePoi || !shouldFly) return;

	map.flyTo({
		center: activePoi.coordinates,
		zoom: Math.max(POI_ZOOM_FOCUS, map.getZoom()),
		duration: 650,
		essential: true
	});
}

function bindPoiList(context, listNode) {
	if (!listNode) return;

	const buttons = Array.from(listNode.querySelectorAll('[data-poi-target]'));
	buttons.forEach((button) => {
		const poiId = button.dataset.poiTarget || '';
		if (!context.registry.has(poiId)) return;

		const entry = context.registry.get(poiId);
		entry.listButton = button;
		entry.listPanel = listNode.querySelector(`[data-poi-panel="${poiId}"]`) || null;

		button.addEventListener('click', () => {
			const nextId = context.state.activePoiId === poiId ? null : poiId;
			void applyPoiSelection(context, nextId, true);
		});
	});
}

function bindMapClicks(context) {
	const { mapboxgl, map, layerIds, mapNode } = context;
	const onClusterClick = (event) => {
		const feature = event.features && event.features[0];
		if (!feature) return;

		const clusterId = feature.properties?.cluster_id;
		const pointCount = Number(feature.properties?.point_count || 0);
		const source = map.getSource(layerIds.sourceId);
		if (!source || typeof source.getClusterExpansionZoom !== 'function') return;
		const fallbackExpand = () => {
			source.getClusterExpansionZoom(clusterId, (error, zoom) => {
				if (error) return;
				map.easeTo({
					center: feature.geometry.coordinates,
					zoom,
					duration: 450,
					essential: true
				});
			});
		};

		if (typeof source.getClusterLeaves !== 'function') {
			fallbackExpand();
			return;
		}

		const leafLimit = Number.isFinite(pointCount) && pointCount > 0
			? Math.min(pointCount, 1500)
			: 100;
		source.getClusterLeaves(clusterId, leafLimit, 0, (error, leaves) => {
			if (error || !Array.isArray(leaves) || !leaves.length) {
				fallbackExpand();
				return;
			}

			const coordinates = leaves
				.map((leaf) => leaf?.geometry?.coordinates)
				.filter((coords) => Array.isArray(coords) && coords.length >= 2);
			if (!coordinates.length) {
				fallbackExpand();
				return;
			}

			const bounds = coordinates.reduce((acc, coords, index) => (
				index === 0
					? new mapboxgl.LngLatBounds(coords, coords)
					: acc.extend(coords)
			), null);
			if (!bounds) {
				fallbackExpand();
				return;
			}

			const rect = mapNode?.getBoundingClientRect?.() || { width: 0, height: 0 };
			const shortSide = Math.max(220, Math.min(rect.width || 220, rect.height || 220));
			const edgePadding = Math.max(26, Math.min(56, Math.round(shortSide * 0.12)));
			const basePadding = getPoiAdaptiveFitPadding(mapNode);
			map.fitBounds(bounds, {
				padding: {
					top: Math.max(basePadding.top, edgePadding),
					right: Math.max(basePadding.right, edgePadding),
					bottom: Math.max(basePadding.bottom, edgePadding),
					left: Math.max(basePadding.left, edgePadding)
				},
				maxZoom: Math.max(POI_ZOOM_FOCUS, map.getZoom() + 1),
				duration: 520
			});
		});
	};

	map.on('click', layerIds.pointLayerId, (event) => {
		const feature = event.features && event.features[0];
		if (!feature) return;
		const poiId = String(feature.properties?.poiId || '');
		if (!poiId) return;

		const nextId = context.state.activePoiId === poiId ? null : poiId;
		void applyPoiSelection(context, nextId, true);
	});
	map.on('click', layerIds.pointFallbackLayerId, (event) => {
		const feature = event.features && event.features[0];
		if (!feature) return;
		const poiId = String(feature.properties?.poiId || '');
		if (!poiId) return;

		const nextId = context.state.activePoiId === poiId ? null : poiId;
		void applyPoiSelection(context, nextId, true);
	});
	map.on('click', layerIds.favoritePointLayerId, (event) => {
		const feature = event.features && event.features[0];
		if (!feature) return;
		const poiId = String(feature.properties?.poiId || '');
		if (!poiId) return;

		const nextId = context.state.activePoiId === poiId ? null : poiId;
		void applyPoiSelection(context, nextId, true);
	});
	map.on('click', layerIds.favoritePointFallbackLayerId, (event) => {
		const feature = event.features && event.features[0];
		if (!feature) return;
		const poiId = String(feature.properties?.poiId || '');
		if (!poiId) return;

		const nextId = context.state.activePoiId === poiId ? null : poiId;
		void applyPoiSelection(context, nextId, true);
	});

	map.on('click', layerIds.clusterLayerId, onClusterClick);
	map.on('click', layerIds.clusterCountLayerId, onClusterClick);

	map.on('mouseenter', layerIds.pointLayerId, () => {
		map.getCanvas().style.cursor = 'pointer';
	});
	map.on('mouseleave', layerIds.pointLayerId, () => {
		map.getCanvas().style.cursor = '';
	});
	map.on('mouseenter', layerIds.pointFallbackLayerId, () => {
		map.getCanvas().style.cursor = 'pointer';
	});
	map.on('mouseleave', layerIds.pointFallbackLayerId, () => {
		map.getCanvas().style.cursor = '';
	});
	map.on('mouseenter', layerIds.favoritePointLayerId, () => {
		map.getCanvas().style.cursor = 'pointer';
	});
	map.on('mouseleave', layerIds.favoritePointLayerId, () => {
		map.getCanvas().style.cursor = '';
	});
	map.on('mouseenter', layerIds.favoritePointFallbackLayerId, () => {
		map.getCanvas().style.cursor = 'pointer';
	});
	map.on('mouseleave', layerIds.favoritePointFallbackLayerId, () => {
		map.getCanvas().style.cursor = '';
	});
	map.on('mouseenter', layerIds.clusterLayerId, () => {
		map.getCanvas().style.cursor = 'pointer';
	});
	map.on('mouseleave', layerIds.clusterLayerId, () => {
		map.getCanvas().style.cursor = '';
	});
	map.on('mouseenter', layerIds.clusterCountLayerId, () => {
		map.getCanvas().style.cursor = 'pointer';
	});
	map.on('mouseleave', layerIds.clusterCountLayerId, () => {
		map.getCanvas().style.cursor = '';
	});
}

function createResetViewControl(onReset) {
	return {
		_map: null,
		_container: null,
		onAdd(map) {
			this._map = map;
			const container = document.createElement('div');
			container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'mapboxgl-ctrl-reset-btn';
			button.setAttribute('aria-label', 'Reset kaartpositie');
			button.title = 'Reset kaartpositie';
			button.innerHTML = '<span class="mapboxgl-ctrl-reset-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
			button.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				if (typeof onReset === 'function') onReset();
			});

			container.appendChild(button);
			this._container = container;
			return container;
		},
		onRemove() {
			if (this._container?.parentNode) this._container.parentNode.removeChild(this._container);
			this._map = null;
			this._container = null;
		}
	};
}

async function initSinglePoiMap(mapboxgl, mapNode) {
	if (mapNode.dataset.mapboxPoiInitialized === 'true') return;
	mapNode.dataset.mapboxPoiInitializing = 'true';

	if (mapNode.__poiMapInstance && typeof mapNode.__poiMapInstance.remove === 'function') {
		try {
			if (typeof mapNode.__poiResizeCleanup === 'function') mapNode.__poiResizeCleanup();
			mapNode.__poiMapInstance.remove();
		} catch {
			// noop
		}
		mapNode.__poiMapInstance = null;
		mapNode.__poiResizeCleanup = null;
	}

	const poiItems = getPoiItems(mapNode);
	if (poiItems.length < POI_MIN_ITEMS) {
		delete mapNode.dataset.mapboxPoiInitializing;
		return;
	}

	let token = '';
	try {
		token = await getMapboxToken(mapNode);
	} catch (error) {
		console.warn('Unable to retrieve Mapbox token for POI map:', error);
		delete mapNode.dataset.mapboxPoiInitializing;
		return;
	}

	mapboxgl.accessToken = token;
	const revealMap = createMapReveal(mapNode);
	const style = getPreferredStyle(mapNode);
	const layerIds = createLayerIds(mapNode);

	const map = new mapboxgl.Map({
		container: mapNode,
		style,
		center: poiItems[0].coordinates,
		zoom: POI_ZOOM_DEFAULT,
		attributionControl: true,
		scrollZoom: true,
		dragPan: true,
		boxZoom: true,
		doubleClickZoom: true,
		dragRotate: false,
		keyboard: true,
		touchZoomRotate: true,
		config: {
			basemap: {
				theme: mapNode.dataset.mapTheme || DEFAULT_MAP_THEME,
				lightPreset: getPreferredLightPreset(mapNode)
			}
		}
	});

	mapNode.__poiMapInstance = map;
	mapNode.__poiResizeCleanup = null;
	mapNode.__poiSelectionActive = false;

	const desktopMq = window.matchMedia('(min-width: 1024px)');
	const getCtrlPosition = () => desktopMq.matches ? 'bottom-left' : 'bottom-right';

	const navCtrl = typeof mapboxgl.NavigationControl === 'function'
		? new mapboxgl.NavigationControl({ showCompass: false, showZoom: true, visualizePitch: false })
		: null;

	if (navCtrl) map.addControl(navCtrl, getCtrlPosition());

	map.on('load', async () => {
		const registry = new Map(poiItems.map((poi) => [poi.id, { poi, listButton: null, listPanel: null }]));
		const state = { activePoiId: null, selectionNonce: 0, markerImagesReady: false, markerImagesPromise: null, returnCamera: null };
		const context = { mapboxgl, map, mapNode, poiItems, registry, layerIds, state };

		const renderLayers = async () => {
			renderPoiLayers(map, layerIds, poiItems, state.activePoiId, mapNode, state, renderLayers);
			syncSelectionLayerState(map, layerIds, state.activePoiId, mapNode, poiItems, state);
		};

		await renderLayers();
		fitPoiBounds(mapboxgl, map, poiItems, mapNode, 0);
		syncPoiMinZoom(mapboxgl, map, poiItems, mapNode);
		revealWhenReady(map, revealMap);
		map.resize();
		window.requestAnimationFrame(() => {
			map.resize();
			if (!state.activePoiId) fitPoiBounds(mapboxgl, map, poiItems, mapNode, 0);
			syncPoiMinZoom(mapboxgl, map, poiItems, mapNode);
		});
		window.setTimeout(() => {
			map.resize();
			if (!state.activePoiId) fitPoiBounds(mapboxgl, map, poiItems, mapNode, 0);
			syncPoiMinZoom(mapboxgl, map, poiItems, mapNode);
		}, 180);

		const listNode = getPoiListNode(mapNode);
		bindPoiList(context, listNode);
		bindMapClicks(context);
		await applyPoiSelection(context, null, false);
		if (map.touchZoomRotate && typeof map.touchZoomRotate.disableRotation === 'function') {
			map.touchZoomRotate.disableRotation();
		}

		const resetCtrl = createResetViewControl(() => {
			void applyPoiSelection(context, null, true);
		});
		map.addControl(resetCtrl, getCtrlPosition());

		desktopMq.addEventListener('change', () => {
			const pos = getCtrlPosition();
			if (navCtrl) { map.removeControl(navCtrl); map.addControl(navCtrl, pos); }
			map.removeControl(resetCtrl); map.addControl(resetCtrl, pos);
		});

		mapNode.__poiResizeCleanup = setupResponsiveResize(mapboxgl, map, poiItems, mapNode, () => {
			syncPoiMinZoom(mapboxgl, map, poiItems, mapNode);
		});
		setupThemeStyleSync(map, mapNode, renderLayers);
		mapNode.dataset.mapboxPoiInitialized = 'true';
		delete mapNode.dataset.mapboxPoiInitializing;
	});

	map.on('error', () => {
		revealMap();
		delete mapNode.dataset.mapboxPoiInitializing;
	});
}

export async function initPoiMaps() {
	const mapNodes = Array.from(document.querySelectorAll('[data-mapbox-poi]'))
		.filter((mapNode) => {
			const initialized = mapNode.dataset.mapboxPoiInitialized === 'true';
			const initializing = mapNode.dataset.mapboxPoiInitializing === 'true';
			const hasCanvas = !!mapNode.querySelector('.mapboxgl-canvas');
			if (initialized && !hasCanvas) {
				delete mapNode.dataset.mapboxPoiInitialized;
				return !initializing;
			}
			return !initialized && !initializing;
		})
		.filter((mapNode) => mapNode.dataset.mapboxPoiInitializing !== 'true');

	if (!mapNodes.length) return;

	try {
		const mapboxgl = await loadMapboxGL();
		if (!mapboxgl) return;

		mapNodes.forEach((mapNode) => {
			initSinglePoiMap(mapboxgl, mapNode);
		});
	} catch (error) {
		console.error('Unable to initialize Mapbox POI maps:', error);
	}
}
