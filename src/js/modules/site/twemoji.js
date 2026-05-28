import twemoji from "twemoji";

const CDN_BASE = "https://cdn.jsdelivr.net/gh/twitter/twemoji@v14.0.2/assets/svg";

const runTwemoji = () => {
	const target = document.querySelector("main") || document.body;
	if (!target) return;
	// Skip parse work when there are no likely emoji codepoints in content.
	if (!/[\u{00A9}\u{00AE}\u{200D}\u{203C}-\u{3299}\u{1F000}-\u{1FAFF}]/u.test(target.textContent || "")) return;

	twemoji.parse(target, {
		callback: (icon) => `${CDN_BASE}/${icon}.svg`,
		attributes: () => ({
			loading: "lazy",
			decoding: "async",
			fetchpriority: "low",
		}),
	});
};

const afterLoad = () => {
	if ("requestIdleCallback" in window) {
		window.requestIdleCallback(runTwemoji, { timeout: 1200 });
		return;
	}
	window.setTimeout(runTwemoji, 0);
};

export const initTwemoji = () => {
	if (document.readyState === "complete") {
		afterLoad();
		return;
	}
	window.addEventListener("load", afterLoad, { once: true });
};
