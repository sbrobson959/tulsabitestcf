<script lang="ts">
	import * as store from '$lib/store.svelte';
	import { basemapById } from '$lib/config';
	import { fieldByKey } from '$lib/fields';
	import { DENSITY_RAMP, DARK_DENSITY_RAMP, css, continuousRampColors } from '$lib/color';

	const colorByField = $derived(store.state.colorBy ? fieldByKey(store.state.colorBy) : null);
	const scale = $derived(store.state.colorScale);
	const active = $derived(store.state.activeLayers);
	const densityRamp = $derived(
		basemapById(store.state.basemap).uiTheme === 'dark' ? DARK_DENSITY_RAMP : DENSITY_RAMP
	);

	const hasAggregation = $derived(
		active.includes('hexbin') || active.includes('grid') || active.includes('heatmap')
	);
	const hasPoints = $derived(active.includes('points'));

	const showCategorical = $derived(
		!!colorByField &&
			colorByField.type === 'categorical' &&
			hasPoints &&
			scale?.type === 'categorical'
	);
	const showContinuous = $derived(
		!showCategorical &&
			!!colorByField &&
			(colorByField.type === 'numeric' || colorByField.type === 'date') &&
			hasPoints &&
			scale?.type === 'continuous'
	);
	const showDensity = $derived(!showCategorical && !showContinuous && hasAggregation);
</script>

{#if showCategorical}
	{@const catScale = scale?.type === 'categorical' ? scale : null}
	{@const items = catScale ? catScale.order.filter((v) => catScale.map.get(v)) : []}
	<div
		class="rounded-lg border border-gray-300 bg-white/95 px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900/95"
	>
		<p
			class="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
		>
			{colorByField!.label}
		</p>
		<ul class="space-y-1">
			{#each items as value}
				<li class="flex items-center gap-2 text-[11px] text-gray-700 dark:text-gray-300">
					<span
						class="h-2.5 w-2.5 shrink-0 rounded-sm"
						style="background: {css(catScale!.map.get(value)!)}"
					></span>
					<span class="truncate">{value}</span>
				</li>
			{/each}
		</ul>
	</div>
{:else if showContinuous}
	{@const contScale = scale?.type === 'continuous' ? scale : null}
	{@const [rampLo, rampHi] = continuousRampColors(colorByField?.key)}
	<div
		class="rounded-lg border border-gray-300 bg-white/95 px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900/95"
	>
		<p
			class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
		>
			{colorByField!.label}
		</p>
		<div
			class="h-2 w-36 rounded"
			style="background: linear-gradient(to right, {css(rampLo)}, {css(rampHi)})"
		></div>
		<div class="mt-0.5 flex justify-between font-mono text-[10px] text-gray-500 dark:text-gray-400">
			<span>{Math.round(contScale!.min)}</span><span>{Math.round(contScale!.max)}</span>
		</div>
	</div>
{:else if showDensity}
	<div
		class="rounded-lg border border-gray-300 bg-white/95 px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900/95"
	>
		<p
			class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
		>
			Density
		</p>
		<div
			class="h-2 w-36 rounded"
			style="background: linear-gradient(to right, {css(densityRamp[0])}, {css(
				densityRamp[2]
			)}, {css(densityRamp[densityRamp.length - 1])})"
		></div>
		<div class="mt-0.5 flex justify-between font-mono text-[10px] text-gray-500 dark:text-gray-400">
			<span>low</span><span>high</span>
		</div>
	</div>
{/if}
