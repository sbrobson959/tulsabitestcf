<script lang="ts">
	import { onMount } from 'svelte';
	import * as store from '$lib/store.svelte';
	import { showWelcome, hideWelcome, welcomeOpen } from '$lib/welcome.svelte';

	const STORAGE_KEY = 'tcf-bites:welcome-dismissed';

	let lastUpdatedText = $derived.by(() => {
		if (!store.state.summary.lastUpdated) return '';
		const d = new Date(store.state.summary.lastUpdated);
		return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
	});

	let dontShowAgain = $state(false);

	onMount(() => {
		try {
			dontShowAgain = localStorage.getItem(STORAGE_KEY) === '1';
			if (!dontShowAgain) showWelcome();
		} catch {
			showWelcome();
		}
	});
</script>

{#if welcomeOpen()}
	<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
		<button
			type="button"
			class="absolute inset-0 cursor-default border-0 bg-transparent"
			onclick={hideWelcome}
			aria-label="Close welcome dialog"
		></button>
		<div
			class="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
			role="dialog"
			aria-modal="true"
			aria-label="Welcome"
			tabindex="-1"
			onkeydown={(e) => {
				if (e.key === 'Escape') hideWelcome();
			}}
		>
			<div class="px-6 pb-6 pt-7">
				<!-- Logos across the top in one row (transparent PNGs on a light background) -->
				<div
					class="mb-6 flex items-center justify-between gap-x-2 rounded-xl border border-gray-200 bg-white px-3 py-3.5 sm:gap-x-6 sm:px-6 sm:py-5"
				>
					<a
						href="https://terencecrutcherfoundation.org"
						target="_blank"
						rel="noopener noreferrer"
						class="flex min-w-0 flex-1 items-center justify-center"
					>
						<img
							src="/logos/tcf.png"
							alt="Terence Crutcher Foundation"
							class="h-12 w-auto max-w-full object-contain"
						/>
					</a>
					<a
						href="https://tulsaspca.org"
						target="_blank"
						rel="noopener noreferrer"
						class="flex min-w-0 flex-1 items-center justify-center"
					>
						<img
							src="/logos/tulsa-spca.png"
							alt="Tulsa SPCA"
							class="h-14 w-auto max-w-full object-contain"
						/>
					</a>
					<a
						href="https://actiontulsa.org"
						target="_blank"
						rel="noopener noreferrer"
						class="flex min-w-0 flex-1 items-center justify-center"
					>
						<img
							src="/logos/action-tulsa.png"
							alt="ACTION Tulsa"
							class="h-9 w-auto max-w-full object-contain"
						/>
					</a>
				</div>

				<h2 class="mb-2 text-center text-3xl font-bold text-gray-900 dark:text-gray-100">
					Animal Bites in Tulsa
				</h2>
				{#if lastUpdatedText}
					<p class="mb-4 text-center text-xs text-gray-400 dark:text-gray-500">
						Last updated {lastUpdatedText}
					</p>
				{/if}

				<p class="mb-4 text-center text-sm leading-relaxed text-gray-600 dark:text-gray-300">
					An interactive map of reported animal-bite incidents in the City of Tulsa. Explore where
					bites happen, filter by severity or victim details, and see local patterns to help prevent
					them.
				</p>

				<p class="text-center text-xs leading-relaxed text-gray-400 dark:text-gray-500">
					A partnership between the <a
						href="https://terencecrutcherfoundation.org"
						target="_blank"
						rel="noopener noreferrer"
						class="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
						>Terence Crutcher Foundation</a
					>,
					<a
						href="https://tulsaspca.org"
						target="_blank"
						rel="noopener noreferrer"
						class="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
						>Tulsa SPCA</a
					>, and
					<a
						href="https://actiontulsa.org"
						target="_blank"
						rel="noopener noreferrer"
						class="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
						>ACTION Tulsa</a
					>. Data source:
					<a
						href="https://gis2-cityoftulsa.opendata.arcgis.com/datasets/68ada06a29934a1681d2238594f803a8/about"
						target="_blank"
						rel="noopener noreferrer"
						class="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
						>City of Tulsa Open Data</a
					>
					· Geocoding:
					<a
						href="https://www.census.gov/"
						target="_blank"
						rel="noopener noreferrer"
						class="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
						>U.S. Census Bureau</a
					>
					· Map data ©
					<a
						href="https://www.mapbox.com/"
						target="_blank"
						rel="noopener noreferrer"
						class="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
						>Mapbox</a
					>
					©
					<a
						href="https://www.openstreetmap.org/"
						target="_blank"
						rel="noopener noreferrer"
						class="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
						>OpenStreetMap</a
					>
				</p>
			</div>
			<div class="px-6 pb-5">
				<label
					class="flex cursor-pointer select-none items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-300"
				>
					<input
						type="checkbox"
						bind:checked={dontShowAgain}
						class="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
						onchange={(e) => {
							try {
								if (e.currentTarget.checked) localStorage.setItem(STORAGE_KEY, '1');
								else localStorage.removeItem(STORAGE_KEY);
							} catch {
								/* localStorage unavailable */
							}
						}}
					/>
					Don't show this again
				</label>
			</div>
			<div class="flex justify-center border-t border-gray-200 px-6 py-4 dark:border-gray-700">
				<button
					type="button"
					class="w-full rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700"
					onclick={hideWelcome}
				>
					Get Started
				</button>
			</div>
		</div>
	</div>
{/if}
