import * as store from '$lib/store.svelte';
import { fieldByKey } from '$lib/fields';
import { basemapById } from '$lib/config';
import type { LayerMode } from '$lib/types';

/**
 * Shareable application state, serialized to a single base64url `?m=` param.
 * `applyShareState` is intentionally lenient: unknown fields/layers are ignored
 * so old or hand-edited links degrade gracefully instead of breaking the app.
 */
export interface ShareState {
	/** Format version. */
	v: 1;
	view?: { c: [number, number]; z: number };
	b?: string;
	l?: LayerMode[];
	sz?: Partial<Record<LayerMode, number>>;
	h?: number;
	o?: number;
	cb?: string;
	f?: Record<string, string[]>;
	r?: Record<string, [string, string]>;
}

export const LAYER_MODE_SET: ReadonlySet<string> = new Set([
	'grid',
	'hexbin',
	'heatmap',
	'points',
	'clusters'
]);

const SIZE_RANGES: Partial<Record<LayerMode, [number, number]>> = {
	hexbin: [100, 800],
	grid: [200, 1500],
	points: [4, 14]
};
const HEAT_RANGE: [number, number] = [0.2, 1.5];
const OPACITY_RANGE: [number, number] = [0.1, 1];

// ── Encoding ─────────────────────────────────────────────────────────
function toBase64Url(obj: unknown): string {
	const bytes = new TextEncoder().encode(JSON.stringify(obj));
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(token: string): unknown {
	const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
	const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
	const bin = atob(padded);
	const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
	return JSON.parse(new TextDecoder().decode(bytes));
}

const clamp = (v: number, [lo, hi]: [number, number]) => Math.max(lo, Math.min(hi, v));

// ── Build (current state → token) ────────────────────────────────────
function clean(record: ShareState): ShareState {
	// Omit empty/undefined keys so links stay as compact as possible.
	const out: Record<string, unknown> = { v: 1 };
	const keys = Object.keys(record) as (keyof ShareState)[];
	for (const k of keys) {
		const v = record[k];
		if (v === undefined) continue;
		if (typeof v === 'object' && v !== null && Object.keys(v).length === 0) continue;
		if (Array.isArray(v) && v.length === 0) continue;
		out[k] = v;
	}
	return out as unknown as ShareState;
}

export function buildShareState(): ShareState {
	const ranges = Object.entries(store.state.activeRanges);
	const filters = Object.entries(store.state.activeFilters);
	const view = store.state.currentView;
	return clean({
		v: 1,
		view: view ? { c: [view.center[0], view.center[1]], z: view.zoom } : undefined,
		b: store.state.basemap,
		l: [...store.state.activeLayers],
		sz: store.state.layerSizes,
		h: store.state.heatSensitivity,
		o: store.state.layerOpacity,
		cb: store.state.colorBy || undefined,
		f: filters.length ? Object.fromEntries(filters) : undefined,
		r: ranges.length ? Object.fromEntries(ranges) : undefined
	});
}

export function encodeShareState(): string {
	return toBase64Url(buildShareState());
}

/** Returns a shareable absolute URL reproducing the current state. */
export function shareUrl(): string {
	return `${location.origin}${location.pathname}?m=${encodeShareState()}`;
}

// ── Parse + apply (token → app state) ────────────────────────────────
export function parseShareState(token: string): ShareState | null {
	try {
		const raw = fromBase64Url(token);
		if (typeof raw !== 'object' || raw === null) return null;
		const s = raw as ShareState;
		if (s.v !== 1) return null;
		const out: ShareState = { v: 1 };

		if (
			s.view &&
			Array.isArray(s.view.c) &&
			s.view.c.length === 2 &&
			s.view.c.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
			typeof s.view.z === 'number' &&
			Number.isFinite(s.view.z)
		) {
			out.view = { c: [s.view.c[0], s.view.c[1]], z: Math.max(0, Math.min(24, s.view.z)) };
		}
		if (typeof s.b === 'string' && isKnownBasemap(s.b)) out.b = s.b;
		if (Array.isArray(s.l)) {
			const layers = s.l.filter((m): m is LayerMode => LAYER_MODE_SET.has(String(m)));
			if (layers.length) out.l = layers;
		}
		if (s.sz && typeof s.sz === 'object') {
			const sz: Partial<Record<LayerMode, number>> = {};
			for (const [k, val] of Object.entries(s.sz)) {
				const range = SIZE_RANGES[k as LayerMode];
				if (range && typeof val === 'number' && Number.isFinite(val)) {
					sz[k as LayerMode] = clamp(val, range);
				}
			}
			if (Object.keys(sz).length) out.sz = sz;
		}
		if (typeof s.h === 'number' && Number.isFinite(s.h)) out.h = clamp(s.h, HEAT_RANGE);
		if (typeof s.o === 'number' && Number.isFinite(s.o)) out.o = clamp(s.o, OPACITY_RANGE);
		if (typeof s.cb === 'string' && (s.cb === '' || isKnownField(s.cb))) out.cb = s.cb;
		if (s.f && typeof s.f === 'object') {
			const f: Record<string, string[]> = {};
			for (const [key, vals] of Object.entries(s.f)) {
				if (!isKnownField(key) || !Array.isArray(vals)) continue;
				const cleanVals = vals.filter((v): v is string => typeof v === 'string');
				if (cleanVals.length) f[key] = cleanVals;
			}
			if (Object.keys(f).length) out.f = f;
		}
		if (s.r && typeof s.r === 'object') {
			const r: Record<string, [string, string]> = {};
			for (const [key, range] of Object.entries(s.r)) {
				const f = fieldByKey(key);
				if (!f) continue;
				const isNum = f.type === 'numeric' || f.type === 'date';
				if (
					Array.isArray(range) &&
					range.length === 2 &&
					isNum &&
					range.every((x) => typeof x === 'string')
				) {
					r[key] = [range[0], range[1]];
				}
			}
			if (Object.keys(r).length) out.r = r;
		}
		return out;
	} catch {
		return null;
	}
}

export function applyShareState(state: ShareState) {
	if (state.b) store.setBasemap(state.b);
	if (state.l) store.setActiveLayers(state.l);
	if (state.sz) store.setLayerSizes(state.sz);
	if (typeof state.h === 'number') store.setHeatSensitivity(state.h);
	if (typeof state.o === 'number') store.setLayerOpacity(state.o);
	if (typeof state.cb === 'string') store.setColorBy(state.cb);
	if (state.f) store.setActiveFilters(state.f);
	if (state.r) store.setActiveRanges(state.r);
	if (state.view) {
		store.setPendingView({ center: state.view.c, zoom: state.view.z });
	}
}

function isKnownBasemap(id: string): boolean {
	return basemapById(id).id === id;
}

function isKnownField(key: string): boolean {
	const f = fieldByKey(key);
	return !!f && (f.type === 'categorical' || f.type === 'numeric' || f.type === 'date');
}
