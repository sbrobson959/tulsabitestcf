<script lang="ts">
	import * as store from '$lib/store.svelte';
	import SizeSlider from '$lib/components/SizeSlider.svelte';
	import { LAYER_ORDER, LAYER_LABELS } from '$lib/store.svelte';
	import { BASEMAPS } from '$lib/config';
	import { FIELDS, valueOf } from '$lib/fields';

	const active = $derived(store.state.activeLayers);
	const showColorBy = $derived(active.includes('points'));

	// Only allow color-by on fields with a manageable number of distinct values
	// (<= 10), so the palette stays readable instead of collapsing into similar
	// shades. Based on the actual loaded data, not the static field list.
	const colorable = $derived(
		FIELDS.filter((f) => {
			if (f.type !== 'categorical' && f.type !== 'numeric') return false;
			const unique = new Set(
				store.state.allRecords.map((r) =>
					String(valueOf(r, f.key) ?? '') === ''
						? 'UNKNOWN'
						: String(valueOf(r, f.key)).toLowerCase()
				)
			);
			return unique.size <= 10;
		})
	);

	// Color-by applies to Points only — reset if it becomes unavailable.
	$effect(() => {
		if (!showColorBy && store.state.colorBy) store.setColorBy('');
	});

	// Reset if the current color-by field is no longer colorable.
	$effect(() => {
		if (store.state.colorBy && !colorable.find((f) => f.key === store.state.colorBy)) {
			store.setColorBy('');
		}
	});
</script>

<div class="space-y-5">
	<section>
		<h2
			class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
		>
			Layers
		</h2>
		<div class="grid grid-cols-2 gap-1.5">
			{#each LAYER_ORDER as mode}
				<button
					type="button"
					class="rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors {active.includes(
						mode
					)
						? 'border-red-500 bg-red-50 font-medium text-red-700 dark:bg-red-950 dark:text-red-300'
						: 'border-gray-300 bg-white text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'}"
					onclick={() => store.toggleLayer(mode)}
				>
					{LAYER_LABELS[mode]}
				</button>
			{/each}
		</div>
	</section>

	<section>
		<h2
			class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
		>
			Map style
		</h2>
		<div class="grid grid-cols-3 gap-1.5">
			{#each BASEMAPS as bm}
				<button
					type="button"
					class="rounded-md border px-1 py-1.5 text-[11px] transition-colors {store.state
						.basemap === bm.id
						? 'border-red-500 bg-red-50 font-medium text-red-700 dark:bg-red-950 dark:text-red-300'
						: 'border-gray-300 bg-white text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'}"
					onclick={() => store.setBasemap(bm.id)}
				>
					{bm.label}
				</button>
			{/each}
		</div>
	</section>

	{#if active.includes('hexbin')}
		<SizeSlider
			label="Hex size"
			value={store.state.layerSizes.hexbin}
			min={100}
			max={800}
			step={25}
			unit="m"
			onchange={(v) => store.setLayerSize('hexbin', v)}
		/>
	{/if}

	{#if active.includes('grid')}
		<SizeSlider
			label="Grid size"
			value={store.state.layerSizes.grid}
			min={200}
			max={1500}
			step={50}
			unit="m"
			onchange={(v) => store.setLayerSize('grid', v)}
		/>
	{/if}

	{#if active.includes('points')}
		<SizeSlider
			label="Point size"
			value={store.state.layerSizes.points}
			min={4}
			max={14}
			step={1}
			unit="px"
			onchange={(v) => store.setLayerSize('points', v)}
		/>
	{/if}

	{#if active.includes('heatmap')}
		<SizeSlider
			label="Heat sensitivity"
			value={store.state.heatSensitivity}
			min={0.2}
			max={1.5}
			step={0.05}
			onchange={(v) => store.setHeatSensitivity(v)}
		/>
	{/if}

	{#if active.length > 0}
		<SizeSlider
			label="Layer opacity"
			value={store.state.layerOpacity}
			min={0.1}
			max={1}
			step={0.05}
			onchange={(v) => store.setLayerOpacity(v)}
		/>
	{/if}

	{#if showColorBy}
		<section>
			<h2
				class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
			>
				Color by
			</h2>
			<select
				class="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-red-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
				value={store.state.colorBy}
				onchange={(e) => store.setColorBy(e.currentTarget.value)}
			>
				<option value="">None (single color)</option>
				{#each colorable as field}
					<option value={field.key}>{field.label}</option>
				{/each}
			</select>
		</section>
	{/if}
</div>
