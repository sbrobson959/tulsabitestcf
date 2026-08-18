<script lang="ts">
	import * as store from '$lib/store.svelte';
	import { showWelcome } from '$lib/welcome.svelte';
</script>

<header
	class="flex h-12 shrink-0 items-center gap-3 border-b border-gray-300 bg-white px-3 pt-[env(safe-area-inset-top)] dark:border-gray-700 dark:bg-gray-900 sm:px-4"
>
	<h1 class="text-base font-semibold leading-tight text-gray-900 dark:text-gray-100">
		Animal Bites in Tulsa
	</h1>
	<div class="ml-auto flex items-center gap-2">
		{#if store.state.filterCount > 0}
			<span class="rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
				{store.state.filterCount}
			</span>
		{/if}
		<button
			type="button"
			class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
			onclick={showWelcome}
			aria-label="About this map"
			title="About this map"
		>
			?
		</button>
	</div>
</header>
