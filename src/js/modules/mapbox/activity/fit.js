import { getFitPadding } from './constants';

export function fitRouteBounds(mapboxgl, map, coordinates, mapNode) {
	if (!coordinates || !coordinates.length) return;

	const bounds = coordinates.reduce(
		(acc, coordinate) => acc.extend(coordinate),
		new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
	);

	map.fitBounds(bounds, {
		padding: getFitPadding(mapNode),
		maxZoom: 15,
		duration: 0
	});
}
