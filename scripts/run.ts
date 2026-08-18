import { runPipeline } from '../src/lib/server/pipeline/pipeline.js';

const skipGeocode = process.env.SKIP_GEOCODE === '1';
const { data, cacheUrl, dataUrl } = await runPipeline({ skipGeocode });

console.log(`\n[run] incidents written: ${data.records.length}`);
console.log(
	`[run] coverage: ${data.summary.geocodeCoveragePct}% (${data.summary.geocoded}/${data.summary.incidents})`
);
console.log(`[run] new geocodes this run: ${data.summary.newGeocodes}`);
console.log(`[run] data: ${dataUrl}`);
console.log(`[run] cache: ${cacheUrl}`);

if (data.summary.warnings.length) {
	console.log('\n── Warnings ──');
	for (const w of data.summary.warnings) console.log(w);
}
