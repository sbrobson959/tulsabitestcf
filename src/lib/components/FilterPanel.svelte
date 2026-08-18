<script lang="ts">
	import * as store from '$lib/store.svelte';
	import RangeField from '$lib/components/RangeField.svelte';
	import { FILTERABLE_FIELDS, valueOf, fieldByKey } from '$lib/fields';

	interface ValueCount {
		value: string;
		count: number;
	}

	function topValues(key: string, n = 6): ValueCount[] {
		const counts = new Map<string, number>();
		for (const rec of store.state.allRecords) {
			const v = String(valueOf(rec, key) ?? 'UNKNOWN');
			counts.set(v, (counts.get(v) ?? 0) + 1);
		}
		const field = fieldByKey(key);
		const sorted = [...counts.entries()].sort((a, b) => {
			const ia = field?.order?.indexOf(a[0]) ?? -1;
			const ib = field?.order?.indexOf(b[0]) ?? -1;
			if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
			return b[1] - a[1];
		});
		// Fields with a defined order (e.g. Month = all 12) should show every
		// value; only unordered high-cardinality fields should be capped at `n`.
		const limit = field?.order?.length ? field.order.length : n;
		return sorted.slice(0, limit).map(([value, count]) => ({ value, count }));
	}

	function dateBounds(): { min: string; max: string } {
		const dates = store.state.allRecords
			.map((r) => r.date)
			.filter(Boolean)
			.sort();
		return { min: dates[0] ?? '', max: dates[dates.length - 1] ?? '' };
	}

	function isActive(key: string): boolean {
		return !!store.state.activeFilters[key]?.length || !!store.state.activeRanges[key];
	}
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between">
		<p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
			Filters
		</p>
		{#if store.state.filterCount > 0}
			<button
				type="button"
				class="text-[11px] font-medium text-red-600 underline-offset-2 hover:underline dark:text-red-400"
				onclick={store.clearAllFilters}
			>
				Clear all
			</button>
		{/if}
	</div>

	{#each FILTERABLE_FIELDS.filter((f) => f.key !== 'year') as field (field.key)}
		{@const active = isActive(field.key)}
		<div
			class="rounded-lg border border-gray-300 bg-white p-2.5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
		>
			<div class="flex items-center justify-between">
				<span
					class="text-xs font-medium text-gray-800 dark:text-gray-200 {active
						? 'text-red-600 dark:text-red-400'
						: ''}"
				>
					{field.label}
				</span>
				{#if active}
					<button
						type="button"
						class="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
						onclick={() => {
							store.clearFilter(field.key);
							if (store.state.activeRanges[field.key]) delete store.state.activeRanges[field.key];
						}}
					>
						reset
					</button>
				{/if}
			</div>

			{#if field.type === 'categorical'}
				<div class="mt-1.5 flex flex-wrap gap-1">
					{#each topValues(field.key) as item}
						{@const selected = store.state.activeFilters[field.key]?.includes(item.value) ?? false}
						{@const chipLabel = field.valueLabels?.[item.value] ?? item.value}
						<button
							type="button"
							class="rounded-full border px-2 py-0.5 text-[11px] transition-colors {selected
								? 'border-red-500 bg-red-50 font-medium text-red-700 dark:border-red-500 dark:bg-red-950 dark:text-red-300'
								: 'border-gray-300 bg-white text-gray-500 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300'}"
							onclick={() => store.toggleFilter(field.key, item.value)}
						>
							{chipLabel} <span class="opacity-50">· {item.count}</span>
						</button>
					{/each}
				</div>
			{:else if field.type === 'numeric'}
				<div class="mt-2">
					<RangeField {field} />
				</div>
			{:else if field.type === 'date'}
				<div class="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
					<input
						type="date"
						class="w-full rounded border border-gray-300 px-1.5 py-1 text-[11px] text-gray-700 outline-none focus:border-red-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
						value={store.state.activeRanges.date?.[0] ?? dateBounds().min}
						onchange={(e) => {
							const v = e.currentTarget.value;
							const max = store.state.activeRanges.date?.[1] ?? dateBounds().max;
							if (v) store.setRange('date', v, max);
						}}
					/>
					<span>→</span>
					<input
						type="date"
						class="w-full rounded border border-gray-300 px-1.5 py-1 text-[11px] text-gray-700 outline-none focus:border-red-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
						value={store.state.activeRanges.date?.[1] ?? dateBounds().max}
						onchange={(e) => {
							const v = e.currentTarget.value;
							const min = store.state.activeRanges.date?.[0] ?? dateBounds().min;
							if (v) store.setRange('date', min, v);
						}}
					/>
				</div>
			{/if}
		</div>
	{/each}
</div>
