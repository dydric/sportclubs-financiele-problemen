import Fetch from '@11ty/eleventy-fetch';

const NOTION_VERSION = '2022-06-28';
const DEFAULT_PAGE_SIZE = 100;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DEFAULT_CACHE_DURATION = process.env.NOTION_POI_CACHE_DURATION || (IS_PRODUCTION ? '30m' : '1s');
const MAX_PAGE_REQUESTS = Number(process.env.NOTION_POI_MAX_PAGE_REQUESTS || 1000);

function normalizeDatabaseId(input = '') {
	const value = String(input || '').trim();
	if (!value) return '';

	const fromUrl = value.match(/([a-f0-9]{32})/i);
	const raw = fromUrl ? fromUrl[1] : value;
	const cleaned = raw.replace(/-/g, '');
	if (!/^[a-f0-9]{32}$/i.test(cleaned)) return '';
	return cleaned.toLowerCase();
}

function getDatabaseId() {
	return normalizeDatabaseId(
		process.env.NOTION_POI_DATABASE_ID
			|| process.env.NOTION_POI_DATABASE_URL
			|| '24caeaaa559f80329597f5af7eb1d6e8'
	);
}

async function queryDatabase(databaseId, notionToken, startCursor = null) {
	if (!databaseId || !notionToken) return { results: [], has_more: false, next_cursor: null };

	const url = `https://api.notion.com/v1/databases/${databaseId}/query`;
	const body = {
		page_size: DEFAULT_PAGE_SIZE
	};
	if (startCursor) body.start_cursor = startCursor;

	return Fetch(url, {
		duration: DEFAULT_CACHE_DURATION,
		type: 'json',
		fetchOptions: {
			method: 'POST',
			headers: {
				'Notion-Version': NOTION_VERSION,
				Authorization: `Bearer ${notionToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		}
	});
}

export async function getNotionPoiPages() {
	const databaseId = getDatabaseId();
	const notionToken = process.env.NOTION_TOKEN || '';

	if (!databaseId || !notionToken) return [];

	try {
		const pages = [];
		let cursor = null;
		let hasMore = true;
		let requestCount = 0;
		const seenCursors = new Set();

		while (hasMore && requestCount < MAX_PAGE_REQUESTS) {
			const cursorKey = cursor || '__start__';
			if (seenCursors.has(cursorKey)) break;
			seenCursors.add(cursorKey);

			const payload = await queryDatabase(databaseId, notionToken, cursor);
			const results = Array.isArray(payload?.results) ? payload.results : [];
			pages.push(...results);
			requestCount += 1;
			hasMore = Boolean(payload?.has_more);
			cursor = payload?.next_cursor || null;
			if (!cursor) hasMore = false;
		}

		if (hasMore && requestCount >= MAX_PAGE_REQUESTS) {
			console.warn(`[notion-poi] Reached MAX_PAGE_REQUESTS (${MAX_PAGE_REQUESTS}) before completion.`);
		}

		return pages;
	} catch (error) {
		console.error('Error fetching Notion POI pages:', error);
		return [];
	}
}
