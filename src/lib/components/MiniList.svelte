<script lang="ts">
	let { label, n }: { label: string; n: number } = $props();
</script>

<div class="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
	<span class="truncate">{label}</span>
	<span class="font-mono text-gray-500 dark:text-gray-400">{n}</span>
</div>
