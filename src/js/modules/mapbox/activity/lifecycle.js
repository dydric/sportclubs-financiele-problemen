import { loadMapboxGL } from '../load-mapbox';
import { decodePolyline } from '../polyline';
import { DEFAULT_MAP_THEME, getRouteWidthConfig } from './constants';
import { getStreamData, getSafeZones, getMapboxToken } from './data';
import { getRoutePalette } from './palette';
import { sanitizeSpeedFeatureCollection, toSolidFeatureCollection } from './privacy';
import { renderRouteLayers, syncRouteWidths } from './route-layers';
import {
	buildSmoothedSpeedFeatures,
	getSpeedThresholds,
	toCoordinatesFromStreamLatlng,
	toSegmentFeatureCollection
} from './stream';
import { applyBasemapPresentation, getPreferredLightPreset, getPreferredStyle } from './theme';
import { fitRouteBounds } from './fit';

const ROUTE_DRAW_DEFAULT_MS = 2400;
const SPEED_DRAW_DEFAULT_MS = 3200;
const ROUTE_DRAW_MIN_MS = 500;
const ROUTE_DRAW_MAX_MS = 6000;

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function getRouteDrawDurationMs(mapNode) {
	const raw = Number(mapNode.dataset.routeDrawMs);
	const duration = Number.isFinite(raw) ? raw : ROUTE_DRAW_DEFAULT_MS;
	return clamp(duration, ROUTE_DRAW_MIN_MS, ROUTE_DRAW_MAX_MS);
}

function getSpeedDrawDurationMs(mapNode) {
	const raw = Number(mapNode.dataset.speedDrawMs);
	const duration = Number.isFinite(raw) ? raw : SPEED_DRAW_DEFAULT_MS;
	return clamp(duration, ROUTE_DRAW_MIN_MS, ROUTE_DRAW_MAX_MS);
}

function setupResponsiveResize(mapboxgl, map, routeCoordinates, mapNode, index) {
	let resizeTimer = null;
	const onResize = () => {
		window.clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(() => {
			map.resize();
			syncRouteWidths(map, index);
			fitRouteBounds(mapboxgl, map, routeCoordinates, mapNode);
		}, 120);
	};

	window.addEventListener('resize', onResize, { passive: true });
}

