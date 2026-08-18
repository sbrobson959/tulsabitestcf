<script lang="ts">
	import { onMount } from 'svelte';
	import * as store from '$lib/store.svelte';
	import { fieldByKey } from '$lib/fields';
	import { DENSITY_RAMP, DARK_DENSITY_RAMP, css } from '$lib/color';

	interface Props {
		rect: { x: number; y: number; w: number; h: number };
		onClose: () => void;
	}
	let { rect, onClose }: Props = $props();

	let title = $state('Animal Bites in Tulsa');
	let snapshot: string | null = $state(null);
	let failed = $state(false);

	const isDark = $derived(document.documentElement.classList.contains('dark'));
	const SCALE = 2;

	// ── Snapshot: composite the mapbox + deck canvases cropped to the rect ──
	function captureCanvases(): string {
		// The mapbox canvas and the deck overlay canvas are the only canvases in
		// the map area. Both are WebGL and kept with preserveDrawingBuffer so the
		// last rendered frame is readable.
		const mapEl = document.getElementById('bites-map-zone');
		if (!mapEl) return '';
		const canvases = [...mapEl.querySelectorAll('canvas')].filter(
			(c) => getComputedStyle(c).display !== 'none'
		);
		const out = document.createElement('canvas');
		out.width = Math.max(1, Math.round(rect.w * SCALE));
		out.height = Math.max(1, Math.round(rect.h * SCALE));
		const ctx = out.getContext('2d');
		if (!ctx) return '';
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, out.width, out.height);
		for (const c of canvases) {
			const dpr = c.width && c.clientWidth ? c.width / c.clientWidth : 1;
			try {
				ctx.drawImage(
					c,
					rect.x * dpr,
					rect.y * dpr,
					rect.w * dpr,
					rect.h * dpr,
					0,
					0,
					out.width,
					out.height
				);
			} catch {
				/* canvas too new/tainted to read yet */
			}
		}
		try {
			return out.toDataURL('image/png');
		} catch {
			return '';
		}
	}

	onMount(() => {
		const url = captureCanvases();
		if (url) snapshot = url;
		else failed = true;
	});

	// ── Legend + filter detail (same logic as Legend.svelte) ────────────
	const colorByField = $derived(store.state.colorBy ? fieldByKey(store.state.colorBy) : null);
	const scale = $derived(store.state.colorScale);

	const catItems = $derived(
		scale && scale.type === 'categorical' ? scale.order.filter((v) => scale.map.get(v)) : []
	);
	const showCategorical = $derived(
		!!colorByField &&
			colorByField.type === 'categorical' &&
			store.state.activeLayers.includes('points') &&
			scale?.type === 'categorical'
	);
	const showContinuous = $derived(
		!showCategorical &&
			!!colorByField &&
			(colorByField.type === 'numeric' || colorByField.type === 'date') &&
			store.state.activeLayers.includes('points') &&
			scale?.type === 'continuous'
	);
	const showDensity = $derived(
		!showCategorical &&
			!showContinuous &&
			(store.state.activeLayers.includes('hexbin') ||
				store.state.activeLayers.includes('grid') ||
				store.state.activeLayers.includes('heatmap'))
	);

	const filterText = $derived.by(() => {
		const parts: string[] = [];
		for (const [key, vals] of Object.entries(store.state.activeFilters)) {
			if (!vals.length) continue;
			const f = fieldByKey(key);
			if (!f) continue;
			const shown = vals.map((v) => f.valueLabels?.[v] ?? v).join(', ');
			parts.push(`${f.label}: ${shown}`);
		}
		for (const [key, range] of Object.entries(store.state.activeRanges)) {
			const f = fieldByKey(key);
			if (!f) continue;
			parts.push(`${f.label}: ${range[0]}–${range[1]}`);
		}
		return parts.length ? parts.join('   ·   ') : 'No filters applied';
	});

	// ── Compose the final screenshot (title + map + legend + filters) ───
	function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
		const words = text.split(' ');
		const lines: string[] = [];
		let line = '';
		for (const w of words) {
			const t = line ? `${line} ${w}` : w;
			if (ctx.measureText(t).width > maxWidth && line) {
				lines.push(line);
				line = w;
			} else line = t;
		}
		if (line) lines.push(line);
		return lines;
	}

	function drawLegend(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): number {
		const titleY = y + 15;
		ctx.font = '600 13px -apple-system, system-ui, "Segoe UI", Roboto, sans-serif';
		ctx.fillStyle = '#9ca3af';
		if (showCategorical) {
			ctx.fillText(colorByField?.label ?? 'Legend', x, titleY);
			let iy = titleY + 15;
			ctx.font = '400 13px -apple-system, system-ui, "Segoe UI", Roboto, sans-serif';
			for (const v of catItems.slice(0, 8)) {
				const col = scale && scale.type === 'categorical' ? scale.map.get(v) : undefined;
				if (col) {
					ctx.fillStyle = css(col);
					ctx.fillRect(x, iy - 10, 14, 14);
				}
				ctx.fillStyle = '#6b7280';
				ctx.fillText(v, x + 20, iy);
				iy += 18;
			}
			return 18 + Math.min(catItems.length, 8) * 18;
		}
		ctx.fillText(showContinuous ? (colorByField?.label ?? 'Legend') : 'Density', x, titleY);
		const ramp = isDark ? DARK_DENSITY_RAMP : DENSITY_RAMP;
		const grad = ctx.createLinearGradient(x, 0, x + w, 0);
		ramp.forEach((c, i) => grad.addColorStop(i / (ramp.length - 1), css(c)));
		ctx.fillStyle = grad;
		ctx.fillRect(x, y + 22, w, 9);
		ctx.font = '400 11px -apple-system, system-ui, "Segoe UI", Roboto, sans-serif';
		ctx.fillStyle = '#6b7280';
		if (showContinuous && scale && scale.type === 'continuous') {
			const lo = String(Math.round(scale.min));
			const hi = String(Math.round(scale.max));
			ctx.fillText(lo, x, y + 40);
			ctx.fillText(hi, x + w - ctx.measureText(hi).width, y + 40);
		} else {
			ctx.fillText('low', x, y + 40);
			ctx.fillText('high', x + w - ctx.measureText('high').width, y + 40);
		}
		return 50;
	}

	async function save() {
		if (!snapshot) return;
		const img = new Image();
		img.src = snapshot;
		await img.decode().catch(() => {});

		const S = SCALE;
		const headerH = 72;
		const pad = 12;
		const mapW = rect.w;
		const mapH = rect.h;
		const legendPx = showCategorical ? 18 + Math.min(catItems.length, 8) * 18 : 50;
		const linesPx = 15 * 4;
		const footerPx = pad + legendPx + pad + linesPx + pad;

		const W = Math.max(1, Math.round(mapW * S));
		const H = Math.round((headerH + mapH + footerPx) * S);
		const canvas = document.createElement('canvas');
		canvas.width = W;
		canvas.height = H;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// All drawing uses CSS-pixel units (fonts, positions, spacing); the scale
		// transform renders them at full resolution so text stays proportional to
		// the map instead of being drawn tiny on a 2x canvas.
		ctx.scale(S, S);

		const bg = isDark ? '#111827' : '#ffffff';
		const fg = isDark ? '#f9fafb' : '#111827';
		const sub = isDark ? '#9ca3af' : '#6b7280';
		const rule = isDark ? '#374151' : '#e5e7eb';

		ctx.fillStyle = bg;
		ctx.fillRect(0, 0, W / S, H / S);

		// Header
		ctx.fillStyle = fg;
		ctx.font = '700 22px -apple-system, system-ui, "Segoe UI", Roboto, sans-serif';
		ctx.fillText(title || 'Animal Bites in Tulsa', pad, 30);
		ctx.font = '400 13px -apple-system, system-ui, "Segoe UI", Roboto, sans-serif';
		ctx.fillStyle = sub;
		const updated = store.state.summary.lastUpdated
			? new Date(store.state.summary.lastUpdated).toLocaleDateString()
			: '—';
		ctx.fillText(
			`${store.state.filteredRecords.length.toLocaleString()} incidents shown · Updated ${updated}`,
			pad,
			50
		);
		ctx.fillStyle = rule;
		ctx.fillRect(0, headerH - 1, W / S, 1);

		// Map snapshot
		if (img.naturalWidth > 0) {
			try {
				ctx.drawImage(img, 0, headerH, mapW, mapH);
			} catch {
				/* ignore draw failures */
			}
		}

		// Footer
		const fx = pad;
		const fw = W / S - pad * 2;
		let fy = headerH + mapH + pad;
		ctx.fillStyle = fg;
		const legendH = drawLegend(ctx, fx, fy, fw);
		fy += legendH + pad;
		ctx.fillStyle = rule;
		ctx.fillRect(fx, fy - 6, fw, 1);
		fy += 9;
		ctx.font = '600 13px -apple-system, system-ui, "Segoe UI", Roboto, sans-serif';
		ctx.fillStyle = sub;
		ctx.fillText('Filters', fx, fy);
		ctx.font = '400 13px -apple-system, system-ui, "Segoe UI", Roboto, sans-serif';
		const lines = wrap(ctx, filterText, fw).slice(0, 4);
		let ty = fy + 15;
		for (const line of lines) {
			ctx.fillText(line, fx, ty);
			ty += 15;
		}

		const dataUrl = canvas.toDataURL('image/png');
		const a = document.createElement('a');
		a.href = dataUrl;
		a.download = `tulsa-animal-bites-map_${new Date().toISOString().slice(0, 10)}.png`;
		document.body.append(a);
		a.click();
		a.remove();
	}
