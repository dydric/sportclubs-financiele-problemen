import { getRouteWidthConfig } from './constants';
import { buildSmoothedSpeedFeatures, getSpeedThresholds } from './stream';

function drawSolidRoute(map, sourceId, layerId, fallbackCollection, routePalette, widthConfig) {
	map.addSource(sourceId, {
		type: 'geojson',
		data: fallbackCollection
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
}

function drawSpeedRoute(map, sourceId, layerId, segmentCollection, fallbackCollection, sportType, routePalette, widthConfig) {
	const primarySourceId = `${sourceId}-primary`;
	const speedSourceId = `${sourceId}-speed`;

	map.addSource(primarySourceId, {
		type: 'geojson',
		data: fallbackCollection
	});

	map.addLayer({
		id: `${layerId}-base`,
		type: 'line',
		slot: 'middle',
		source: primarySourceId,
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

	const thresholds = getSpeedThresholds(segmentCollection, sportType);
	const speedFeatures = buildSmoothedSpeedFeatures(segmentCollection);

	map.addSource(speedSourceId, {
		type: 'geojson',
		data: {
			type: 'FeatureCollection',
			features: speedFeatures
		}
	});

	map.addLayer({
		id: layerId,
		type: 'line',
		slot: 'middle',
		source: speedSourceId,
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
}

function cleanupRouteLayersAndSources(map, index) {
	const layerId = `activity-route-line-${index}`;
	const layerIds = [
		layerId,
		`${layerId}-base`,
		`${layerId}-casing`
	];

	for (const id of layerIds) {
		if (map.getLayer(id)) map.removeLayer(id);
	}

	const sourceIds = [
		`activity-route-${index}`,
		`activity-route-${index}-primary`,
		`activity-route-${index}-speed`
	];

	for (const id of sourceIds) {
		if (map.getSource(id)) map.removeSource(id);
	}
}

export function renderRouteLayers(map, index, hasSpeedSegments, segmentCollection, sportType, fallbackCollection, routePalette, widthConfig) {
	cleanupRouteLayersAndSources(map, index);

	const sourceId = `activity-route-${index}`;
	const layerId = `activity-route-line-${index}`;

	if (hasSpeedSegments) {
		drawSpeedRoute(map, sourceId, layerId, segmentCollection, fallbackCollection, sportType, routePalette, widthConfig);
	} else {
		drawSolidRoute(map, sourceId, layerId, fallbackCollection, routePalette, widthConfig);
	}
}

export function syncRouteWidths(map, index) {
	const lineLayerId = `activity-route-line-${index}`;
	const casingLayerId = `${lineLayerId}-casing`;
	const baseLayerId = `${lineLayerId}-base`;
	const widthConfig = getRouteWidthConfig();

	if (map.getLayer(casingLayerId)) {
		map.setPaintProperty(casingLayerId, 'line-width', widthConfig.casing);
	}

	if (map.getLayer(baseLayerId)) {
		map.setPaintProperty(baseLayerId, 'line-width', widthConfig.casing);
	}

	if (map.getLayer(lineLayerId)) {
		map.setPaintProperty(lineLayerId, 'line-width', widthConfig.casing);
	}
}
