<script lang="ts">
	import * as store from '$lib/store.svelte';
	import { downloadCSV, downloadXLSX } from '$lib/utils/export';
	import { shareUrl } from '$lib/share';

	let { capturing, onCapture }: { capturing: boolean; onCapture: () => void } = $props();

	let open = $state(false);
	let busy = $state(false);
	let copied = $state(false);
	let btnEl: HTMLButtonElement | undefined = $state();
	let menuStyle = $state('');

	// Position the menu as `fixed` so it's measured against the viewport, not the
	// button's tiny containing block. On mobile the toolbar holds more than one
	// button, so a right-anchored 320px dropdown would run off the left edge;
	// we clamp it to stay fully on screen.
	function toggle() {
		open = !open;
		if (open) {
			requestAnimationFrame(() => {
				if (!btnEl) return;
				const r = btnEl.getBoundingClientRect();
				const w = Math.min(320, (window.innerWidth || 375) - 24);
				const top = Math.round(r.bottom + 8);
				const naturalRight = Math.round(window.innerWidth - r.right);
				const maxRight = Math.max(12, window.innerWidth - 12 - w);
				const right = Math.max(12, Math.min(naturalRight, maxRight));
				menuStyle = `top: ${top}px; right: ${right}px; width: ${w}px; max-height: ${Math.max(
					120,
					window.innerHeight - top - 12
				)}px;`;
			});
		}
	}

	const count = $derived(store.state.filteredRecords.length);
	const total = $derived(store.state.allRecords.length);
	const hasFilters = $derived(store.state.filterCount > 0);
	const url = $derived(shareUrl());

	function close() {
		open = false;
	}

	function startCapture() {
		close();
		onCapture();
	}

	async function run(kind: 'csv' | 'xlsx') {
		if (busy) return;
		busy = true;
		try {
			if (kind === 'csv') downloadCSV(store.state.filteredRecords);
			else await downloadXLSX(store.state.filteredRecords);
		} finally {
			busy = false;
			close();
		}
	}

	function copyLink() {
		const text = url;
		if (navigator.clipboard?.writeText) {
			navigator.clipboard.writeText(text).then(() => confirmCopied());
			return;
		}
		const ta = document.createElement('textarea');
		ta.value = text;
		ta.style.position = 'fixed';
		ta.style.opacity = '0';
		document.body.append(ta);
		ta.select();
		try {
			document.execCommand('copy');
			confirmCopied();
		} finally {
			ta.remove();
		}
	}

	function confirmCopied() {
		copied = true;
		setTimeout(() => (copied = false), 1600);
	}

	async function nativeShare() {
		if (!navigator.share) return;
		try {
			await navigator.share({
				title: document.title || 'Animal Bites in Tulsa',
				text: 'Check out this Animal Bites in Tulsa map view',
				url
			});
			close();
		} catch {
			/* user dismissed the sheet */
		}
	}
</script>

<div class="relative">
	<button
		bind:this={btnEl}
		type="button"
		class="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 shadow-lg transition-colors hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
		onclick={toggle}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label="Map actions"
		title="Export, share, or capture"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-5 w-5"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
			><path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M12 4v10m0-10l-3 3m3-3l3 3M5 12v5a2 2 0 002 2h10a2 2 0 002-2v-5"
			/></svg
		>
	</button>

	{#if open}
		<button
			type="button"
			class="fixed inset-0 z-40 cursor-default border-0 bg-transparent"
			onclick={close}
			aria-label="Close menu"
			tabindex="-1"
		></button>
		<div
			class="fixed z-50 overflow-y-auto rounded-xl border border-gray-300 bg-white p-2 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
			style={menuStyle}
			role="menu"
		>
			<!-- Capture -->
			<button
				type="button"
				role="menuitem"
				class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
				onclick={startCapture}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 text-gray-400"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3 9a2 2 0 012-2h1.5l1-1.5h5L15 7H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V9zM12 17a3 3 0 100-6 3 3 0 000 6z"
					/></svg
				>
				<span class="font-medium {capturing ? 'text-red-600 dark:text-red-400' : ''}">
					{capturing ? 'Cancel capture' : 'Capture map area'}
				</span>
				<span class="ml-auto text-xs text-gray-400">PNG</span>
			</button>

			<div class="my-2 border-t border-gray-200 dark:border-gray-700"></div>

			<!-- Export -->
			<p class="px-3 pb-1 pt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
				Export data
			</p>
			{#if hasFilters}
				<div
					class="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
					role="alert"
				>
					<span class="font-semibold">{count.toLocaleString()} of {total.toLocaleString()}</span
					>{' '}
					incidents are shown. Only the <span class="font-semibold">filtered</span> records will be exported.
				</div>
			{:else}
				<div
					class="mb-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-700/50 dark:text-gray-300"
				>
					Exporting all <span class="font-semibold">{count.toLocaleString()}</span> incidents.
				</div>
			{/if}
			<button
				type="button"
				role="menuitem"
				class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
				onclick={() => run('csv')}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4 text-gray-400"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 12h6m-6 4h6M9 8h6M7 4h7l4 4v12H7V4z"
					/></svg
				>
				Download CSV
				<span class="ml-auto text-xs text-gray-400">.csv</span>
			</button>
			<button
				type="button"
				role="menuitem"
				class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
				onclick={() => run('xlsx')}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4 text-gray-400"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 17v-6m3 6V9m3 8v-4M7 4h7l4 4v12H7V4z"
					/></svg
				>
				Download Excel
				<span class="ml-auto text-xs text-gray-400">.xlsx</span>
			</button>

			<div class="my-2 border-t border-gray-200 dark:border-gray-700"></div>

			<!-- Share -->
			<p class="px-3 pb-1 pt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
				Share link
			</p>
			<p class="px-3 pb-2 text-xs text-gray-500 dark:text-gray-400">
				Reproduces the current map position, layers, colors, and filters.
			</p>
			<div class="px-3">
				<input
					readonly
					value={url}
					class="mb-2 w-full rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-2 text-xs text-gray-700 outline-none focus:border-red-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
					onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
					aria-label="Share link"
				/>
				<div class="flex items-center gap-2">
					<button
						type="button"
						role="menuitem"
						class="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
						onclick={copyLink}
					>
						{copied ? 'Copied!' : 'Copy link'}
					</button>
					{#if typeof navigator !== 'undefined' && !!navigator.share}
						<button
							type="button"
							role="menuitem"
							class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
							onclick={nativeShare}
						>
							Share…
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