function setupThemeStyleSync(map, mapNode, renderLayers) {
	let activeStyle = getPreferredStyle(mapNode);

	const applyStyle = () => {
		const nextStyle = getPreferredStyle(mapNode);
		if (nextStyle === activeStyle) {
			applyBasemapPresentation(map, mapNode);
			renderLayers();
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

	map.on('style.load', () => {
		applyBasemapPresentation(map, mapNode);
		renderLayers();
	});
}

function createMapReveal(mapNode) {
	mapNode.style.visibility = 'hidden';
	return () => {
		mapNode.style.visibility = 'visible';
	};
}

function buildProgressLineData(coordinates, progress) {
	if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

	const clamped = clamp(progress, 0, 1);
	const totalSegments = coordinates.length - 1;
	const absolute = clamped * totalSegments;
	const segmentIndex = Math.floor(absolute);
	const segmentProgress = absolute - segmentIndex;

	const points = coordinates.slice(0, segmentIndex + 1);
	const start = coordinates[segmentIndex];
	const end = coordinates[Math.min(segmentIndex + 1, coordinates.length - 1)];

	if (start && end) {
		const lng = start[0] + ((end[0] - start[0]) * segmentProgress);
		const lat = start[1] + ((end[1] - start[1]) * segmentProgress);
		points.push([lng, lat]);
	}

	if (points.length < 2) points.push(coordinates[1]);

	return {
		type: 'FeatureCollection',
		features: [
			{
				type: 'Feature',
				geometry: {
					type: 'LineString',
					coordinates: points
				},
				properties: {}
			}
		]
	};
}

function removeProgressLayer(map, index) {
	const layerId = `activity-route-progress-${index}`;
	const sourceId = `activity-route-progress-src-${index}`;

	if (map.getLayer(layerId)) map.removeLayer(layerId);
	if (map.getSource(sourceId)) map.removeSource(sourceId);
}

function animateRouteDraw(map, index, routeCoordinates, routePalette, widthConfig, durationMs) {
	return new Promise((resolve) => {
		if (!routeCoordinates || routeCoordinates.length < 2) {
			resolve();
			return;
		}

		const sourceId = `activity-route-progress-src-${index}`;
		const layerId = `activity-route-progress-${index}`;
		removeProgressLayer(map, index);

		map.addSource(sourceId, {
			type: 'geojson',
			data: buildProgressLineData(routeCoordinates, 0)
		});

		map.addLayer({
			id: layerId,
			type: 'line',
			slot: 'middle',
			source: sourceId,
			layout: {
				'line-join': 'round',
				'line-cap': 'round'
			},
			paint: {
				'line-color': routePalette.base,
				'line-opacity': 1,
				'line-width': widthConfig.casing,
				'line-emissive-strength': 1
			}
		});

		const source = map.getSource(sourceId);
		if (!source) {
			removeProgressLayer(map, index);
			resolve();
			return;
		}

		const startTime = performance.now();
		const tick = (now) => {
			const elapsed = now - startTime;
			const progress = clamp(elapsed / durationMs, 0, 1);
			source.setData(buildProgressLineData(routeCoordinates, progress));

			if (progress >= 1) {
				resolve(() => removeProgressLayer(map, index));
				return;
			}

			window.requestAnimationFrame(tick);
		};

		window.requestAnimationFrame(tick);
	});
}

function removeSpeedProgressLayer(map, index) {
	const lineLayerId = `activity-route-line-${index}`;
	const baseLayerId = `${lineLayerId}-base`;
	const sourceId = `activity-route-${index}-speed`;
	const baseSourceId = `activity-route-${index}-primary`;

	if (map.getLayer(baseLayerId)) map.removeLayer(baseLayerId);
	if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
	if (map.getSource(baseSourceId)) map.removeSource(baseSourceId);
	if (map.getSource(sourceId)) map.removeSource(sourceId);
}

function animateSpeedOverlay(map, index, segmentCollection, sportType, routePalette, widthConfig, durationMs) {
	return new Promise((resolve) => {
		const features = buildSmoothedSpeedFeatures(segmentCollection);
		if (!features.length) {
			resolve();
			return;
		}

		const lineLayerId = `activity-route-line-${index}`;
		const baseLayerId = `${lineLayerId}-base`;
		const sourceId = `activity-route-${index}-speed`;
		const baseSourceId = `activity-route-${index}-primary`;
		const thresholds = getSpeedThresholds(segmentCollection, sportType);
		removeSpeedProgressLayer(map, index);

		map.addSource(baseSourceId, {
			type: 'geojson',
			data: {
				type: 'FeatureCollection',
				features: []
			}
		});

		map.addLayer({
			id: baseLayerId,
			type: 'line',
			slot: 'middle',
			source: baseSourceId,
			layout: {
				'line-join': 'round',
				'line-cap': 'round'
			},
			paint: {
				'line-color': routePalette.base,
				'line-opacity': 0.9,
				'line-width': widthConfig.casing,
				'line-emissive-strength': 1
			}
		});

		map.addSource(sourceId, {
			type: 'geojson',
			data: {
				type: 'FeatureCollection',
				features: []
			}
		});

		map.addLayer({
			id: lineLayerId,
			type: 'line',
			slot: 'middle',
			source: sourceId,
			layout: {
				'line-join': 'round',
				'line-cap': 'round'
			},
			paint: {
				'line-color': [
					'interpolate',
					['linear'],
					['get', 'speedKmhSmoothed'],
					Math.max(0, thresholds.low - 1.2), routePalette.slow,
					thresholds.low, routePalette.medium,
					thresholds.high, routePalette.fast
				],
				'line-opacity': 1,
				'line-width': widthConfig.casing,
				'line-blur': 0.35,
				'line-emissive-strength': 1
			}
		});

		const source = map.getSource(sourceId);
		const baseSource = map.getSource(baseSourceId);
		if (!source) {
			removeSpeedProgressLayer(map, index);
			resolve();
			return;
		}

		const total = features.length;
		let previousCount = -1;
		const startTime = performance.now();
		const tick = (now) => {
			const elapsed = now - startTime;
			const progress = clamp(elapsed / durationMs, 0, 1);
			const count = Math.max(1, Math.ceil(progress * total));

			if (count !== previousCount) {
				previousCount = count;
				if (baseSource) {
					baseSource.setData({
						type: 'FeatureCollection',
						features: features.slice(0, count)
					});
				}
				source.setData({
					type: 'FeatureCollection',
					features: features.slice(0, count)
				});
			}

			if (progress >= 1) {
				resolve();
				return;
			}

			window.requestAnimationFrame(tick);
		};

		window.requestAnimationFrame(tick);
	});
}

async function initSingleActivityMap(mapboxgl, mapNode, index) {
	if (mapNode.dataset.mapboxActivityInitialized === 'true') return;
	mapNode.dataset.mapboxActivityInitializing = 'true';

	if (mapNode.__activityMapInstance && typeof mapNode.__activityMapInstance.remove === 'function') {
		try {
			mapNode.__activityMapInstance.remove();
		} catch {
			// noop
		}
		mapNode.__activityMapInstance = null;
	}

	const style = getPreferredStyle(mapNode);
	const sportType = mapNode.dataset.sportType || '';
	const safeZones = getSafeZones(mapNode);
	const streamData = getStreamData(mapNode);
	const segmentCollection = sanitizeSpeedFeatureCollection(toSegmentFeatureCollection(streamData), safeZones);
	const fallbackPolyline = mapNode.dataset.route || '';
	const fallbackCoordinates = fallbackPolyline
		? decodePolyline(fallbackPolyline)
		: toCoordinatesFromStreamLatlng(streamData);
	const fallbackCollection = toSolidFeatureCollection(fallbackCoordinates, safeZones);
	const hasSpeedSegments = !!segmentCollection;
	const routeCoordinates = hasSpeedSegments
		? segmentCollection.coordinatesForBounds
		: (fallbackCollection ? fallbackCollection.coordinatesForBounds : []);

	if (!routeCoordinates.length) {
		console.warn('Missing route coordinates for activity map after privacy filtering');
		delete mapNode.dataset.mapboxActivityInitializing;
		return;
	}

	let token = '';
	try {
		token = await getMapboxToken(mapNode);
	} catch (error) {
		console.warn('Unable to retrieve Mapbox token for activity map:', error);
		delete mapNode.dataset.mapboxActivityInitializing;
		return;
	}

	mapboxgl.accessToken = token;
	const revealMap = createMapReveal(mapNode);

	const map = new mapboxgl.Map({
		container: mapNode,
		style,
		center: routeCoordinates[0],
		zoom: 12,
		attributionControl: true,
		scrollZoom: false,
		dragPan: false,
		boxZoom: false,
		doubleClickZoom: false,
		dragRotate: false,
		keyboard: false,
		touchZoomRotate: false,
		config: {
			basemap: {
				theme: mapNode.dataset.mapTheme || DEFAULT_MAP_THEME,
				lightPreset: getPreferredLightPreset(mapNode)
			}
		}
	});
	mapNode.__activityMapInstance = map;

	const renderLayers = () => {
		const widthConfig = getRouteWidthConfig();
		const routePalette = getRoutePalette(mapNode);
		renderRouteLayers(map, index, hasSpeedSegments, segmentCollection, sportType, fallbackCollection, routePalette, widthConfig);
		fitRouteBounds(mapboxgl, map, routeCoordinates, mapNode);
	};

	map.on('load', async () => {
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const drawDurationMs = getRouteDrawDurationMs(mapNode);
		const speedDrawDurationMs = getSpeedDrawDurationMs(mapNode);
		const widthConfig = getRouteWidthConfig();
		const routePalette = getRoutePalette(mapNode);
		let cleanupAnimatedLayer = null;
		const canAnimate = !prefersReducedMotion && drawDurationMs > 0;

		// First set the correct viewport, then reveal and animate.
		fitRouteBounds(mapboxgl, map, routeCoordinates, mapNode);
		revealMap();

		if (canAnimate) {
			if (hasSpeedSegments) {
				await animateSpeedOverlay(
					map,
					index,
					segmentCollection,
					sportType,
					routePalette,
					widthConfig,
					speedDrawDurationMs > 0 ? speedDrawDurationMs : drawDurationMs
				);
			} else {
				cleanupAnimatedLayer = await animateRouteDraw(map, index, routeCoordinates, routePalette, widthConfig, drawDurationMs);
			}
		}

		if (!(canAnimate && hasSpeedSegments)) {
			renderLayers();
		}
		if (typeof cleanupAnimatedLayer === 'function') cleanupAnimatedLayer();
		syncRouteWidths(map, index);
		setupResponsiveResize(mapboxgl, map, routeCoordinates, mapNode, index);
		setupThemeStyleSync(map, mapNode, renderLayers);
		mapNode.dataset.mapboxActivityInitialized = 'true';
		delete mapNode.dataset.mapboxActivityInitializing;
	});

	map.on('error', () => {
		revealMap();
		delete mapNode.dataset.mapboxActivityInitializing;
	});
}

export async function initActivityMaps() {
	const mapNodes = Array.from(document.querySelectorAll('[data-mapbox-activity]'))
		.filter((mapNode) => {
			const initialized = mapNode.dataset.mapboxActivityInitialized === 'true';
			const initializing = mapNode.dataset.mapboxActivityInitializing === 'true';
			const hasCanvas = !!mapNode.querySelector('.mapboxgl-canvas');
			if (initialized && !hasCanvas) {
				delete mapNode.dataset.mapboxActivityInitialized;
				return !initializing;
			}
			return !initialized && !initializing;
		})
		.filter((mapNode) => mapNode.dataset.mapboxActivityInitializing !== 'true');

	if (!mapNodes.length) return;

	try {
		const mapboxgl = await loadMapboxGL();
		if (!mapboxgl) return;

		mapNodes.forEach((mapNode, index) => {
			initSingleActivityMap(mapboxgl, mapNode, index);
		});
	} catch (error) {
		console.error('Unable to initialize Mapbox activity maps:', error);
	}
}
