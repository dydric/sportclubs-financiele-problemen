// Bestand: netlify/functions/likes.mjs
// Beheert like-tellers per bericht en per reactie-type via Netlify Blobs.
//
// GET  /.netlify/functions/likes?slug=<slug>
//   → { counts: { "<type-key>": <number>, ... } }
//
// POST /.netlify/functions/likes
//   body: { slug: "<slug>", type: "<emoji>" }
//   → { counts: { "<type-key>": <number>, ... } }
//
// Type-sleutels zijn de Unicode code points van de emoji, gescheiden door koppeltekens.
// Voorbeeld: "♥️" → "2665-fe0f", "💪" → "1f4aa", "🎉" → "1f389"

import { connectLambda, getStore } from '@netlify/blobs';

// Geldige post-slugs
const SLUG_RE = /^[a-zA-Z0-9][a-zA-Z0-9-_]{0,99}$/;

// Geldige type-sleutels: Unicode code points in hex gescheiden door koppeltekens
const TYPE_KEY_RE = /^[0-9a-f]{1,6}(-[0-9a-f]{1,6}){0,9}$/;

// Zet een emoji om naar een stabiele ASCII-sleutel op basis van Unicode code points.
// Dezelfde functie staat in likes.js zodat browser en server altijd dezelfde sleutel genereren.
const emojiToKey = (emoji) =>
	[...emoji].map(c => c.codePointAt(0).toString(16)).join('-');

const respond = (statusCode, data) => ({
	statusCode,
	headers: {
		'Content-Type': 'application/json',
		'Cache-Control': 'no-store, no-cache',
	},
	body: JSON.stringify(data),
});

export async function handler(event) {
	// Vereist voor Netlify Functions v1 + Blobs
	connectLambda(event);

	const store = getStore('likes');
	const method = event.httpMethod;

	// --- GET: haal alle type-tellers op voor een bericht ---
	if (method === 'GET') {
		const slug = event.queryStringParameters?.slug?.trim();

		if (!slug || !SLUG_RE.test(slug)) {
			return respond(400, { error: 'Ongeldige slug' });
		}

		try {
			const data = await store.get(slug, { type: 'json' });
			return respond(200, { counts: data?.counts ?? {} });
		} catch (err) {
			console.error('[likes] GET fout:', err.message);
			return respond(500, { error: 'Serverfout' });
		}
	}

	// --- POST: registreer een like voor een specifiek type ---
	if (method === 'POST') {
		let slug, type, count;

		try {
			const body = JSON.parse(event.body || '{}');
			slug  = body.slug?.trim();
			type  = body.type?.trim();
			count = body.count;
		} catch {
			return respond(400, { error: 'Ongeldige JSON' });
		}

		if (!slug || !SLUG_RE.test(slug)) {
			return respond(400, { error: 'Ongeldige slug' });
		}

		if (!type) {
			return respond(400, { error: 'Ontbrekend type' });
		}

		// count moet een geheel getal zijn tussen 1 en 100
		const delta = Math.round(Number(count));
		if (!Number.isFinite(delta) || delta < 1 || delta > 100) {
			return respond(400, { error: 'Ongeldig aantal' });
		}

		// Zet emoji om naar sleutel en valideer het resultaat
		const typeKey = emojiToKey(type);
		if (!TYPE_KEY_RE.test(typeKey)) {
			return respond(400, { error: 'Ongeldig type' });
		}

		try {
			const current = await store.get(slug, { type: 'json' });
			const counts = { ...(current?.counts ?? {}) };
			counts[typeKey] = (counts[typeKey] ?? 0) + delta;
			await store.setJSON(slug, { counts });
			return respond(200, { counts });
		} catch (err) {
			console.error('[likes] POST fout:', err.message);
			return respond(500, { error: 'Serverfout' });
		}
	}

	return respond(405, { error: 'Methode niet toegestaan' });
}
