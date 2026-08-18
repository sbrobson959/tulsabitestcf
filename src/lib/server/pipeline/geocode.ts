import type { GeoCache } from './types';

const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

export type GeoResult = { lat: number; lng: number } | null;

async function geocodeOne(address: string): Promise<GeoResult> {
	const params = new URLSearchParams({
		address,
		benchmark: 'Public_AR_Current',
		format: 'json'
	});
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const res = await fetch(`${CENSUS_URL}?${params.toString()}`, {
				signal: AbortSignal.timeout(15000)
			});
			if (res.status !== 200) {
				await sleep(1000 * (attempt + 1));
				continue;
			}
			const data = (await res.json()) as {
				result?: { addressMatches?: { coordinates?: { y?: number; x?: number } }[] };
			};
			const match = data.result?.addressMatches?.[0]?.coordinates;
			if (
				match &&
				typeof match.y === 'number' &&
				typeof match.x === 'number' &&
				match.y !== 0 &&
				match.x !== 0
			) {
				return { lat: match.y, lng: match.x };
			}
			return null;
		} catch {
			await sleep(1000 * (attempt + 1));
		}
	}
	return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Geocode only addresses not present in the cache. Returns the updated cache.
 * Rate-limited to stay well within the Census service's acceptable usage.
 */
export async function geocodeMissing(
	addresses: string[],
	cache: GeoCache,
	concurrency = 4,
	delayMs = 250
): Promise<{ cache: GeoCache; hits: number; misses: number }> {
	const needed = addresses.filter((a) => a && !cache[a]);
	const hits = addresses.length - needed.length;
	if (needed.length === 0) {
		return { cache, hits, misses: 0 };
	}

	let cursor = 0;
	const queue = async (workerId: number) => {
		while (cursor < needed.length) {
			const idx = cursor++;
			const address = needed[idx];
			const result = await geocodeOne(address);
			if (result) {
				cache[address] = { lat: result.lat, lng: result.lng, source: 'census' };
			}
			// Space out requests from all workers combined
			await sleep(delayMs * Math.max(1, concurrency));
		}
	};

	await Promise.all(
		Array.from({ length: Math.min(concurrency, needed.length) }, (_, i) => queue(i))
	);
	return { cache, hits, misses: needed.length };
}
