/**
 * Embed shortcodes voor YouTube, SoundCloud en Mixcloud.
 *
 * YouTube:    {% youtube "VIDEO_ID" %}            of {% youtube "VIDEO_ID", "Titel" %}
 * SoundCloud: {% soundcloud "TRACK_URL" %}        of {% soundcloud "TRACK_URL", "Titel" %}
 * Mixcloud:   {% mixcloud "/USER/SHOW/" %}        of {% mixcloud "/USER/SHOW/", "Titel" %}
 */

/**
 * Extracts a YouTube video ID from a full URL or plain ID string.
 */
function parseYouTubeId(input) {
	const raw = String(input || "").trim();
	if (!raw) return "";

	// Already a plain ID (11 chars, no slashes/dots)
	if (/^[\w-]{11}$/.test(raw)) return raw;

	try {
		const url = new URL(raw);
		// youtu.be/ID
		if (url.hostname === "youtu.be") return url.pathname.slice(1);
		// youtube.com/watch?v=ID  or  youtube-nocookie.com/embed/ID
		const v = url.searchParams.get("v");
		if (v) return v;
		const embedMatch = url.pathname.match(/\/embed\/([\w-]+)/);
		if (embedMatch) return embedMatch[1];
	} catch { /* not a URL, treat as ID */ }

	return raw;
}

export function youtubeShortcode(idOrUrl, title = "") {
	const id = parseYouTubeId(idOrUrl);
	if (!id) {
		console.warn("YouTube shortcode: geen video ID opgegeven.");
		return "";
	}

	const label = title || "YouTube video";
	const escapedTitle = label.replace(/"/g, "&quot;");

	return `<div class="embed embed-video" role="group" aria-label="${escapedTitle}">
	<iframe
		src="https://www.youtube-nocookie.com/embed/${id}"
		title="${escapedTitle}"
		allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
		allowfullscreen
		loading="lazy"
	></iframe>
</div>`;
}

export function soundcloudShortcode(url, title = "") {
	if (!url) {
		console.warn("SoundCloud shortcode: geen URL opgegeven.");
		return "";
	}

	const encodedUrl = encodeURIComponent(url.trim());
	const label = title || "SoundCloud";
	const escapedTitle = label.replace(/"/g, "&quot;");

	return `<div class="embed embed-audio embed-audio--soundcloud" role="group" aria-label="${escapedTitle}">
	<iframe
		src="https://w.soundcloud.com/player/?url=${encodedUrl}&color=%232563eb&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false"
		title="${escapedTitle}"
		allow="autoplay"
		loading="lazy"
	></iframe>
</div>`;
}

export function mixcloudShortcode(path, title = "") {
	if (!path) {
		console.warn("Mixcloud shortcode: geen pad opgegeven.");
		return "";
	}

	const encodedPath = encodeURIComponent(path.trim());
	const label = title || "Mixcloud";
	const escapedTitle = label.replace(/"/g, "&quot;");

	return `<div class="embed embed-audio embed-audio--mixcloud" role="group" aria-label="${escapedTitle}">
	<iframe
		src="https://player-widget.mixcloud.com/widget/iframe/?feed=${encodedPath}&hide_cover=1&dark=1"
		title="${escapedTitle}"
		allow="autoplay"
		loading="lazy"
	></iframe>
</div>`;
}
