import type { CleanedRecord } from '$lib/types';

/** Local meter-projection anchored near Tulsa so hex/grid math is planar. */
const LON0 = -95.9928;
const LAT0 = 36.154;
const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LNG = 111320 * Math.cos((LAT0 * Math.PI) / 180);

export function toMeters(lng: number, lat: number): [number, number] {
	return [(lng - LON0) * M_PER_DEG_LNG, (lat - LAT0) * M_PER_DEG_LAT];
}

export function toLngLat(x: number, y: number): [number, number] {
	return [x / M_PER_DEG_LNG + LON0, y / M_PER_DEG_LAT + LAT0];
}

export type Bin = {
	count: number;
	center: [number, number];
	polygon: [number, number][];
	points: CleanedRecord[];
};

/** Ray-casting point-in-polygon test (lng/lat coordinates). */
export function pointInPolygon(lng: number, lat: number, poly: [number, number][]): boolean {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const xi = poly[i][0];
		const yi = poly[i][1];
		const xj = poly[j][0];
		const yj = poly[j][1];
		const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

/** Return the first bin whose polygon contains the given lng/lat (or null). */
export function findBinAt(bins: Bin[], lng: number, lat: number): Bin | null {
	for (const b of bins) {
		if (pointInPolygon(lng, lat, b.polygon)) return b;
	}
	return null;
}

/** Aggregate stats for the points in a bin (hover tooltip). */
export type BinStats = {
	count: number;
	minorPct: number;
	severity: { label: string; n: number }[];
	ageGroup: { label: string; n: number }[];
	animalSize: { label: string; n: number }[];
	breed: { label: string; n: number }[];
	species: { label: string; n: number }[];
};

const SEVERITY_ORDER = ['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL', 'UNKNOWN'];
const AGE_GROUP_ORDER = ['CHILD', 'TEEN', 'ADULT', 'SENIOR', 'UNKNOWN'];
const ANIMAL_SIZE_ORDER = ['SMALL', 'MEDIUM', 'LARGE', 'UNKNOWN'];

/** Count labels, then order them (by preferred order, then by count desc). */
function distribution(
	points: CleanedRecord[],
	key: keyof CleanedRecord,
	preferred: string[]
): { label: string; n: number }[] {
	const counts = new Map<string, number>();
	let unknownKey = 'UNKNOWN';
	const UNKNOWN_LIKE = new Set(['UNKNOWN', '', 'None']);
	for (const p of points) {
		let v = String((p[key] as string | number | null) ?? 'UNKNOWN');
		if (UNKNOWN_LIKE.has(v)) {
			v = 'UNKNOWN';
			unknownKey = 'UNKNOWN';
		} else if (key === 'severity' && (v === '' || v == null)) {
			v = 'UNKNOWN';
		}
		counts.set(v, (counts.get(v) ?? 0) + 1);
	}
	return [...counts.entries()]
		.sort((a, b) => {
			const ia = preferred.indexOf(a[0]);
			const ib = preferred.indexOf(b[0]);
			if (ia !== -1 || ib !== -1) {
				// Known values first (in preferred order), unknowns last.
				return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
			}
			return b[1] - a[1];
		})
		.map(([label, n]) => ({ label, n }));
}

export function binStats(points: CleanedRecord[]): BinStats {
	const brd = new Map<string, number>();
	const spc = new Map<string, number>();
	let minors = 0;
	for (const p of points) {
		if (p.victim_age !== null && p.victim_age <= 17) minors++;
		const b = p.breed && p.breed !== 'UNKNOWN' ? p.breed : 'Unknown';
		brd.set(b, (brd.get(b) ?? 0) + 1);
		const sp = p.animal_type || 'UNKNOWN';
		spc.set(sp, (spc.get(sp) ?? 0) + 1);
	}
	const total = points.length || 1;
	const top = (m: Map<string, number>, n = 4) =>
		[...m.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, n)
			.map(([label, x]) => ({ label, n: x }));

	// Percentages for the stacked distribution bars (sum to 100, unknowns included).
	const pct = (seg: { label: string; n: number }[]) =>
		seg.map((s) => ({ ...s, n: Math.round((s.n / total) * 100) }));

	return {
		count: points.length,
		minorPct: Math.round((minors / total) * 100),
		severity: pct(distribution(points, 'severity', SEVERITY_ORDER)),
		ageGroup: pct(distribution(points, 'age_group', AGE_GROUP_ORDER)),
		animalSize: pct(distribution(points, 'animal_size', ANIMAL_SIZE_ORDER)),
		breed: top(brd),
		species: top(spc)
	};
}

const SQRT3 = Math.sqrt(3);

function hexRound(x: number, y: number, z: number): [number, number] {
	let rx = Math.round(x);
	let ry = Math.round(y);
	let rz = Math.round(z);
	const xDiff = Math.abs(rx - x);
	const yDiff = Math.abs(ry - y);
	const zDiff = Math.abs(rz - z);
	if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz;
	else if (yDiff > zDiff) ry = -rx - rz;
	else rz = -rx - ry;
	// Return the axial coordinates (q, r) = (cube x, cube z).
	return [rx, rz];
}

/**
 * Bin points into pointy-top hexagons of circumradius `radiusM` meters.
 * Returns one Bin per occupied cell with a full hexagon outline.
 */
export function hexBins(points: CleanedRecord[], radiusM: number): Bin[] {
	const size = radiusM; // circumradius == side length
	const byId = new Map<string, { q: number; r: number; count: number; pts: CleanedRecord[] }>();

	for (const p of points) {
		if (p.longitude === null || p.latitude === null) continue;
		const [px, py] = toMeters(p.longitude, p.latitude);
		// pointy-top pixel -> axial
		const x = ((SQRT3 / 3) * px - (1 / 3) * py) / size;
		const z = ((2 / 3) * py) / size;
		const [q, r] = hexRound(x, -x - z, z);
		const id = `${q},${r}`;
		const cell = byId.get(id);
		if (cell) {
			cell.count++;
			cell.pts.push(p);
		} else byId.set(id, { q, r, count: 1, pts: [p] });
	}

	const bins: Bin[] = [];
	for (const { q, r, count, pts } of byId.values()) {
		// axial -> pixel center
		const cx = size * SQRT3 * (q + r / 2);
		const cy = size * (3 / 2) * r;
		const polygon: [number, number][] = [];
		for (let i = 0; i < 6; i++) {
			const angle = (Math.PI / 3) * i - Math.PI / 6; // pointy-top vertex
			const vx = cx + size * Math.cos(angle);
			const vy = cy + size * Math.sin(angle);
			polygon.push(toLngLat(vx, vy));
		}
		bins.push({ count, center: toLngLat(cx, cy), polygon, points: pts });
	}
	return bins;
}

/** Bin points into square grid cells of `cellSizeM` meters. */
export function gridBins(points: CleanedRecord[], cellSizeM: number): Bin[] {
	const byId = new Map<string, { col: number; row: number; count: number; pts: CleanedRecord[] }>();
	for (const p of points) {
		if (p.longitude === null || p.latitude === null) continue;
		const [px, py] = toMeters(p.longitude, p.latitude);
		const col = Math.floor(px / cellSizeM);
		const row = Math.floor(py / cellSizeM);
		const id = `${col},${row}`;
		const cell = byId.get(id);
		if (cell) {
			cell.count++;
			cell.pts.push(p);
		} else byId.set(id, { col, row, count: 1, pts: [p] });
	}

	const bins: Bin[] = [];
	for (const { col, row, count, pts } of byId.values()) {
		const x0 = col * cellSizeM;
		const y0 = row * cellSizeM;
		const x1 = x0 + cellSizeM;
		const y1 = y0 + cellSizeM;
		const polygon: [number, number][] = [
			toLngLat(x0, y0),
			toLngLat(x1, y0),
			toLngLat(x1, y1),
			toLngLat(x0, y1)
		];
		bins.push({ count, center: toLngLat((x0 + x1) / 2, (y0 + y1) / 2), polygon, points: pts });
	}
	return bins;
}

/** Normalize a count to a [0,1] density value for coloring. */
export function densityScale(max: number): (count: number) => number {
	return max > 0 ? (count: number) => count / max : () => 0;
}
