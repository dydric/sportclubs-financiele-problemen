export function decodePolyline(encoded) {
	if (!encoded || typeof encoded !== 'string') return [];

	const coordinates = [];
	let index = 0;
	let latitude = 0;
	let longitude = 0;

	while (index < encoded.length) {
		let shift = 0;
		let result = 0;
		let byte = 0;

		do {
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);

		const latitudeDelta = (result & 1) ? ~(result >> 1) : (result >> 1);
		latitude += latitudeDelta;

		shift = 0;
		result = 0;

		do {
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);

		const longitudeDelta = (result & 1) ? ~(result >> 1) : (result >> 1);
		longitude += longitudeDelta;

		coordinates.push([longitude / 1e5, latitude / 1e5]);
	}

	return coordinates;
}
