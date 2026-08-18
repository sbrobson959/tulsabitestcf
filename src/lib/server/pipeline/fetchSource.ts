export const SOURCE_URL =
	'https://www.arcgis.com/sharing/rest/content/items/68ada06a29934a1681d2238594f803a8/data';

export async function fetchRawCsv(): Promise<string> {
	const res = await fetch(SOURCE_URL, {
		headers: { 'User-Agent': 'TCF-Bites-Pipeline/1.0' }
	});
	if (!res.ok) {
		throw new Error(`Failed to download source CSV: HTTP ${res.status}`);
	}
	const text = await res.text();
	if (!text.trim()) throw new Error('Downloaded source CSV is empty');
	return text;
}
