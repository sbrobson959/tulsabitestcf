<script lang="ts">
	import MiniList from '$lib/components/MiniList.svelte';
	import DistributionBar from '$lib/components/DistributionBar.svelte';
	import { onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { MapboxOverlay } from '@deck.gl/mapbox';
	import type { PickingInfo, Layer } from '@deck.gl/core';
	import { PolygonLayer, ScatterplotLayer } from '@deck.gl/layers';
	import Supercluster from 'supercluster';
	import type { ClusterFeature, PointFeature } from 'supercluster';

	import * as store from '$lib/store.svelte';
	import { basemapStyle, basemapById, MAPBOX_TOKEN } from '$lib/config';
	import { fieldByKey, valueOf } from '$lib/fields';
	import {
		colorForValue,
		continuousColor,
		rgb,
		DENSITY_RAMP,
		DARK_DENSITY_RAMP,
		CLUSTER_COLOR,
		rampColor
	} from '$lib/color';
	import { hexBins, gridBins, binStats, findBinAt, type Bin, type BinStats } from '$lib/bins';
	import type { CleanedRecord } from '$lib/types';

	mapboxgl.accessToken = MAPBOX_TOKEN;

	const INITIAL = { lng: -95.9945, lat: 36.1599, zoom: 11.5 };
	const POINT_COLOR: [number, number, number, number] = [220, 38, 38, 150];
	const SELECT_ACCENT: [number, number, number, number] = [55, 55, 65, 255];

	// ── Distribution bar colors (group-hover distributions) ────────────
	const SEVERE_COLORS: Record<string, string> = {
		LIGHT: '#22c55e',
		MODERATE: '#f59e0b',
		SEVERE: '#f97316',
		CRITICAL: '#dc2626',
		UNKNOWN: '#9ca3af'
	};
	const AGE_GROUP_COLORS: Record<string, string> = {
		CHILD: '#3b82f6',
		TEEN: '#14b8a6',
		ADULT: '#8b5cf6',
		SENIOR: '#64748b',
		UNKNOWN: '#9ca3af'
	};
	const ANIMAL_SIZE_COLORS: Record<string, string> = {
		SMALL: '#14b8a6',
		MEDIUM: '#f59e0b',
		LARGE: '#8b5cf6',
		UNKNOWN: '#9ca3af'
	};
	const sevColor = (l: string) => SEVERE_COLORS[l.trim().toUpperCase()] ?? '#9ca3af';
	const ageColor = (l: string) => AGE_GROUP_COLORS[l.trim().toUpperCase()] ?? '#9ca3af';
	const sizeColor = (l: string) => ANIMAL_SIZE_COLORS[l.trim().toUpperCase()] ?? '#9ca3af';

	let container: HTMLDivElement;
	let map: mapboxgl.Map;
	let overlay: MapboxOverlay | null = null;
	let clusterIndex: Supercluster<CleanedRecord> | null = null;

	let viewport = $state({ zoom: INITIAL.zoom, bounds: [-96.2, 35.9, -95.7, 36.45] });
	let tooltip = $state<{
		x: number;
		y: number;
		rec?: CleanedRecord;
		stats?: BinStats;
	} | null>(null);
	// The tapped feature (tap/click only, never hover) — drives the accent ring
	// so the selected point/cluster/bin stays identifiable behind the popover.
	type Selected =
		| { kind: 'rec'; bite_id: string; position: [number, number] }
		| { kind: 'cluster'; clusterId: number; position: [number, number]; count: number }
		| { kind: 'bin'; polygon: [number, number][] };
	let selected: Selected | null = $state(null);
	// True on touch/small screens — popover becomes a slide-up bottom card.
	let isMobile = $state(false);
	let tipEl: HTMLElement | undefined = $state();
	let tipDragY = $state(0);
	let tipDragStartY = 0;
	let tipDragging = $state(false);
	let tipClosing = $state(false);

	function onTipPointerDown(e: PointerEvent) {
		// Drag the whole card from the header/handle strip. We deliberately don't
		// stop on buttons so grabbing the grabber or close and swiping works; a
		// simple tap still fires their click (close). The strip has touch-action
		// none, and the body handles its own scrolling, so these never conflict.
		tipDragging = true;
		tipClosing = false;
		tipDragStartY = e.clientY;
		tipDragY = 0;
	}
	function onTipPointerMove(e: PointerEvent) {
		if (!tipDragging) return;
		tipDragY = Math.max(0, Math.min(e.clientY - tipDragStartY, window.innerHeight * 0.8));
	}
	function onTipPointerUp() {
		if (!tipDragging) return;
		tipDragging = false;
		if (tipDragY > 110) {
			tipClosing = true;
			tipDragY = 0;
		} else {
			tipDragY = 0;
		}
	}
	function onTipTransitionEnd() {
		if (tipClosing) {
			tipClosing = false;
			tooltip = null;
			selected = null;
		}
	}

	const points = $derived(
		store.state.filteredRecords.filter((r) => r.latitude !== null && r.longitude !== null)
	);

	const colorByField = $derived(store.state.colorBy ? fieldByKey(store.state.colorBy) : null);
	const colorScale = $derived(store.state.colorScale);

	const pos = (d: CleanedRecord): [number, number] => [d.longitude!, d.latitude!];

	function recordColor(rec: CleanedRecord): [number, number, number, number] {
		if (!colorByField || !colorScale) return POINT_COLOR;
		const v = valueOf(rec, colorByField.key);
		if (colorScale.type === 'categorical') return colorForValue(colorScale, v);
		if (typeof v === 'number') return continuousColor(colorScale, v, colorByField.key);
		return POINT_COLOR;
	}

	const pointScale = $derived(Math.max(0.12, Math.min(1, (viewport.zoom - 8.5) / 4.5)));
	const basePointRadius = $derived(store.state.layerSizes.points);

	const hexBinsData = $derived.by(() => hexBins(points, store.state.layerSizes.hexbin));
	const hexMax = $derived(Math.max(1, ...hexBinsData.map((b) => b.count)));
	const gridBinsData = $derived.by(() => gridBins(points, store.state.layerSizes.grid));
	const gridMax = $derived(Math.max(1, ...gridBinsData.map((b) => b.count)));

	// ── Hex/Grid as deck.gl polygon layers ──────────────────────────────
	// Rendered in the deck overlay (which is reliable on every basemap), with
	// semi-transparent fills so the underlying map (roads/labels) shows through.
	const isDarkBasemap = $derived(basemapById(store.state.basemap).uiTheme === 'dark');

	const binColor = (b: Bin, max: number, alpha: number): [number, number, number, number] => {
		const t = Math.pow(b.count / max, 0.5);
		const ramp = isDarkBasemap ? DARK_DENSITY_RAMP : DENSITY_RAMP;
		return rgb(rampColor(ramp, t), alpha);
	};

	const binLayerProps = {
		stroked: true,
		getLineColor: [255, 255, 255, 220] as [number, number, number, number],
		getLineWidth: 0.8,
		lineWidthUnits: 'pixels' as const,
		pickable: true
	};

	// Global opacity applied to every deck overlay layer (grid/hex/points/clusters).
	const layerOpacity = $derived(store.state.layerOpacity);

	const hexLayer = $derived.by(
		(): Layer | null =>
			new PolygonLayer({
				id: 'hex',
				data: hexBinsData,
				getPolygon: (d: Bin) => d.polygon,
				getFillColor: (d: Bin) => binColor(d, hexMax, isDarkBasemap ? 190 : 150),
				opacity: 1.0 * layerOpacity,
				...binLayerProps,
				visible: store.state.activeLayers.includes('hexbin')
			})
	);

	const gridLayer = $derived.by(
		(): Layer | null =>
			new PolygonLayer({
				id: 'grid',
				data: gridBinsData,
				getPolygon: (d: Bin) => d.polygon,
				getFillColor: (d: Bin) => binColor(d, gridMax, isDarkBasemap ? 190 : 150),
				opacity: 1.0 * layerOpacity,
				...binLayerProps,
				visible: store.state.activeLayers.includes('grid')
			})
	);

	const pointLayer = $derived.by(
		(): Layer | null =>
			new ScatterplotLayer({
				id: 'points',
				data: points,
				getPosition: pos,
				getFillColor: (d: CleanedRecord) => recordColor(d),
				getRadius: basePointRadius,
				radiusUnits: 'pixels',
				radiusScale: pointScale,
				stroked: true,
				getLineColor: [255, 255, 255, 255],
				getLineWidth: Math.max(0.5, pointScale),
				lineWidthUnits: 'pixels',
				opacity: 1.0 * layerOpacity,
				pickable: true,
				visible: store.state.activeLayers.includes('points'),
				updateTriggers: { getFillColor: [store.state.colorBy] }
			})
	);

	// ── Clusters (deck layers, composited above hex/grid) ───────────────
	type ClusterRecord = ClusterFeature<CleanedRecord> | PointFeature<CleanedRecord>;
	const isCluster = (f: ClusterRecord): f is ClusterFeature<CleanedRecord> =>
		Boolean((f.properties as { cluster?: boolean }).cluster);

	const clusterLayers = $derived.by((): Layer[] => {
		const visible = store.state.activeLayers.includes('clusters');
		if (!visible || !clusterIndex) return [];
		const [w, s, e, n] = viewport.bounds;
		const clusters = clusterIndex.getClusters([w, s, e, n], viewport.zoom) as ClusterRecord[];

		const aggs = clusters.filter(isCluster).map((f) => ({
			position: [f.geometry.coordinates[0], f.geometry.coordinates[1]] as [number, number],
			count: f.properties.point_count,
			clusterId: f.id
		}));
		const leaves = clusters
			.filter((f) => !isCluster(f))
			.map((f) => ({
				position: [f.geometry.coordinates[0], f.geometry.coordinates[1]] as [number, number],
				rec: f.properties as CleanedRecord
			}));

		const subLayers: Layer[] = [];
		if (leaves.length) {
			subLayers.push(
				new ScatterplotLayer({
					id: 'cluster-leaf',
					data: leaves,
					getPosition: (d: { position: [number, number] }) => d.position,
					getFillColor: (d: { rec: CleanedRecord }) => recordColor(d.rec),
					getRadius: basePointRadius,
					radiusUnits: 'pixels',
					radiusScale: pointScale,
					stroked: true,
					getLineColor: [255, 255, 255, 255],
					getLineWidth: Math.max(0.5, pointScale),
					lineWidthUnits: 'pixels',
					opacity: 1.0 * layerOpacity,
					pickable: true,
					visible
				})
			);
		}
		if (aggs.length) {
			subLayers.push(
				new ScatterplotLayer({
					id: 'cluster-agg',
					data: aggs,
					getPosition: (d: { position: [number, number] }) => d.position,
					getFillColor: rgb(CLUSTER_COLOR, 215),
					getRadius: (d: { count: number }) => Math.min(9 + Math.sqrt(d.count) * 1.8, 32),
					radiusUnits: 'pixels',
					stroked: true,
					getLineColor: [255, 255, 255, 255],
					getLineWidth: 1.5,
					lineWidthUnits: 'pixels',
					opacity: 1.0 * layerOpacity,
					pickable: true,
					visible
				})
			);
		}
		return subLayers;
	});

	// ── Selected-feature ring ───────────────────────────────────────────
	// Rendered last (on top of everything) so the highlight is never covered by
	// the feature's own fill. Transparent fill + accent stroke = a clean ring.
	const selectedRing = $derived.by((): Layer | null => {
		const sel = selected;
		if (!sel) return null;
		if (sel.kind === 'rec') {
			const rec = points.find((r) => r.bite_id === sel.bite_id);
			if (!rec || rec.longitude === null || rec.latitude === null) return null;
			return new ScatterplotLayer({
				id: 'sel-ring',
				data: [{ position: [rec.longitude, rec.latitude] as [number, number] }],
				getPosition: (d: { position: [number, number] }) => d.position,
				getFillColor: [0, 0, 0, 0],
				getLineColor: SELECT_ACCENT,
				getLineWidth: 3,
				lineWidthUnits: 'pixels',
				stroked: true,
				getRadius: basePointRadius,
				radiusUnits: 'pixels',
				radiusScale: pointScale,
				pickable: false
			});
		}
		if (sel.kind === 'cluster') {
			const radius = Math.min(9 + Math.sqrt(sel.count) * 1.8, 32) + 2.5;
			return new ScatterplotLayer({
				id: 'sel-ring',
				data: [{ position: sel.position }],
				getPosition: (d: { position: [number, number] }) => d.position,
				getFillColor: [0, 0, 0, 0],
				getLineColor: SELECT_ACCENT,
				getLineWidth: 3,
				lineWidthUnits: 'pixels',
				stroked: true,
				getRadius: radius,
				radiusUnits: 'pixels',
				pickable: false
			});
		}
		return new PolygonLayer({
			id: 'sel-ring',
			data: [{ polygon: sel.polygon }],
			getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
			getFillColor: [0, 0, 0, 0],
			getLineColor: SELECT_ACCENT,
			getLineWidth: 3,
			lineWidthUnits: 'pixels',
			stroked: true,
			pickable: false
		});
	});

	// Layers kept in a fixed order; clusters and the selection ring render last.
	const layers = $derived.by((): Layer[] => {
		const out: Layer[] = [];
		if (store.state.activeLayers.includes('grid')) out.push(gridLayer!);
		if (store.state.activeLayers.includes('hexbin')) out.push(hexLayer!);
		if (store.state.activeLayers.includes('points')) out.push(pointLayer!);
		out.push(...clusterLayers);
		const ring = selectedRing;
		if (ring) out.push(ring);
		return out.filter((l): l is Layer => l !== null);
	});

	// ── Native mapbox heatmap layer ──────────────────────────────────────
	const HEAT_SOURCE = 'bites-heat';
	const HEAT_LAYER = 'bites-heat-layer';

	function heatFeatures() {
		return {
			type: 'FeatureCollection' as const,
			features: points.map((p) => ({
				type: 'Feature' as const,
				properties: {},
				geometry: { type: 'Point' as const, coordinates: [p.longitude!, p.latitude!] }
			}))
		};
	}

	function ensureHeatLayer() {
		if (!map || map.getSource(HEAT_SOURCE)) return;
		map.addSource(HEAT_SOURCE, { type: 'geojson', data: heatFeatures() });
		map.addLayer({
			id: HEAT_LAYER,
			type: 'heatmap',
			source: HEAT_SOURCE,
			paint: {
				'heatmap-weight': 1,
				'heatmap-radius': [
					'interpolate',
					['linear'],
					['zoom'],
					8,
					14 * store.state.heatSensitivity,
					14,
					38 * store.state.heatSensitivity
				],
				'heatmap-opacity': 1.0 * store.state.layerOpacity,
				'heatmap-intensity': store.state.heatSensitivity,
				'heatmap-color': [
					'interpolate',
					['linear'],
					['heatmap-density'],
					0,
					'rgba(0,0,0,0)',
					0.05,
					'rgb(255,229,150)',
					0.2,
					'rgb(255,178,71)',
					0.4,
					'rgb(249,123,43)',
					0.6,
					'rgb(233,57,33)',
					0.8,
					'rgb(180,20,24)',
					1,
					'rgb(120,10,18)'
				]
			}
		});
		applyHeatVisibility();
		applyHeatSensitivity();
	}

	function applyHeatSensitivity() {
		if (!map || !map.getLayer(HEAT_LAYER)) return;
		const s = store.state.heatSensitivity;
		map.setPaintProperty(HEAT_LAYER, 'heatmap-radius', [
			'interpolate',
			['linear'],
			['zoom'],
			8,
			14 * s,
			14,
			38 * s
		]);
		map.setPaintProperty(HEAT_LAYER, 'heatmap-intensity', s);
	}

	function applyHeatOpacity() {
		if (!map || !map.getLayer(HEAT_LAYER)) return;
		map.setPaintProperty(HEAT_LAYER, 'heatmap-opacity', 1.0 * store.state.layerOpacity);
	}

	function updateHeatData() {
		if (map && map.getSource(HEAT_SOURCE)) {
			(map.getSource(HEAT_SOURCE) as mapboxgl.GeoJSONSource).setData(heatFeatures());
		}
	}

	function applyHeatVisibility() {
		if (!map || !map.getLayer(HEAT_LAYER)) return;
		map.setLayoutProperty(
			HEAT_LAYER,
			'visibility',
			store.state.activeLayers.includes('heatmap') ? 'visible' : 'none'
		);
	}

	// ── Tooltip ─────────────────────────────────────────────────────────
	// Resolve a picked deck object into tip content ({rec} or {stats}) or null.
	function tipForObject(obj: unknown): { rec?: CleanedRecord; stats?: BinStats } | null {
		if (!obj) return null;
		const direct = obj as CleanedRecord;
		if (direct && typeof direct.bite_id === 'string' && direct.bite_id) {
			return { rec: direct };
		}
		const leafRec = (obj as { rec?: CleanedRecord }).rec;
		if (leafRec) {
			return { rec: leafRec };
		}
		const binObj = obj as Bin | undefined;
		if (binObj && binObj.points) {
			return { stats: binStats(binObj.points) };
		}
		const agg = obj as { count?: number; clusterId?: number } | undefined;
		if (agg && typeof agg.count === 'number' && clusterIndex && typeof agg.clusterId === 'number') {
			const leaves = clusterIndex.getLeaves(
				agg.clusterId,
				1000,
				0
			) as PointFeature<CleanedRecord>[];
			const recs = leaves.map((l) => l.properties);
			return { stats: binStats(recs) };
		}
		return null;
	}

	let hoverTimer: ReturnType<typeof setTimeout> | undefined;
	// Real pointer position relative to the map container, used for hover re-picking.
	// deck's info.x/y can be wrong after a camera jump, so we track the cursor
	// ourselves against the container (same coordinate space as the canvases).
	let hoverPos = $state<{ x: number; y: number } | null>(null);

	function onHover(info: PickingInfo) {
		// deck fires a final {x:-1, y:-1} when the pointer leaves the map.
		if (info.x === -1 && info.y === -1) {
			hoverPos = null;
			if (hoverTimer) clearTimeout(hoverTimer);
			tooltip = null;
			selected = null;
			return;
		}
		if (!hoverPos) return;
		// deck's default hover picker uses zero radius, which misses small points
		// and exact polygon edges. Re-pick with a generous radius like taps do so
		// hovering a fine point or a cell reliably resolves a tooltip.
		const res = overlay?.pickObject({ x: hoverPos.x, y: hoverPos.y, radius: 12 });
		const tip = res?.object ? tipForObject(res.object) : null;
		if (tip) {
			if (hoverTimer) clearTimeout(hoverTimer);
			tooltip = { x: hoverPos.x, y: hoverPos.y, ...tip };
			selected = null;
		} else {
			// No feature under the cursor — clear on a short delay so tiny pointer
			// movement between fine points (or after a camera jump) doesn't flicker.
			if (hoverTimer) clearTimeout(hoverTimer);
			hoverTimer = setTimeout(() => {
				tooltip = null;
				selected = null;
			}, 140);
		}
	}

	function onMapPointerMove(e: PointerEvent) {
		if (!container) return;
		const r = container.getBoundingClientRect();
		hoverPos = { x: e.clientX - r.left, y: e.clientY - r.top };
	}

	function onMapPointerLeave() {
		hoverPos = null;
		if (hoverTimer) clearTimeout(hoverTimer);
		tooltip = null;
		selected = null;
	}

	// Map what was picked into a highlight identity, or null if none.
	function selectionFor(obj: unknown): Selected | null {
		if (!obj) return null;
		const direct = obj as CleanedRecord;
		if (typeof direct.bite_id === 'string' && direct.bite_id) {
			return {
				kind: 'rec',
				bite_id: direct.bite_id,
				position: [direct.longitude!, direct.latitude!]
			};
		}
		const leaf = obj as { position?: [number, number]; rec?: CleanedRecord };
		if (leaf && leaf.rec) {
			return { kind: 'rec', bite_id: leaf.rec.bite_id, position: leaf.position! };
		}
		const agg = obj as { position?: [number, number]; count?: number; clusterId?: number };
		if (typeof agg.clusterId === 'number' && agg.position && typeof agg.count === 'number') {
			return {
				kind: 'cluster',
				clusterId: agg.clusterId,
				position: agg.position,
				count: agg.count
			};
		}
		const binObj = obj as Bin;
		if (binObj && Array.isArray(binObj.points) && binObj.polygon) {
			return { kind: 'bin', polygon: binObj.polygon };
		}
		return null;
	}

	// Dismiss the popover and drop the highlight together.
	function closeTooltip() {
		tooltip = null;
		selected = null;
	}

	// Tap-to-inspect: resolve a click/tap into a popover. Uses a generous touch
	// radius for small points and falls back to point-in-polygon for hex/grid.
	// Works for both Mapbox click events and deck.gl PickingInfo (touch picks
	// reliably via the overlay's own onClick on coarse pointers).
	function resolvePick(p: {
		x?: number;
		y?: number;
		lngLat?: { lng: number; lat: number } | [number, number] | null;
		obj?: unknown;
	}) {
		const { x, y } = p;
		if (x === undefined || y === undefined) return;
		const tip = tipForObject(p.obj);
		if (tip) {
			tooltip = { x, y, ...tip };
			selected = selectionFor(p.obj);
			return;
		}
		// Fall back to hex/grid point-in-polygon for heatmap taps.
		let lng: number | null = null;
		let lat: number | null = null;
		if (p.lngLat) {
			if (Array.isArray(p.lngLat)) [lng, lat] = p.lngLat;
			else ({ lng, lat } = p.lngLat);
		}
		if (lng !== null && lat !== null) {
			let bin: Bin | null = null;
			if (store.state.activeLayers.includes('hexbin')) bin = findBinAt(hexBinsData, lng, lat);
			if (!bin && store.state.activeLayers.includes('grid'))
				bin = findBinAt(gridBinsData, lng, lat);
			if (bin) {
				tooltip = { x, y, stats: binStats(bin.points) };
				selected = { kind: 'bin', polygon: bin.polygon };
				return;
			}
		}
		// Empty map tap clears.
		closeTooltip();
	}

	// deck.gl picking callbacks — fires reliably on coarse (touch) pointers too.
	function onDeckClick(info: PickingInfo) {
		resolvePick({
			x: info.x,
			y: info.y,
			lngLat: info.coordinate as [number, number] | undefined,
			obj: info.object
		});
	}

	// Mapbox click fallback: deck's onClick covers tap-to-open on coarse pointers,
	// but on setups where it doesn't fire (e.g. a style not wired to deck), the
	// native click still resolves via manual picking. Both share resolvePick.
	function handleTap(e: mapboxgl.MapMouseEvent) {
		const res = overlay?.pickObject({ x: e.point.x, y: e.point.y, radius: 10 });
		resolvePick({ x: e.point.x, y: e.point.y, lngLat: e.lngLat, obj: res?.object });
	}

	// Clamp the popover so it stays fully on-screen on any device.
	function tipStyle(x: number, y: number) {
		const w = typeof window !== 'undefined' ? window.innerWidth : 800;
		const h = typeof window !== 'undefined' ? window.innerHeight : 600;
		const W = Math.min(320, w - 16);
		let left = x + 12;
		if (left + W > w - 8) left = Math.max(8, w - 8 - W);
		let top = y + 12;
		if (top + 260 > h - 8) top = Math.max(8, h - 8 - 260);
		return `left: ${left}px; top: ${top}px; width: ${Math.min(W, x > w - 40 ? w - 16 : W)}px;`;
	}

	// Rebuild cluster index (debounced).
	function rebuildClusters() {
		const features: PointFeature<CleanedRecord>[] = points.map((rec) => ({
			type: 'Feature',
			properties: rec,
			geometry: { type: 'Point', coordinates: [rec.longitude!, rec.latitude!] }
		}));
		clusterIndex = new Supercluster<CleanedRecord>({ radius: 55, maxZoom: 14, minZoom: 8 });
		clusterIndex.load(features);
	}

	function applyLayers() {
		const ls = layers;
		if (overlay) overlay.setProps({ layers: ls });
	}

	// Apply per-basemap Mapbox Standard config overrides (e.g. dark lighting).
	function applyBasemapConfig(id: string) {
		const def = basemapById(id);
		if (!def.config || !map || !map.setConfigProperty) return;
		for (const [k, v] of Object.entries(def.config)) {
			try {
				map.setConfigProperty('basemap', k, v);
			} catch {
				/* style may not expose config until loaded */
			}
		}
	}

	// ── (cluster count DOM labels removed) ───────────────────────────────

	$effect(() => {
		applyLayers();
	});

	let clusterTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		points;
		if (clusterTimer) clearTimeout(clusterTimer);
		clusterTimer = setTimeout(rebuildClusters, 120);
	});

	$effect(() => {
		points;
		updateHeatData();
	});

	$effect(() => {
		store.state.activeLayers;
		store.state.layerSizes;
		store.state.basemap;
		applyHeatVisibility();
	});

	$effect(() => {
		store.state.heatSensitivity;
		applyHeatSensitivity();
	});

	$effect(() => {
		store.state.layerOpacity;
		applyHeatOpacity();
	});

	$effect(() => {
		const id = store.state.basemap;
		if (!map) return;
		map.setStyle(basemapStyle(id));
		map.once('style.load', () => {
			// Re-pin Mercator: each setStyle reloads the style, which resets the
			// projection back to the style's default (globe for Standard).
			map.setProjection({ name: 'mercator' });
			ensureHeatLayer();
			updateHeatData();
			// Apply config after the new style is fully loaded so it isn't overridden.
			requestAnimationFrame(() => applyBasemapConfig(id));
		});
	});

	onMount(() => {
		const mq = window.matchMedia('(max-width: 767.98px), (pointer: coarse)');
		const updateMobile = () => (isMobile = mq.matches);
		updateMobile();
		mq.addEventListener('change', updateMobile);
		window.addEventListener('resize', updateMobile);

		map = new mapboxgl.Map({
			container,
			style: basemapStyle(store.state.basemap),
			center: [INITIAL.lng, INITIAL.lat],
			zoom: INITIAL.zoom,
			attributionControl: false,
			// Keep the WebGL back buffer after compositing so canvas reads
			// (used by the "Capture" screenshot feature) return the full frame.
			preserveDrawingBuffer: true,
			antialias: true
		});
		// @ts-expect-error expose for debugging/automation
		window.__bitesMap = map;

		overlay = new MapboxOverlay({
			layers: [],
			onHover,
			onClick: onDeckClick
			// note: deck.gl 9 keeps preserveDrawingBuffers true by default, so the
			// overlay's canvas is readable for the "Capture" screenshot feature.
		});
		map.addControl(overlay);
		// @ts-expect-error expose for debugging/automation
		window.__overlay = overlay;

		const clearPopover = () => {
			tooltip = null;
			selected = null;
		};
		window.addEventListener('bites:clear-popover', clearPopover);

		map.on('load', () => {
			map.setTerrain(null);
			// Force Mercator: Mapbox Standard styles default to the globe
			// projection, which deck.gl renders as a GlobeView with no
			// bearing/pitch — the overlay layers would stay north-up while the
			// basemap rotates underneath. Mercator keeps the overlay locked to
			// the map's camera.
			map.setProjection({ name: 'mercator' });
			applyBasemapConfig(store.state.basemap);
			ensureHeatLayer();
			updateHeatData();
			applyLayers();
		});

		map.on('move', () => {
			const c = map.getCenter();
			store.setCurrentView({ center: [c.lng, c.lat], zoom: map.getZoom() });
			const b = map.getBounds();
			if (!b) return;
			viewport.bounds = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
			viewport.zoom = map.getZoom();
		});

		// Apply a shared link's camera once the (possibly swapped) style is ready.
		const applyPendingView = () => {
			const pv = store.state.pendingView;
			if (!pv) return;
			map.jumpTo({ center: pv.center, zoom: pv.zoom });
			store.clearPendingView();
		};
		map.on('load', applyPendingView);
		map.on('style.load', applyPendingView);

		// Zoom buttons with a compass above them — clicking the compass resets the
		// map back to north (allowed now that the projection is forced to Mercator).
		map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'bottom-right');
		map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');

		// Taps open the popover via deck's onClick (reliable touch picking). Keep the
		// Mapbox click as a fallback for styles/paths where deck doesn't intercept.
		// Both funnel into resolvePick, so they resolve the same object on a tap.
		map.on('click', (e) => {
			handleTap(e);
		});

		return () => {
			window.removeEventListener('bites:clear-popover', clearPopover);
			mq.removeEventListener('change', updateMobile);
			window.removeEventListener('resize', updateMobile);
			if (hoverTimer) clearTimeout(hoverTimer);
			map.remove();
			overlay?.finalize();
		};
	});
