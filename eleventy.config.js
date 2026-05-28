import "dotenv/config";
import htmlmin from "html-minifier-terser";
import readableDate from './src/lib/filters/readableDate.js';
import toDateFormat from './src/lib/filters/toDateFormat.js';
import daysAgo from './src/lib/filters/daysago.js';
import autoLinkText from "./src/lib/filters/autolinktext.js";

import { eleventyImageTransformPlugin } from '@11ty/eleventy-img';
import { galleryShortcode } from './src/lib/shortcodes/gallery.js';
import { youtubeShortcode, soundcloudShortcode, mixcloudShortcode } from './src/lib/shortcodes/embed.js';
import { videoShortcode } from './src/lib/shortcodes/video.js';

export default function(eleventyConfig) {

	const isProd = process.env.NODE_ENV === "production";

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
	});

	// Filters
	eleventyConfig.addFilter('readableDate', readableDate);
	eleventyConfig.addFilter('toDateFormat', toDateFormat);
	eleventyConfig.addFilter('daysAgo', daysAgo);
	eleventyConfig.addFilter('autoLinkText', autoLinkText);

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
		const items = collectionApi.getFilteredByGlob("./src/feed/**/*.{md,njk}");
		return items.sort((a, b) => {
			const aSticky = a.data.sticky === true;
			const bSticky = b.data.sticky === true;
			if (aSticky && !bSticky) return -1;
			if (!aSticky && bSticky) return 1;
			const aTime = a.date ? a.date.getTime() : 0;
			const bTime = b.date ? b.date.getTime() : 0;
			return aTime - bTime;
		});
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
