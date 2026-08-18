import { error, text } from '@sveltejs/kit';
import { runPipeline } from '$lib/server/pipeline/pipeline.js';
import { withCors, handlePreflight } from '$lib/server/cors.js';

export async function GET({ request }) {
	const secret = process.env.CRON_SECRET;
	// Require the secret to be configured AND to match. If CRON_SECRET is unset in
	// production the endpoint refuses to run rather than becoming an open trigger
	// for an expensive pipeline (download + geocode).
	if (!secret) {
		return error(503, 'CRON_SECRET is not configured');
	}
	const auth = request.headers.get('authorization');
	if (auth !== `Bearer ${secret}`) {
		return error(401, 'Unauthorized');
	}

	try {
		const { data } = await runPipeline();
		const lines = [
			`OK incidents=${data.summary.incidents}`,
			`geocoded=${data.summary.geocoded} (${data.summary.geocodeCoveragePct}%)`,
			`newGeocodes=${data.summary.newGeocodes}`,
			`lastUpdated=${data.summary.lastUpdated}`
		];
		return text(lines.join('\n'), { headers: withCors() });
	} catch (err) {
		console.error('[api/update] failed', err);
		return error(500, err instanceof Error ? err.message : 'Pipeline failed');
	}
}

/** Handle CORS preflight. */
export function OPTIONS(event: Parameters<typeof handlePreflight>[0]) {
	return handlePreflight(event) ?? new Response(null, { status: 405 });
}
