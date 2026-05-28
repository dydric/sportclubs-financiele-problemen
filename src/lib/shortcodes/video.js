/**
 * Video shortcode voor zelf-gehoste video's.
 *
 * Syntax:
 *   {% video "launch-1.mp4" %}                          — lokaal (src/media/video/)
 *   {% video "launch-1.mp4", "Raketlancering" %}        — met titel
 *   {% video "https://example.com/vid.mp4" %}            — extern
 *   {% video "https://example.com/vid.mp4", "Titel", "1920x1080" %} — extern met dimensies
 */

import fs from "fs";
import path from "path";

const INPUT_DIR = "src";
const VIDEO_DIR = "media/video";

/**
 * Lees breedte/hoogte uit een MP4 bestand door de avc1/hvc1/hev1 sample entry te parsen.
 */
function readMP4Dimensions(filePath) {
	try {
		const buf = fs.readFileSync(filePath);
		for (const codec of ["avc1", "hvc1", "hev1", "av01"]) {
			let idx = 0;
			while ((idx = buf.indexOf(codec, idx)) !== -1) {
				if (idx + 30 < buf.length) {
					const w = buf.readUInt16BE(idx + 28);
					const h = buf.readUInt16BE(idx + 30);
					if (w > 0 && h > 0) return { width: w, height: h };
				}
				idx += 4;
			}
		}
	} catch (e) {
		console.warn(`Video: kon ${filePath} niet lezen — ${e.message}`);
	}
	return null;
}

/**
 * Parse dimensies uit een expliciet "WxH" hint of URL parameters.
 */
function parseDimensionsFromHint(hint, url) {
	if (hint) {
		const match = hint.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
		if (match) return { width: +match[1], height: +match[2] };
	}
	if (url) {
		try {
			const parsed = new URL(url);
			const w = parsed.searchParams.get("w") || parsed.searchParams.get("width");
			const h = parsed.searchParams.get("h") || parsed.searchParams.get("height");
			if (w && h) return { width: +w, height: +h };
		} catch { /* geen URL */ }
	}
	return null;
}

/**
 * Genereer de <video> HTML.
 */
function buildVideoHtml(src, { title = "", width, height, isPortrait }) {
	const escapedTitle = (title || "Video").replace(/"/g, "&quot;");
	const orientation = isPortrait ? "portrait" : "landscape";
	const sizeAttrs = width && height ? ` width="${width}" height="${height}"` : "";

	return `<div class="embed embed-video-native embed-video-native--${orientation}" role="group" aria-label="${escapedTitle}">
	<video
		src="${src}"${sizeAttrs}
		autoplay muted loop playsinline
		preload="metadata"
		aria-label="${escapedTitle}"
	></video>
</div>`;
}

export function videoShortcode(srcOrUrl, title = "", dimsHint = "") {
	if (!srcOrUrl) {
		console.warn("Video shortcode: geen bron opgegeven.");
		return "";
	}

	const raw = srcOrUrl.trim();
	const isRemote = /^https?:\/\//.test(raw);

	let src, width, height;

	if (isRemote) {
		src = raw;
		const dims = parseDimensionsFromHint(dimsHint, raw);
		if (dims) {
			width = dims.width;
			height = dims.height;
		}
	} else {
		// Pad met / of \ erin → relatief aan src/media/, anders → src/media/video/
		const relPath = raw.includes("/") || raw.includes("\\")
			? path.join("media", raw)
			: path.join(VIDEO_DIR, raw);
		const fsPath = path.join(INPUT_DIR, relPath);
		src = `/${relPath}`;

		const dims = readMP4Dimensions(fsPath);
		if (dims) {
			width = dims.width;
			height = dims.height;
		}
	}

	const isPortrait = width && height ? height > width : false;

	return buildVideoHtml(src, { title, width, height, isPortrait });
}

/**
 * Voor gallery-gebruik: geeft video metadata terug.
 */
export function getVideoMetadata(srcOrUrl, galleryName, dimsHint) {
	const raw = srcOrUrl.trim();
	const isRemote = /^https?:\/\//.test(raw);

	let src, width, height;

	if (isRemote) {
		src = raw;
		const dims = parseDimensionsFromHint(dimsHint, raw);
		if (dims) {
			width = dims.width;
			height = dims.height;
		}
	} else {
		// Gallery videos: check eerst galleries/<naam>/, dan video/
		const galleryPath = path.join("media/galleries", galleryName, raw);
		const videoPath = path.join(VIDEO_DIR, raw);
		const galleryFsPath = path.join(INPUT_DIR, galleryPath);
		const videoFsPath = path.join(INPUT_DIR, videoPath);

		if (fs.existsSync(galleryFsPath)) {
			src = `/${galleryPath}`;
			const dims = readMP4Dimensions(galleryFsPath);
			if (dims) { width = dims.width; height = dims.height; }
		} else {
			src = `/${videoPath}`;
			const dims = readMP4Dimensions(videoFsPath);
			if (dims) { width = dims.width; height = dims.height; }
		}
	}

	if (!width || !height) {
		width = 1920;
		height = 1080;
	}

	const aspectRatio = parseFloat((width / height).toFixed(3));

	return { src, width, height, aspectRatio, isRemote, isVideo: true };
}