</script>

<div
	id="bites-map-zone"
	bind:this={container}
	class="h-full w-full"
	role="application"
	aria-label="Map"
	onpointermove={onMapPointerMove}
	onpointerleave={onMapPointerLeave}
></div>
{#snippet popoverBody(tip: NonNullable<typeof tooltip>)}
	{#if tip.rec}
		<div class="mb-1 flex items-baseline justify-between gap-3">
			<span class="text-sm font-semibold text-gray-900 dark:text-gray-100"
				>Bite {tip.rec.bite_id}</span
			>
			<span class="font-mono text-xs text-gray-400">{tip.rec.date}</span>
		</div>
		<dl class="space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
			{#if tip.rec.animal_type}
				<div class="flex justify-between gap-3">
					<dt class="text-gray-400">Animal</dt>
					<dd class="flex-1 text-right">
						{tip.rec.animal_type}{#if tip.rec.breed && tip.rec.breed !== 'UNKNOWN'}
							· {tip.rec.breed}{/if}
					</dd>
				</div>
			{/if}
			{#if tip.rec.victim_age !== null}
				<div class="flex justify-between gap-3">
					<dt class="text-gray-400">Victim age</dt>
					<dd class="flex-1 text-right">{tip.rec.victim_age}</dd>
				</div>
			{/if}
			<div class="flex justify-between gap-3">
				<dt class="text-gray-400">Severity</dt>
				<dd class="flex-1 text-right">{tip.rec.severity}</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt class="text-gray-400">Body part</dt>
				<dd class="flex-1 text-right">{tip.rec.bite_location || '—'}</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt class="text-gray-400">Circumstance</dt>
				<dd class="flex-1 text-right">{tip.rec.circumstance}</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt class="text-gray-400">Address</dt>
				<dd class="flex-1 text-right">{tip.rec.address || '—'}</dd>
			</div>
			{#if tip.rec.synopsis}
				<div class="mt-1 border-t border-gray-200 pt-1 text-gray-400 dark:border-gray-700">
					{tip.rec.synopsis}
				</div>
			{/if}
		</dl>
	{:else if tip.stats}
		<div class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
			{tip.stats.count} bite{tip.stats.count === 1 ? '' : 's'} in this area
		</div>
		<div class="mb-2 text-xs text-gray-600 dark:text-gray-300">
			<span class="font-medium text-gray-800 dark:text-gray-100">{tip.stats.minorPct}%</span>{' '}
			involved a minor (17 &amp; under)
		</div>
		{#if tip.stats.severity.length || tip.stats.ageGroup.length || tip.stats.animalSize.length}
			<div class="mb-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
				<DistributionBar title="Severity" segments={tip.stats.severity} colorFor={sevColor} />
				<DistributionBar
					title="Victim age group"
					segments={tip.stats.ageGroup}
					colorFor={ageColor}
				/>
				<DistributionBar title="Animal size" segments={tip.stats.animalSize} colorFor={sizeColor} />
			</div>
		{/if}
		{#if tip.stats.breed.length}
			<div class="mb-2">
				<p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Breeds</p>
				{#each tip.stats.breed as s}
					<MiniList label={s.label} n={s.n} />
				{/each}
			</div>
		{/if}
		{#if tip.stats.species.length}
			<div>
				<p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Species</p>
				{#each tip.stats.species as s}
					<MiniList label={s.label} n={s.n} />
				{/each}
			</div>
		{/if}
	{/if}
{/snippet}

{#if tooltip && isMobile}
	<div
		bind:this={tipEl}
		class="pop-card fixed inset-x-0 bottom-0 z-30 max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t border-gray-300 bg-white text-sm shadow-2xl dark:border-gray-700 dark:bg-gray-900"
		class:tip-dragging={tipDragging}
		class:tip-closing={tipClosing}
		style={tipDragging ? `transform: translateY(${tipDragY}px)` : ''}
		role="region"
		aria-label="Selected area details"
		ontransitionend={onTipTransitionEnd}
	>
		<div
			class="tip-handle sticky top-0 z-10 flex items-center justify-between bg-white px-3 pb-1 pt-3 dark:bg-gray-900"
			style="touch-action: none; min-height: 44px"
			role="group"
			aria-label="Drag handle"
			onpointerdown={onTipPointerDown}
			onpointermove={onTipPointerMove}
			onpointerup={onTipPointerUp}
			onpointercancel={onTipPointerUp}
		>
			<button
				type="button"
				class="block h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600"
				onclick={closeTooltip}
				aria-label="Close"
			></button>
			<button
				type="button"
				class="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
				onclick={closeTooltip}
				aria-label="Close"
			>
				✕
			</button>
		</div>
		<div class="px-3 pb-[env(safe-area-inset-bottom)]">
			{@render popoverBody(tooltip!)}
		</div>
	</div>
{:else if tooltip}
	<div
		class="absolute z-20 max-h-[72dvh] overflow-y-auto rounded-lg border border-gray-300 bg-white p-3 text-sm shadow-xl dark:border-gray-700 dark:bg-gray-900"
		style={tipStyle(tooltip.x, tooltip.y)}
	>
		<button
			type="button"
			class="sticky right-0 top-0 mb-1 ml-auto flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
			onclick={closeTooltip}
			aria-label="Close"
		>
			✕
		</button>
		{@render popoverBody(tooltip!)}
	</div>
{/if}

<style>
	@keyframes pop-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
	.pop-card {
		animation: pop-up 0.26s ease-out;
		transition: transform 0.26s cubic-bezier(0.32, 0, 0.67, 0);
		will-change: transform;
	}
	.tip-handle {
		user-select: none;
		-webkit-user-select: none;
		cursor: grab;
		-webkit-tap-highlight-color: transparent;
	}
	.pop-card.tip-dragging {
		transition: none;
	}
	.pop-card.tip-closing {
		transform: translateY(100%);
		transition: transform 0.22s ease-in;
		animation: none;
	}
</style>
