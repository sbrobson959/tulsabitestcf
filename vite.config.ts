import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	optimizeDeps: {
		// MapLibre loads its Web Worker via `new Worker(new URL('./maplibre-gl-worker.mjs', import.meta.url))`.
		// Vite's dep pre-bundling rewrites that URL to a path that fails to load in dev, leaving the
		// basemap blank. Excluding it lets Vite serve the real module + worker from node_modules.
		exclude: ['maplibre-gl']
	},
	server: {
		// Listen on all interfaces so ngrok / LAN devices can reach the dev server.
		host: true,
		// ngrok uses random subdomains each run, so allow any host in dev. Without
		// this, Vite rejects requests carrying the ngrok Host header, which phones
		// see as a connection/CORS failure.
		allowedHosts: true
	}
});
