<script lang="ts">
	let { label, pct }: { label: string; pct: number } = $props();
</script>

<div class="mb-1">
	<div class="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
		<span class="truncate">{label}</span>
		<span class="font-mono text-gray-500 dark:text-gray-400">{pct}%</span>
	</div>
	<div class="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
		<div class="h-full rounded-full bg-red-500" style="width: {Math.min(100, pct)}%"></div>
	</div>
</div>
