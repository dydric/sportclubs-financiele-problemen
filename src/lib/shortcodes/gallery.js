import sharp from "sharp";
import path from "path";
import { getVideoMetadata } from "./video.js";

const INPUT_DIR = "src";
const GALLERY_DIR = "media/galleries";

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".m4v"]);

/**
 * Probeer afmetingen uit een URL te halen.
 *   picsum:   https://picsum.photos/seed/name/1600/1067
 *   unsplash: https://images.unsplash.com/photo-xxx?w=1200&h=800
 *   explicit: https://example.com/img.jpg | alt | 1600x1067
 */
function parseDimensionsFromUrl(url, explicitDims) {
	// Explicit WxH override (derde veld in content regel)
	if (explicitDims) {
		const match = explicitDims.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
		if (match) return { width: +match[1], height: +match[2] };
	}

	// picsum.photos/seed/<name>/<w>/<h>  of  picsum.photos/<w>/<h>
	const picsumMatch = url.match(/picsum\.photos\/(?:seed\/[^/]+\/)?(\d+)\/(\d+)/);
	if (picsumMatch) return { width: +picsumMatch[1], height: +picsumMatch[2] };

	// Unsplash ?w=...&h=...
	try {
		const parsed = new URL(url);
		const w = parsed.searchParams.get("w") || parsed.searchParams.get("width");
		const h = parsed.searchParams.get("h") || parsed.searchParams.get("height");
		if (w && h) return { width: +w, height: +h };
	} catch { /* niet een URL */ }

	return null;
}

/**
 * Paired Nunjucks shortcode: {% gallery "naam", [1, 3, 2] %}...{% endgallery %}
 *
 * Content format per regel:
 *   bestandsnaam.jpg | alt tekst                     (lokaal, in src/media/galleries/<naam>/)
 *   https://picsum.photos/seed/x/1600/1067 | alt     (remote, dimensies uit URL)
 *   https://example.com/img.jpg | alt | 1600x1067    (remote, expliciete dimensies)
 */
export async function galleryShortcode(content, galleryName, layout) {
	if (!galleryName || !layout || !Array.isArray(layout)) {
		console.warn("Gallery shortcode: galleryName (string) en layout (array) zijn verplicht.");
		return "";
	}

	const lines = content
		.trim()
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);

	if (!lines.length) return "";

	const items = [];
	for (const line of lines) {
		const parts = line.split("|").map((s) => s.trim());
		const src = parts[0] || "";
		const alt = parts[1] || "";
		const dimsHint = parts[2] || "";

		if (!src) continue;

		const ext = path.extname(src).toLowerCase();
		const isVideo = VIDEO_EXTENSIONS.has(ext);
		const isRemote = /^https?:\/\//.test(src);

		if (isVideo) {
			const meta = getVideoMetadata(src, galleryName, dimsHint);
			items.push({ ...meta, alt, isVideo: true });
			continue;
		}

		let aspectRatio = 1.5;
		let width = 800;
		let height = 533;
		let imgSrc;

		if (isRemote) {
			imgSrc = src;
			const dims = parseDimensionsFromUrl(src, dimsHint);
			if (dims) {
				width = dims.width;
				height = dims.height;
				aspectRatio = parseFloat((width / height).toFixed(3));
			} else if (dimsHint) {
				console.warn(`Gallery: kon dimensies niet parsen uit "${dimsHint}" voor ${src}`);
			}
		} else {
			const relPath = path.join(GALLERY_DIR, galleryName, src);
			const fsPath = path.join(INPUT_DIR, relPath);
			imgSrc = `/${relPath}`;

			try {
				const metadata = await sharp(fsPath).metadata();
				width = metadata.width;
				height = metadata.height;
				aspectRatio = parseFloat((width / height).toFixed(3));
			} catch (e) {
				console.warn(`Gallery: kon ${fsPath} niet lezen — ${e.message}`);
			}
		}

		items.push({ src: imgSrc, alt, aspectRatio, width, height, isRemote, isVideo: false });
	}

	if (!items.length) return "";

	const totalExpected = layout.reduce((sum, n) => sum + n, 0);
	if (totalExpected > items.length) {
		console.warn(
			`Gallery "${galleryName}": layout verwacht ${totalExpected} items maar er zijn er ${items.length}.`
		);
	}

	let html = `<div class="gallery" role="group" aria-label="Galerij ${galleryName}">\n`;
	let itemIndex = 0;

	for (const count of layout) {
		html += '\t<div class="gallery-row">\n';

		for (let i = 0; i < count && itemIndex < items.length; i++, itemIndex++) {
			const item = items[itemIndex];
			const escapedAlt = (item.alt || "").replace(/"/g, "&quot;");

			html += `\t\t<div class="gallery-item" style="flex-grow: ${item.aspectRatio}; flex-basis: ${Math.round(item.aspectRatio * 200)}px; aspect-ratio: ${item.aspectRatio}">\n`;

			if (item.isVideo) {
				html += `\t\t\t<video src="${item.src}" autoplay muted loop playsinline preload="metadata" aria-label="${escapedAlt}"></video>\n`;
			} else {
				const widthsAttr = item.isRemote ? "" : ' eleventy:widths="400,800,1200"';
				html += `\t\t\t<img src="${item.src}" alt="${escapedAlt}"${widthsAttr}>\n`;
			}

			html += "\t\t</div>\n";
		}

		html += "\t</div>\n";
	}

	html += "</div>";
	return html;
}
