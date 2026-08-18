<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import Header from '$lib/components/Header.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import LayerControls from '$lib/components/LayerControls.svelte';
	import FilterPanel from '$lib/components/FilterPanel.svelte';
	import Legend from '$lib/components/Legend.svelte';
	import ActionsMenu from '$lib/components/ActionsMenu.svelte';
	import CaptureModal from '$lib/components/CaptureModal.svelte';
	import WelcomeDialog from '$lib/components/WelcomeDialog.svelte';
	import * as store from '$lib/store.svelte';
	import { basemapById } from '$lib/config';
	import { parseShareState, applyShareState } from '$lib/share';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	$effect(() => {
		if (data?.data) {
			store.setData(data.data.records, {
				lastUpdated: data.data.summary.lastUpdated,
				incidents: data.data.summary.incidents,
				coveragePct: data.data.summary.geocodeCoveragePct
			});
		}
	});

	// The UI color scheme follows the selected basemap (Light for Default,
	// dark for Dark/Satellite) — no manual toggle.
	$effect(() => {
		document.documentElement.classList.toggle(
			'dark',
			basemapById(store.state.basemap).uiTheme === 'dark'
		);
	});

	// The UI color scheme follows the selected basemap (Light for Default,
	// dark for Dark/Satellite) — no manual toggle.
	$effect(() => {
		document.documentElement.classList.toggle(
			'dark',
			basemapById(store.state.basemap).uiTheme === 'dark'
		);
	});

	// Restore a shared link (?m=...) exactly once, on mount. Applying is safe
	// before the data arrives — filters/color recompute reactively once setData
	// runs, and the camera is queued via pendingView for MapView to jumpTo.
	onMount(() => {
		const params = new URLSearchParams(location.search);
		const token = params.get('m');
		if (token) {
			const state = parseShareState(token);
			if (state) applyShareState(state);
		}
	});

	let sheetOpen = $state(false);
	let filterTitle = $derived(
		store.state.filterCount > 0 ? `Customize (${store.state.filterCount})` : 'Customize'
	);

	// ── Bottom-sheet swipe-to-dismiss ──────────────────────────────────
	// The sheet stays mounted while visible; dragging follows the finger with
	// no CSS transition (avoids jitter), and only animates on settle.
	let sheetEl: HTMLElement | undefined = $state();
	let sheetDragY = $state(0);
	let dragging = $state(false);
	let closing = $state(false);
	let dragStartY = 0;

	function onSheetPointerDown(e: PointerEvent) {
		dragging = true;
		closing = false;
		dragStartY = e.clientY;
		sheetDragY = 0;
	}

	function onSheetPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const dy = e.clientY - dragStartY;
		sheetDragY = Math.max(0, Math.min(dy, window.innerHeight * 0.8));
	}

	function onSheetPointerUp() {
		if (!dragging) return;
		dragging = false;
		if (sheetDragY > 110) {
			dismissSheet();
		} else {
			sheetDragY = 0; // snap back (CSS animates)
		}
	}

	function dismissSheet() {
		if (closing) return;
		closing = true;
		dragging = false;
		sheetDragY = 0;
	}

	function onSheetTransitionEnd() {
		if (closing) {
			closing = false;
			sheetOpen = false;
		}
	}

	function closeSheet() {
		if (closing) return;
		closing = true;
		dragging = false;
		sheetDragY = 0;
	}

	// ── Map capture: drag a rectangle to select the area to screenshot ──
	let mapAreaEl: HTMLElement | undefined = $state();
	let capturing = $state(false);
	let dragStart = $state<{ x: number; y: number } | null>(null);
	let didDrag = false;
	// liveRect tracks the rectangle while the pointer is still down (drawn on the
	// map); selectRect is only set on release and is what opens the dialog.
	let liveRect = $state<{ x: number; y: number; w: number; h: number } | null>(null);
	let selectRect = $state<{ x: number; y: number; w: number; h: number } | null>(null);

	function startCapture() {
		window.dispatchEvent(new CustomEvent('bites:clear-popover'));
		capturing = true;
	}
	function cancelCapture() {
		capturing = false;
		dragStart = null;
		liveRect = null;
		selectRect = null;
	}

	function onSelectDown(e: PointerEvent) {
		if (!mapAreaEl) return;
		const r = mapAreaEl.getBoundingClientRect();
		dragStart = { x: e.clientX - r.left, y: e.clientY - r.top };
		liveRect = null;
		selectRect = null;
		didDrag = false;
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			/* not critical */
		}
	}
	function onSelectMove(e: PointerEvent) {
		if (!dragStart || !mapAreaEl) return;
		const r = mapAreaEl.getBoundingClientRect();
		const x = Math.max(0, Math.min(e.clientX - r.left, r.width));
		const y = Math.max(0, Math.min(e.clientY - r.top, r.height));
		const dx = x - dragStart.x;
		const dy = y - dragStart.y;
		// Ignore tiny finger/mouse jitter so a simple tap never opens the dialog.
		if (Math.abs(dx) > 6 || Math.abs(dy) > 6) didDrag = true;
		liveRect = {
			x: Math.min(dragStart.x, x),
			y: Math.min(dragStart.y, y),
			w: Math.abs(dx),
			h: Math.abs(dy)
		};
	}
	function onSelectUp() {
		if (!dragStart) return;
		const r = liveRect;
		dragStart = null;
		liveRect = null;
		capturing = false;
		selectRect = didDrag && r && r.w >= 20 && r.h >= 20 ? r : null;
	}
	// Pointer cancelled (browser took over the gesture): never open the dialog —
	// treat it as "give up on this selection" instead.
	function onSelectCancel() {
		if (!dragStart) return;
		dragStart = null;
		liveRect = null;
		capturing = false;
		selectRect = null;
	}

	$effect(() => {
		if (!capturing) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') cancelCapture();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

<div class="flex h-dvh flex-col bg-gray-100 pb-[env(safe-area-inset-bottom)] dark:bg-gray-950">
	<Header />

	<main class="relative flex min-h-0 flex-1 flex-col md:flex-row">
		<div bind:this={mapAreaEl} class="relative min-h-0 flex-1 bg-white">
			<MapView />

			<!-- Top-left: "Showing…" count, then the legend directly below it -->
			<div class="pointer-events-none absolute left-3 top-3 z-10 flex flex-col items-start gap-2">
				<div
					class="rounded-lg border border-gray-300 bg-white/95 px-3 py-1.5 text-xs text-gray-600 shadow-lg dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-300"
				>
					Showing <span class="font-medium text-gray-900 dark:text-gray-100"
						>{store.state.filteredRecords.length.toLocaleString()}</span
					>
					<span class="text-gray-400 dark:text-gray-500">
						/ {store.state.allRecords.length.toLocaleString()} incidents</span
					>
				</div>
				<Legend />
			</div>

			{#if !store.state.summary.lastUpdated}
				<div
					class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-950"
				>
					<div
						class="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-300 border-t-red-600 dark:border-gray-600 dark:border-t-red-500"
					></div>
					<p class="text-sm text-gray-500 dark:text-gray-400">Loading</p>
				</div>
			{/if}

			<!-- Toolbar: Export / Capture / Filters (Filters pills are mobile-only) -->
			<div class="pointer-events-none absolute right-3 top-3 z-40 flex items-center gap-2">
				<div class="pointer-events-auto">
					<ActionsMenu
						{capturing}
						onCapture={() => (capturing ? cancelCapture() : startCapture())}
					/>
				</div>
				<button
					type="button"
					class="pointer-events-auto flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-lg transition-colors hover:border-gray-400 md:hidden dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
					onclick={() => {
						window.dispatchEvent(new CustomEvent('bites:clear-popover'));
						sheetOpen = true;
					}}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3 4h18M6 12h12M10 20h4"
						/></svg
					>
					{filterTitle}
				</button>
			</div>

			{#if capturing}
				<div
					class="absolute inset-0 z-30 touch-none select-none"
					style="touch-action: none; cursor: crosshair"
					role="group"
					aria-label="Select area to capture"
					onpointerdown={onSelectDown}
					onpointermove={onSelectMove}
					onpointerup={onSelectUp}
					onpointercancel={onSelectCancel}
				>
					<div
						class="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/75 px-4 py-1.5 text-xs text-white"
					>
						Drag on the map to select the area to capture
					</div>
					{#if liveRect}
						<div
							class="absolute border-2 border-red-600 bg-red-500/15"
							style="left: {liveRect.x}px; top: {liveRect.y}px; width: {liveRect.w}px; height: {liveRect.h}px"
						></div>
					{/if}
				</div>
			{/if}

			{#if selectRect}
				<CaptureModal rect={selectRect} onClose={() => (selectRect = null)} />
			{/if}
		</div>

		<!-- Desktop: fixed sidebar (hidden on mobile) -->
		<aside
			class="hidden shrink-0 border-l border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900 md:flex md:w-80 md:flex-col"
		>
			<div class="min-h-0 flex-1 overflow-y-auto p-4">
				<LayerControls />
				<div class="my-4 border-t border-gray-300 dark:border-gray-700"></div>
				<FilterPanel />
			</div>
		</aside>
	</main>

	<!-- Mobile: bottom sheet overlay -->
	{#if sheetOpen}
		<button
			type="button"
			transition:fade={{ duration: 150 }}
			class="fixed inset-0 z-30 cursor-default border-0 bg-black/40 md:hidden"
			onclick={() => (sheetOpen = false)}
			aria-label="Close filters"
		></button>
		<div
			bind:this={sheetEl}
			class="sheet-card fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-lg flex-col rounded-t-2xl border-t border-gray-300 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 md:hidden"
			class:dragging
			class:closing
			style={dragging ? `transform: translateY(${sheetDragY}px)` : ''}
			ontransitionend={onSheetTransitionEnd}
		>
			<div
				class="relative touch-none select-none px-4 pb-2 pt-3"
				style="touch-action: none; min-height: 44px"
				role="group"
				aria-label="Drag handle"
				onpointerdown={onSheetPointerDown}
				onpointermove={onSheetPointerMove}
				onpointerup={onSheetPointerUp}
				onpointercancel={onSheetPointerUp}
			>
				<button
					type="button"
					class="mx-auto block h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600"
					onclick={closeSheet}
					aria-label="Close panel"
				></button>
				<button
					type="button"
					class="absolute right-3 top-2 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
					onclick={closeSheet}
					aria-label="Close"
				>
					✕
				</button>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
				<LayerControls />
				<div class="my-4 border-t border-gray-300 dark:border-gray-700"></div>
				<FilterPanel />
			</div>
		</div>
	{/if}

	<footer
		class="shrink-0 hidden border-t border-gray-300 bg-white px-4 py-1.5 text-center text-[11px] text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 md:block"
	>
		Data: City of Tulsa Open Data · Geocoding: U.S. Census Bureau · Map data © Mapbox ©
		OpenStreetMap
	</footer>
</div>

<WelcomeDialog />

<style>
	@keyframes sheet-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
	.sheet-card {
		max-height: 78dvh;
		padding-bottom: env(safe-area-inset-bottom);
		animation: sheet-up 0.26s ease-out;
		transition: transform 0.26s cubic-bezier(0.32, 0, 0.67, 0);
		will-change: transform;
	}
	.sheet-card.dragging {
		transition: none;
	}
	.sheet-card.closing {
		transform: translateY(100%);
		transition: transform 0.22s ease-in;
		animation: none;
	}
</style>