</script>

<div class="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center">
	<button
		type="button"
		class="absolute inset-0 cursor-default border-0 bg-transparent"
		onclick={onClose}
		aria-label="Close capture preview"
	></button>

	<div
		class="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-gray-300 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 sm:rounded-2xl"
		role="dialog"
		aria-label="Capture map area"
		tabindex="-1"
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
	>
		<div
			class="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700"
		>
			<h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Capture map area</h2>
			<button
				type="button"
				class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
				onclick={onClose}
				aria-label="Close"
			>
				✕
			</button>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto p-4">
			<label
				class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300"
				for="capture-title">Title</label
			>
			<input
				id="capture-title"
				type="text"
				bind:value={title}
				class="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-red-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
				maxlength="80"
			/>

			{#if failed}
				<div
					class="rounded-lg bg-amber-50 px-3 py-4 text-sm text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
				>
					Couldn't read the live map image. Try again after the map finishes rendering.
				</div>
			{:else if snapshot}
				<div
					class="overflow-hidden rounded-xl border border-gray-300 dark:border-gray-600"
					style={`width: ${Math.min(rect.w, 528)}px; max-width: 100%;`}
				>
					<img src={snapshot} alt="Selected map area" class="block w-full" />
				</div>
				<p class="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
					The saved image adds the title above, and the legend + active filters below.
				</p>
			{:else}
				<div class="flex flex-col items-center justify-center gap-2 py-10 text-sm text-gray-400">
					<div
						class="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-red-600"
					></div>
					Capturing…
				</div>
			{/if}
		</div>

		<div
			class="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700"
		>
			<button
				type="button"
				class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
				onclick={onClose}
			>
				Cancel
			</button>
			<button
				type="button"
				class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
				onclick={save}
				disabled={!snapshot}
			>
				Save image
			</button>
		</div>
	</div>
</div>
