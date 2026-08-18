import type { RequestEvent } from '@sveltejs/kit';

const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

/** Merge permissive CORS headers into an existing headers object. */
export function withCors(headers: Record<string, string> = {}): Record<string, string> {
	return { ...headers, ...CORS_HEADERS };
}

/** Handle an OPTIONS preflight for a CORS request (returns a Response or null). */
export function handlePreflight(event: RequestEvent): Response | null {
	if (event.request.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: CORS_HEADERS });
	}
	return null;
}
