import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		alias: {
			$components: './src/lib/components'
		},
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				// Mapbox/deck.gl inject inline style elements; SvelteKit's own inline
				// styles are allowed via content-hash.
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'blob:', 'https://*.mapbox.com', 'https://*.tiles.mapbox.com'],
				'font-src': ['self', 'data:', 'https://*.mapbox.com'],
				'connect-src': [
					'self',
					'https://api.mapbox.com',
					'https://events.mapbox.com',
					'https://*.tiles.mapbox.com',
					'https://api.mapbox.cn',
					'blob:'
				],
				'worker-src': ['self', 'blob:'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self']
			}
		}
	}
};

export default config;
