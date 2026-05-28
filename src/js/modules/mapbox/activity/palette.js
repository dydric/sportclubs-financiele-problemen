import { DEFAULT_LINE_COLOR, DEFAULT_SPEED_COLORS } from './constants';

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function parseAlphaValue(value) {
	if (!value) return 1;
	const raw = String(value).trim();
	if (!raw) return 1;
	if (raw.endsWith('%')) return clamp(Number(raw.slice(0, -1)) / 100, 0, 1);
	return clamp(Number(raw), 0, 1);
}

function toSrgbChannel(value) {
	const channel = clamp(value, 0, 1);
	if (channel <= 0.0031308) return 12.92 * channel;
	return 1.055 * (channel ** (1 / 2.4)) - 0.055;
}

function oklchToRgbaString(value) {
	if (typeof value !== 'string') return value;
	const input = value.trim();
	const match = input.match(/^oklch\(\s*([0-9.]+)%\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)$/i);
	if (!match) return value;

	const lightness = clamp(Number(match[1]) / 100, 0, 1);
	const chroma = Math.max(0, Number(match[2]));
	const hueRad = (Number(match[3]) * Math.PI) / 180;
	const alpha = parseAlphaValue(match[4]);

	if (!Number.isFinite(lightness) || !Number.isFinite(chroma) || !Number.isFinite(hueRad) || !Number.isFinite(alpha)) {
		return value;
	}

	const a = chroma * Math.cos(hueRad);
	const b = chroma * Math.sin(hueRad);

	const lPrime = lightness + (0.3963377774 * a) + (0.2158037573 * b);
	const mPrime = lightness - (0.1055613458 * a) - (0.0638541728 * b);
	const sPrime = lightness - (0.0894841775 * a) - (1.291485548 * b);

	const l = lPrime ** 3;
	const m = mPrime ** 3;
	const s = sPrime ** 3;

	const rLinear = (4.0767416621 * l) - (3.3077115913 * m) + (0.2309699292 * s);
	const gLinear = (-1.2684380046 * l) + (2.6097574011 * m) - (0.3413193965 * s);
	const bLinear = (-0.0041960863 * l) - (0.7034186147 * m) + (1.707614701 * s);

	const r = Math.round(clamp(toSrgbChannel(rLinear), 0, 1) * 255);
	const g = Math.round(clamp(toSrgbChannel(gLinear), 0, 1) * 255);
	const bChannel = Math.round(clamp(toSrgbChannel(bLinear), 0, 1) * 255);

	return `rgba(${r}, ${g}, ${bChannel}, ${alpha})`;
}

function resolveTailwindThemeColorToken(colorValue) {
	if (typeof colorValue !== 'string') return colorValue;

	const raw = colorValue.trim();
	const match = raw.match(/^theme\(\s*colors\.([^)]+)\s*\)$/i);
	if (!match) return raw;

	const token = match[1].trim();
	if (!token) return raw;

	const [tokenPath] = token.split('/');
	const segments = tokenPath
		.split('.')
		.map((segment) => segment.trim())
		.filter(Boolean);

	if (!segments.length) return raw;

	let cssVarName = '';
	if (segments.length === 1) {
		cssVarName = `--color-${segments[0]}`;
	} else {
		const shade = segments[segments.length - 1];
		const base = segments.slice(0, -1).join('-');
		cssVarName = shade.toLowerCase() === 'default'
			? `--color-${base}`
			: `--color-${base}-${shade}`;
	}

	const rootStyles = getComputedStyle(document.documentElement);
	const resolved = rootStyles.getPropertyValue(cssVarName).trim();
	return resolved || raw;
}

function normalizeCssColorForMapbox(colorValue, fallback) {
	if (!colorValue) return fallback;
	const resolvedInput = oklchToRgbaString(resolveTailwindThemeColorToken(colorValue));

	const probe = document.createElement('span');
	probe.style.color = resolvedInput;
	probe.style.position = 'absolute';
	probe.style.opacity = '0';
	probe.style.pointerEvents = 'none';
	probe.style.width = '0';
	probe.style.height = '0';
	document.body.appendChild(probe);
	const normalized = getComputedStyle(probe).color;
	probe.remove();
	const normalizedOutput = oklchToRgbaString(normalized);

	if (!normalizedOutput || normalizedOutput === 'rgba(0, 0, 0, 0)' || normalizedOutput === 'transparent') {
		return fallback;
	}
	return normalizedOutput;
}

function readColorCssVariable(mapNode, variableName, fallback) {
	const value = getComputedStyle(mapNode).getPropertyValue(variableName).trim();
	if (!value) return fallback;
	return normalizeCssColorForMapbox(value, fallback);
}

export function getRoutePalette(mapNode) {
	return {
		base: mapNode.dataset.routeColor || readColorCssVariable(mapNode, '--map-route-base', DEFAULT_LINE_COLOR),
		slow: readColorCssVariable(mapNode, '--map-route-slow', DEFAULT_SPEED_COLORS.slow),
		medium: readColorCssVariable(mapNode, '--map-route-medium', DEFAULT_SPEED_COLORS.medium),
		fast: readColorCssVariable(mapNode, '--map-route-fast', DEFAULT_SPEED_COLORS.fast)
	};
}
