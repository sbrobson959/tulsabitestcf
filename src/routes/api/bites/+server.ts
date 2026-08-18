import { json } from '@sveltejs/kit';
import { readData } from '$lib/server/pipeline/storage.js';
import { withCors, handlePreflight } from '$lib/server/cors.js';

export const prerender = false;

/** Serve the processed dataset with a short cache so clients stay fresh. */
export async function GET() {
	const data = await readData();
	if (!data) {
		return json({ error: 'No data available yet' }, { status: 503, headers: withCors() });
	}
	return json(data, {
		headers: withCors({
			'cache-control': 'public, max-age=3600, stale-while-revalidate=86400'
		})
	});
}

/** Handle CORS preflight (e.g. from ngrok phone testing or dev tools). */
export function OPTIONS(event: Parameters<typeof handlePreflight>[0]) {
	return handlePreflight(event) ?? new Response(null, { status: 405 });
}
