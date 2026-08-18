import type { CleanedRecord, LayerMode } from '$lib/types';
import { fieldByKey, valueOf, categoricalValues } from '$lib/fields';
import type { CategoricalScale, ContinuousScale } from '$lib/color';
import { buildCategoricalScale, buildContinuousScale } from '$lib/color';

export const LAYER_ORDER: LayerMode[] = ['grid', 'hexbin', 'heatmap', 'points', 'clusters'];
export const LAYER_LABELS: Record<LayerMode, string> = {
	grid: 'Grid',
	hexbin: 'Hex Bin',
	heatmap: 'Heat Map',
	points: 'Points',
	clusters: 'Clusters'
};

export const DEFAULT_SIZES: Record<LayerMode, number> = {
	grid: 400,
	hexbin: 400,
	heatmap: 35,
	points: 7,
	clusters: 0
};

const _ = $state({
	allRecords: [] as CleanedRecord[],
	summary: {
		lastUpdated: '',
		incidents: 0,
		coveragePct: 0
	},
	activeLayers: ['hexbin'] as LayerMode[],
	layerSizes: { ...DEFAULT_SIZES } as Record<LayerMode, number>,
	basemap: 'default' as string,
	colorBy: '', // '' = density/count
	heatSensitivity: 0.8, // heatmap intensity/radius weight (0.2 - 1.5)
	layerOpacity: 0.9, // global overlay opacity (0.1 - 1)
	/** Categorical selections: field key -> allowed values. Empty = all. */
	activeFilters: {} as Record<string, string[]>,
	/** Numeric/date ranges: field key -> [min, max]. Empty = all. */
	activeRanges: {} as Record<string, [string, string]>,
	/** The live camera (kept in sync by MapView on every move). */
	currentView: null as { center: [number, number]; zoom: number } | null,
	/** Share link view waiting to be applied once the map/style is ready. */
	pendingView: null as { center: [number, number]; zoom: number } | null
});

function inRange(rec: CleanedRecord, key: string, range: [string, string]): boolean {
	const field = fieldByKey(key);
	if (!field) return true;
	const v = valueOf(rec, key);
	const [min, max] = range;
	if (field.type === 'numeric') {
		// A record with an unknown numeric value can't satisfy an active range,
		// so exclude it (e.g. filtering "17 & under" must drop unknown-age rows).
		if (v === null || v === '' || Number.isNaN(Number(v))) return false;
		return Number(v) >= Number(min) && Number(v) <= Number(max);
	}
	if (v === null || v === '') return true;
	return String(v) >= min && String(v) <= max;
}

function computeFiltered(): CleanedRecord[] {
	return _.allRecords.filter((rec) => {
		for (const [key, allowed] of Object.entries(_.activeFilters)) {
			if (allowed.length === 0) continue;
			const v = String(valueOf(rec, key) ?? 'UNKNOWN');
			if (!allowed.includes(v)) return false;
		}
		for (const [key, range] of Object.entries(_.activeRanges)) {
			if (!inRange(rec, key, range)) return false;
		}
		return true;
	});
}

function computeColorScale(): CategoricalScale | ContinuousScale | null {
	if (!_.colorBy) return null;
	const field = fieldByKey(_.colorBy);
	if (!field) return null;
	const filtered = computeFiltered();
	if (field.type === 'numeric' || field.type === 'date') {
		const values = filtered
			.map((rec) => valueOf(rec, _.colorBy))
			.filter((v): v is number => typeof v === 'number');
		if (values.length === 0) return null;
		return buildContinuousScale(Math.min(...values), Math.max(...values));
	}
	const values = categoricalValues(filtered, _.colorBy);
	return buildCategoricalScale(values, field.order, _.colorBy);
}

/**
 * Module-level reactive store. Getter properties read from internal $state and
 * are reactive anywhere they are read (templates, $derived, $effect).
 */
export const state = {
	get allRecords() {
		return _.allRecords;
	},
	get summary() {
		return _.summary;
	},
	get activeLayers() {
		return _.activeLayers;
	},
	get layerSizes() {
		return _.layerSizes;
	},
	get basemap() {
		return _.basemap;
	},
	get heatSensitivity() {
		return _.heatSensitivity;
	},
	get layerOpacity() {
		return _.layerOpacity;
	},
	get colorBy() {
		return _.colorBy;
	},
	get activeFilters() {
		return _.activeFilters;
	},
	get activeRanges() {
		return _.activeRanges;
	},
	get currentView() {
		return _.currentView;
	},
	get pendingView() {
		return _.pendingView;
	},
	get filteredRecords() {
		return computeFiltered();
	},
	get filterCount() {
		return Object.keys(_.activeFilters).length + Object.keys(_.activeRanges).length;
	},
	get colorScale() {
		return computeColorScale();
	},
	get yearRange() {
		return _.allRecords.length
			? {
					min: Math.min(..._.allRecords.map((r) => r.year ?? 9999)),
					max: Math.max(..._.allRecords.map((r) => r.year ?? 0))
				}
			: { min: 2011, max: new Date().getFullYear() };
	}
};

export function setData(records: CleanedRecord[], summary: typeof _.summary) {
	_.allRecords = records;
	_.summary = summary;
}

export function toggleLayer(mode: LayerMode) {
	if (_.activeLayers.includes(mode)) {
		_.activeLayers = _.activeLayers.filter((m) => m !== mode);
	} else {
		_.activeLayers = [..._.activeLayers, mode];
	}
}

export function setLayerSize(mode: LayerMode, value: number) {
	_.layerSizes = { ..._.layerSizes, [mode]: value };
}

export function setBasemap(id: string) {
	_.basemap = id;
}

export function setHeatSensitivity(v: number) {
	_.heatSensitivity = v;
}

export function setLayerOpacity(v: number) {
	_.layerOpacity = v;
}

export function setColorBy(key: string) {
	_.colorBy = key;
}

export function toggleFilter(key: string, value: string) {
	const current = _.activeFilters[key] ?? [];
	if (current.includes(value)) {
		_.activeFilters[key] = current.filter((v) => v !== value);
	} else {
		_.activeFilters[key] = [...current, value];
	}
}

export function clearFilter(key: string) {
	delete _.activeFilters[key];
}

export function clearAllFilters() {
	for (const k of Object.keys(_.activeFilters)) delete _.activeFilters[k];
	for (const k of Object.keys(_.activeRanges)) delete _.activeRanges[k];
}

export function setRange(key: string, min: string, max: string) {
	_.activeRanges[key] = [min, max];
}

export function setActiveLayers(layers: LayerMode[]) {
	_.activeLayers = layers;
}

export function setLayerSizes(sizes: Partial<Record<LayerMode, number>>) {
	_.layerSizes = { ..._.layerSizes, ...sizes };
}

export function setActiveFilters(filters: Record<string, string[]>) {
	_.activeFilters = filters;
}

export function setActiveRanges(ranges: Record<string, [string, string]>) {
	_.activeRanges = ranges;
}

export function setCurrentView(view: { center: [number, number]; zoom: number } | null) {
	_.currentView = view;
}

export function setPendingView(view: { center: [number, number]; zoom: number } | null) {
	_.pendingView = view;
}

export function clearPendingView() {
	_.pendingView = null;
}
