<script lang="ts">
	interface Props {
		label: string;
		value: number;
		min: number;
		max: number;
		step: number;
		unit?: string;
		onchange: (v: number) => void;
	}
	let { label, value, min, max, step, unit = '', onchange }: Props = $props();
</script>

<div>
	<div class="mb-1 flex items-center justify-between text-xs">
		<span class="text-gray-600 dark:text-gray-300">{label}</span>
		<span class="font-mono text-gray-500 dark:text-gray-400">{value}{unit}</span>
	</div>
	<input
		type="range"
		class="slider"
		{min}
		{max}
		{step}
		{value}
		oninput={(e) => onchange(Number(e.currentTarget.value))}
	/>
</div>
