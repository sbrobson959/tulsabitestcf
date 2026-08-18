<script lang="ts">
	import * as store from '$lib/store.svelte';
	import type { FieldDef } from '$lib/types';
	import { valueOf } from '$lib/fields';

	let { field }: { field: FieldDef } = $props();

	const bounds = $derived.by(() => {
		const vals = store.state.allRecords
			.map((r) => valueOf(r, field.key))
			.filter((v): v is number => typeof v === 'number');
		if (!vals.length) return { min: 0, max: 1 };
		return { min: Math.min(...vals), max: Math.max(...vals) };
	});

	const min = $derived(Number(store.state.activeRanges[field.key]?.[0] ?? bounds.min));
	const max = $derived(Number(store.state.activeRanges[field.key]?.[1] ?? bounds.max));
	const active = $derived(!!store.state.activeRanges[field.key]);

	const rangePct = (v: number) => ((v - bounds.min) / (bounds.max - bounds.min)) * 100;
	const leftPct = $derived(rangePct(min));
	const rightPct = $derived(100 - rangePct(max));

	let raf: number | undefined;

	function clamp(v: number) {
		return Math.max(bounds.min, Math.min(v, bounds.max));
	}

	function commit(minV: number, maxV: number) {
		if (raf) cancelAnimationFrame(raf);
		raf = requestAnimationFrame(() => {
			let lo = Math.round(clamp(minV));
			let hi = Math.round(clamp(maxV));
			if (lo > hi) [lo, hi] = [hi, lo];
			store.setRange(field.key, String(lo), String(hi));
		});
	}

	function onMinInput(e: Event) {
		const v = Number((e.currentTarget as HTMLInputElement).value);
		if (!Number.isNaN(v)) commit(v, max);
	}
	function onMaxInput(e: Event) {
		const v = Number((e.currentTarget as HTMLInputElement).value);
		if (!Number.isNaN(v)) commit(min, v);
	}

	// ── Pointer-driven thumb handles ───────────────────────────────────
	// Native input thumbs rely on `pointer-events` on pseudo-elements, which
	// touch browsers apply inconsistently (iOS Safari ignores it). Using plain
	// divs with pointer capture + `touch-action: none` works reliably anywhere.
	let rangeEl: HTMLElement | undefined = $state();
	let dragging: 'min' | 'max' | null = $state(null);

	function valueFromX(clientX: number) {
		if (!rangeEl) return bounds.min;
		const r = rangeEl.getBoundingClientRect();
		if (r.width <= 0) return bounds.min;
		const pct = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
		return bounds.min + pct * (bounds.max - bounds.min);
	}

	function onRangeDown(e: PointerEvent) {
		e.preventDefault();
		const target = (e.target as HTMLElement).closest('.thumb');
		let which: 'min' | 'max';
		if (target) {
			which = target.classList.contains('thumb-min') ? 'min' : 'max';
		} else {
			// Tap anywhere on the track: grab whichever thumb is nearer.
			const v = valueFromX(e.clientX);
			which = Math.abs(v - min) <= Math.abs(v - max) ? 'min' : 'max';
		}
		dragging = which;
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			/* synthetic pointers / unsupported capture: move handler still works */
		}
		onRangeMove(e);
	}

	function onRangeMove(e: PointerEvent) {
		if (!dragging) return;
		const v = valueFromX(e.clientX);
		if (dragging === 'min') commit(v, max);
		else commit(min, v);
	}

	function onRangeUp() {
		dragging = null;
	}

	function onThumbKey(e: KeyboardEvent, which: 'min' | 'max') {
		const step = Math.max(1, Math.round((bounds.max - bounds.min) / 100));
		let dir = 0;
		if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') dir = -1;
		else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') dir = 1;
		if (!dir) return;
		e.preventDefault();
		const cur = which === 'min' ? min : max;
		if (which === 'min') commit(cur + dir * step, max);
		else commit(min, cur + dir * step);
	}
</script>

<div>
	<!-- Slider row (separate vertical space from the labels below) -->
	<div
		class="dual-range"
		bind:this={rangeEl}
		role="group"
		aria-label="{field.label} range"
		onpointerdown={onRangeDown}
		onpointermove={onRangeMove}
		onpointerup={onRangeUp}
		onpointercancel={onRangeUp}
	>
		<div class="track dark:bg-gray-700"></div>
		<div class="fill" style="left: {leftPct}%; right: {rightPct}%"></div>
		<div
			class="thumb thumb-min {dragging === 'min' ? 'dragging' : ''}"
			style="left: {leftPct}%"
			role="slider"
			tabindex="0"
			aria-label="{field.label} minimum"
			aria-valuemin={bounds.min}
			aria-valuemax={bounds.max}
			aria-valuenow={Math.round(min)}
			onkeydown={(e) => onThumbKey(e, 'min')}
		></div>
		<div
			class="thumb thumb-max {dragging === 'max' ? 'dragging' : ''}"
			style="right: {rightPct}%"
			role="slider"
			tabindex="0"
			aria-label="{field.label} maximum"
			aria-valuemin={bounds.min}
			aria-valuemax={bounds.max}
			aria-valuenow={Math.round(max)}
			onkeydown={(e) => onThumbKey(e, 'max')}
		></div>
	</div>

	<!-- Editable min/max inputs + reset -->
	<div class="mt-1 flex items-center gap-1.5">
		<input
			type="number"
			class="w-16 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] text-gray-700 outline-none focus:border-red-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
			min={bounds.min}
			max={bounds.max}
			value={min}
			onchange={onMinInput}
			aria-label="{field.label} minimum value"
		/>
		<span class="text-[11px] text-gray-400">to</span>
		<input
			type="number"
			class="w-16 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] text-gray-700 outline-none focus:border-red-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
			min={bounds.min}
			max={bounds.max}
			value={max}
			onchange={onMaxInput}
			aria-label="{field.label} maximum value"
		/>
		{#if active}
			<button
				type="button"
				class="ml-auto text-[11px] text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline dark:hover:text-gray-200"
				onclick={() => delete store.state.activeRanges[field.key]}
			>
				Reset
			</button>
		{/if}
	</div>
</div>
