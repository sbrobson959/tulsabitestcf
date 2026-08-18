<script lang="ts">
	interface Segment {
		label: string;
		n: number;
	}
	interface Props {
		title: string;
		segments: Segment[];
		colorFor: (label: string) => string;
	}
	let { title, segments, colorFor }: Props = $props();

	const visible = $derived(segments.filter((s) => s.n > 0));
	const total = $derived(visible.reduce((acc, s) => acc + s.n, 0));
	const capped = $derived(
		visible.map((s, i) => (i === visible.length - 1 ? Math.max(0, 100 - (total - s.n)) : s.n))
	);
</script>

{#if visible.length}
	<div class="mb-2">
		<p
			class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
		>
			{title}
		</p>
		<!-- Single stacked, color-coded horizontal bar -->
		<div
			class="flex h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
			role="img"
			aria-label="{title} distribution"
		>
			{#each visible as s}
				<div
					class="h-full"
					style="width: {Math.max(1, s.n)}%; background: {colorFor(s.label)}"
				></div>
			{/each}
		</div>
		<!-- Legend -->
		<ul class="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
			{#each visible as s}
				<li class="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-300">
					<span class="h-2 w-2 shrink-0 rounded-sm" style="background: {colorFor(s.label)}"></span>
					<span class="truncate">{s.label}</span>
					<span class="font-mono text-gray-400 dark:text-gray-500">{s.n}%</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}
