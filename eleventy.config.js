import rssPlugin from "@11ty/eleventy-plugin-rss";
import "dotenv/config";
import htmlmin from "html-minifier-terser";
import site from './src/includes/data/site.js';
import autoLinkText from "./src/lib/filters/autolinktext.js";
import daysAgo from './src/lib/filters/daysago.js';
import readableDate from './src/lib/filters/readableDate.js';
import toDateFormat from './src/lib/filters/toDateFormat.js';
import { getMusicCardData } from './src/lib/shortcodes/album.js';

import { eleventyImageTransformPlugin } from '@11ty/eleventy-img';
import { galleryShortcode } from './src/lib/shortcodes/gallery.js';
import { youtubeShortcode, soundcloudShortcode, mixcloudShortcode } from './src/lib/shortcodes/embed.js';
import { videoShortcode } from './src/lib/shortcodes/video.js';

export default function(eleventyConfig) {

	const isProd = process.env.NODE_ENV === "production";
	const FEED_LIMIT = 10;

	const toSlug = (value) => {
		return String(value || "")
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
	};

	const normalizeCategories = (itemData) => {
		const raw = itemData.categories ?? itemData.category;
		if (!raw) return [];
		if (Array.isArray(raw)) return raw.map((category) => String(category).trim()).filter(Boolean);
		return [String(raw).trim()].filter(Boolean);
	};

	const getHideMode = (itemData) => {
		return String(itemData?.hide || "").trim().toLowerCase();
	};

	const isVisibleOnWebsite = (itemData) => {
		const hideMode = getHideMode(itemData);
		return hideMode !== "all" && hideMode !== "website";
	};

	const isVisibleInRss = (itemData) => {
		const hideMode = getHideMode(itemData);
		return hideMode !== "all" && hideMode !== "feed";
	};

	const getSortedFeedItems = (collectionApi) => {
		const items = collectionApi.getFilteredByGlob("./src/feed/**/*.{md,njk}");

		return items.sort((a, b) => {
			const aSticky = a.data.sticky === true;
			const bSticky = b.data.sticky === true;

			// Sticky items always come first
			if (aSticky && !bSticky) return -1;
			if (!aSticky && bSticky) return 1;

			// Both sticky or both not sticky -> sort by date (newest first)
			const aTime = a.date ? a.date.getTime() : 0;
			const bTime = b.date ? b.date.getTime() : 0;

			return bTime - aTime;
		});
	};

	const toFeedCategories = (items) => {
		const categories = new Map();

		for (const item of items) {
			for (const categoryName of normalizeCategories(item.data)) {
				const slug = toSlug(categoryName);
				if (!slug) continue;

				if (!categories.has(slug)) {
					categories.set(slug, {
						name: categoryName,
						slug,
						items: [],
						latestDate: null,
					});
				}

				const category = categories.get(slug);
				category.items.push(item);

				if (!category.latestDate || item.date > category.latestDate) {
					category.latestDate = item.date;
				}
			}
		}

		const sortedCategories = Array.from(categories.values()).sort((a, b) => {
			return a.name.localeCompare(b.name, "nl", { sensitivity: "base" });
		});

		return sortedCategories.map((category) => ({
			...category,
			updated: category.latestDate || site.dateNow,
			feedItems: category.items.slice(0, FEED_LIMIT),
		}));
	};

	// Ssst!
	eleventyConfig.setQuietMode(true);

	// Watch
	eleventyConfig.addWatchTarget('./src/js/');
	eleventyConfig.addWatchTarget('./src/css/');

	eleventyConfig.setServerOptions({
		watch: ['_site/css/**/*.css'],
	});

	// Pass-through
	eleventyConfig.addPassthroughCopy({
		"src/assets/": "/assets/",
		"src/media/": "/media/",
		"./_redirects": "./_redirects",
	});

	// Filters
	eleventyConfig.addFilter('absoluteImageUrls', (content, baseUrl) => {
		if (!content || !baseUrl) return content || "";
		const base = baseUrl.replace(/\/+$/, "");
		return content
			.replace(/(src|srcset)="\/([^"]+)"/g, (match, attr, path) => {
				if (attr === "srcset") {
					const parts = path.split(",").map((part) => {
						const trimmed = part.trim();
						return trimmed.startsWith("/")
							? `${base}/${trimmed.slice(1)}`
							: `${base}/${trimmed}`;
					});
					return `${attr}="${parts.join(", ")}"`;
				}
				return `${attr}="${base}/${path}"`;
			});
	});
	eleventyConfig.addFilter('readableDate', readableDate);
	eleventyConfig.addFilter('toDateFormat', toDateFormat);
	eleventyConfig.addFilter('daysAgo', daysAgo);
	eleventyConfig.addFilter('autoLinkText', autoLinkText);
	eleventyConfig.addNunjucksAsyncFilter('appleAlbumData', async (item, callback) => {
		try {
			const data = await getMusicCardData(item);
			callback(null, data);
		} catch {
			callback(null, null);
		}
	});

	// RSS/Atom filters (dateToRfc3339, etc.)
	eleventyConfig.addPlugin(rssPlugin);

	// Shortcodes
	eleventyConfig.addShortcode("cacheBuster", function () {
		return String(Date.now());
	});

	eleventyConfig.addPairedNunjucksAsyncShortcode("gallery", galleryShortcode);
	eleventyConfig.addShortcode("video", videoShortcode);
	eleventyConfig.addShortcode("youtube", youtubeShortcode);
	eleventyConfig.addShortcode("soundcloud", soundcloudShortcode);
	eleventyConfig.addShortcode("mixcloud", mixcloudShortcode);

	// Collections
	eleventyConfig.addCollection("feed", function(collectionApi) {
		return getSortedFeedItems(collectionApi).filter((item) => isVisibleOnWebsite(item.data));
	});

	eleventyConfig.addCollection("feedCategories", function(collectionApi) {
		const items = getSortedFeedItems(collectionApi).filter((item) => isVisibleOnWebsite(item.data));
		const rssItems = getSortedFeedItems(collectionApi).filter((item) => isVisibleInRss(item.data));
		const rssCategorySlugs = new Set(toFeedCategories(rssItems).map((c) => c.slug));
		return toFeedCategories(items).map((category) => ({
			...category,
			hasRssItems: rssCategorySlugs.has(category.slug),
		}));
	});

	eleventyConfig.addCollection("feedRss", function(collectionApi) {
		return getSortedFeedItems(collectionApi).filter((item) => isVisibleInRss(item.data));
	});

	eleventyConfig.addCollection("feedCategoriesRss", function(collectionApi) {
		const items = getSortedFeedItems(collectionApi).filter((item) => isVisibleInRss(item.data));
		return toFeedCategories(items);
	});

	// Images
	eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
		extensions: "html",
		formats: ["webp", "jpeg"],
		widths: [400, 800, 1200, "auto"],
		outputDir: "./_site/media/processed/",
		urlPath: "/media/processed/",
		defaultAttributes: {
			loading: "lazy",
			decoding: "async",
		},
		// Behoud expliciete loading/decoding/fetchpriority attributen (hero images)
		transformOnRequest: process.env.NODE_ENV !== "production",
	});

	// Minify HTML
	if (isProd) {
		eleventyConfig.addTransform("htmlmin", function (content) {
			if ((this.page.outputPath || "").endsWith(".html")) {
				let minified = htmlmin.minify(content, {
					useShortDoctype: true,
					removeComments: true,
					collapseWhitespace: true,
					// // Alpine.js:
					// ignoreCustomFragments: [/\s+x-[\w\-.:]+/g],
					// minifyJS: false,
				});
				return minified;
			}
			return content;
		});
	}

	// Output
	return {
		dir: {
			input: "src",
			output: "_site",
			layouts: "/includes/layouts",
			includes: "/includes/partials",
			data: "/includes/data"
		}
	};
};
