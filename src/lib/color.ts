export const TCF_RED: [number, number, number] = [214, 52, 52];
export const TCF_LIGHT_PINK: [number, number, number] = [255, 245, 245];
export const TCF_MEDIUM_PINK: [number, number, number] = [216, 139, 139];
export const TCF_GREEN: [number, number, number] = [164, 173, 131];
export const GRAY: [number, number, number] = [132, 118, 116];

export const UNKNOWN_COLOR: [number, number, number] = [150, 150, 150];

/** Meaningful severity ramp (matches the hover-popup distribution bars). */
const SEVERITY_HEX: Record<string, string> = {
	LIGHT: '#22c55e',
	MODERATE: '#f59e0b',
	SEVERE: '#f97316',
	CRITICAL: '#dc2626',
	UNKNOWN: '#9ca3af'
};

/**
 * Field-specific categorical colors. Higher-priority than the generic
 * golden-angle palette, so a field like Bite Severity gets meaningful colors
 * instead of arbitrary ones.
 */
export const FIELD_CATEGORICAL_COLORS: Record<string, (value: string) => string> = {
	severity: (v) => SEVERITY_HEX[v.toUpperCase()] ?? '#9ca3af'
};

/** Sequential ramp that reads well on a light basemap (clear yellow-orange → deep red). */
export const DENSITY_RAMP: [number, number, number][] = [
	[255, 229, 150],
	[255, 205, 89],
	[255, 169, 56],
	[249, 123, 43],
	[233, 57, 33],
	[150, 17, 22]
];

/** Bright, luminous ramp that pops on a dark basemap (bright yellow → hot red). */
export const DARK_DENSITY_RAMP: [number, number, number][] = [
	[255, 246, 174],
	[255, 219, 88],
	[255, 177, 44],
	[255, 122, 32],
	[255, 66, 32],
	[217, 24, 24]
];

/** Legacy ramp kept for darker basemaps. */
export const HEAT_RAMP: [number, number, number][] = [
	[255, 245, 245],
	[251, 205, 205],
	[245, 156, 156],
	[236, 102, 102],
	[224, 60, 60],
	[180, 26, 26]
];

export const CLUSTER_COLOR: [number, number, number] = [59, 130, 246];

export function rgb(
	color: [number, number, number],
	alpha = 255
): [number, number, number, number] {
	return [color[0], color[1], color[2], alpha];
}

export function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	return [
		Number.parseInt(h.slice(0, 2), 16),
		Number.parseInt(h.slice(2, 4), 16),
		Number.parseInt(h.slice(4, 6), 16)
	];
}

export function css(color: [number, number, number] | [number, number, number, number]): string {
	const [r, g, b, a] = color.length === 4 ? color : [...color, 255];
	return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}

export type CategoricalScale = {
	type: 'categorical';
	map: Map<string, [number, number, number, number]>;
	order: string[];
};

const GOLDEN_ANGLE = 137.507764;

/** Convert HSL (h in degrees, s/l in [0,100]) to an [r,g,b] tuple. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	const sv = s / 100;
	const lv = l / 100;
	const a = sv * Math.min(lv, 1 - lv);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		return lv - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
	};
	return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/**
 * Maximally-separated color for the i-th category. Stepping hue by the golden
 * angle keeps every category far apart in hue regardless of how many there are,
 * so high-cardinality fields (Breed, etc.) stay distinguishable instead of
 * drifting towards similar shades.
 */
function qualitativeColor(i: number): [number, number, number] {
	return hslToRgb((i * GOLDEN_ANGLE) % 360, 65, 50);
}

export function buildCategoricalScale(
	values: string[],
	preferredOrder?: string[],
	fieldKey?: string
): CategoricalScale {
	const unique = [...new Set(values.map((v) => (v === '' || v == null ? 'UNKNOWN' : v)))];
	const sorted = preferredOrder
		? [
				...preferredOrder.filter((v) => unique.includes(v)),
				...unique.filter((v) => !preferredOrder.includes(v))
			]
		: unique;

	const fieldColor = fieldKey ? FIELD_CATEGORICAL_COLORS[fieldKey] : undefined;
	const map = new Map<string, [number, number, number, number]>();
	sorted.forEach((v, i) => {
		if (v === 'UNKNOWN') map.set(v, rgb(UNKNOWN_COLOR, 220));
		else if (fieldColor) map.set(v, rgb(hexToRgb(fieldColor(v)), 220));
		else map.set(v, rgb(qualitativeColor(i), 220));
	});
	return { type: 'categorical', map, order: sorted };
}

export function colorForValue(
	scale: CategoricalScale,
	value: string | number | null | undefined
): [number, number, number, number] {
	const key = value === '' || value == null ? 'UNKNOWN' : String(value);
	return scale.map.get(key) ?? rgb(UNKNOWN_COLOR, 220);
}

export type ContinuousScale = {
	type: 'continuous';
	min: number;
	max: number;
};

/** Field-specific continuous ramps for numeric color-by (e.g. Victim Age). */
const FIELD_CONTINUOUS_RAMPS: Record<string, [number, number, number][]> = {
	// Blue ramp that pops on the light basemap (contrary to the near-white
	// pink end of the default red ramp, which blended into the map).
	victim_age: [
		[203, 224, 250],
		[150, 181, 233],
		[84, 121, 205],
		[42, 76, 168],
		[20, 52, 128]
	]
};

/** Default continuous ramp: TCF pink -> TCF red (kept for year, etc.). */
const DEFAULT_CONTINUOUS_RAMP: [number, number, number][] = [TCF_LIGHT_PINK, TCF_RED];

export function buildContinuousScale(min: number, max: number): ContinuousScale {
	if (min === max) max = min + 1;
	return { type: 'continuous', min, max };
}

/** The [start, end] colors a continuous field's legend should display. */
export function continuousRampColors(fieldKey?: string): [number, number, number][] {
	const ramp = fieldKey ? FIELD_CONTINUOUS_RAMPS[fieldKey] : DEFAULT_CONTINUOUS_RAMP;
	return [ramp[0], ramp[ramp.length - 1]];
}

function lerp(
	a: [number, number, number],
	b: [number, number, number],
	t: number
): [number, number, number] {
	return [
		Math.round(a[0] + (b[0] - a[0]) * t),
		Math.round(a[1] + (b[1] - a[1]) * t),
		Math.round(a[2] + (b[2] - a[2]) * t)
	];
}

export function continuousColor(
	scale: ContinuousScale,
	value: number,
	fieldKey?: string
): [number, number, number, number] {
	const t = Math.max(0, Math.min(1, (value - scale.min) / (scale.max - scale.min)));
	const ramp = fieldKey ? FIELD_CONTINUOUS_RAMPS[fieldKey] : DEFAULT_CONTINUOUS_RAMP;
	return rgb(rampColor(ramp, t), 220);
}

/** Sample a color ramp (array of [r,g,b]) at normalized position t in [0,1]. */
export function rampColor(ramp: [number, number, number][], t: number): [number, number, number] {
	const clamped = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
	const i = Math.floor(clamped);
	const j = Math.min(i + 1, ramp.length - 1);
	return lerp(ramp[i], ramp[j], clamped - i);
}

/** Format an [r,g,b] tuple as an rgba() CSS string. */
export function cssRgb(color: [number, number, number], alpha = 1): string {
	return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}
