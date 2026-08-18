import type { RawRecord } from './types';
import { getRow } from './normalize';

function sortKey(r: RawRecord): number {
	// activity_identity is a monotonic row-level transaction id
	const id = Number.parseInt(getRow(r, 'activity_identity'), 10);
	return Number.isNaN(id) ? Number.MAX_SAFE_INTEGER : id;
}

/**
 * Collapse all status-update rows for a single bite_no into one incident row.
 * Deterministic across runs: rows are ordered by activity_identity, the first
 * row provides the incident facts, and follow-up rows are merged for result
 * codes, comments, synopses, dates, and personnel.
 */
export function dedupe(rows: RawRecord[]): RawRecord[] {
	const byBite = new Map<string, RawRecord[]>();
	for (const r of rows) {
		const key = getRow(r, 'bite_no');
		if (!key) continue;
		const list = byBite.get(key);
		if (list) list.push(r);
		else byBite.set(key, [r]);
	}

	const merged: RawRecord[] = [];
	for (const group of byBite.values()) {
		const sorted = [...group].sort((a, b) => sortKey(a) - sortKey(b));
		const first = sorted[0];
		if (sorted.length === 1) {
			merged.push({ ...first });
			continue;
		}

		const rec: RawRecord = { ...first };

		const seenResults = new Set<string>();
		const results: { code: string; qty: string; pos: number }[] = [];
		for (const r of sorted) {
			for (let pos = 1; pos <= 6; pos++) {
				const code = getRow(r, `act_result_${pos}`);
				const qty = getRow(r, `act_qty_${pos}`);
				if (code && !seenResults.has(`${code}\u0000${qty}`)) {
					seenResults.add(`${code}\u0000${qty}`);
					results.push({ code, qty, pos });
				}
			}
		}
		results.sort((a, b) => a.pos - b.pos);
		for (let i = 0; i < 3; i++) {
			const item = results[i];
			rec[`act_result_${i + 1}`] = item ? item.code : '';
			rec[`act_qty_${i + 1}`] = item ? item.qty : '';
		}

		const completeDates = sorted.map((r) => getRow(r, 'complete_date')).filter(Boolean);
		if (completeDates.length) {
			rec['complete_date'] = completeDates.reduce((a, b) => (b > a ? b : a));
		}
		const dispatchDates = sorted.map((r) => getRow(r, 'dispatch_date')).filter(Boolean);
		if (dispatchDates.length) {
			rec['dispatch_date'] = dispatchDates.reduce((a, b) => (b < a ? b : a));
		}

		const last = sorted[sorted.length - 1];
		if (getRow(last, 'officer_id')) rec['officer_id'] = getRow(last, 'officer_id');
		if (getRow(last, 'clerk_id')) rec['clerk_id'] = getRow(last, 'clerk_id');
		if (getRow(last, 'activity_identity'))
			rec['activity_identity'] = getRow(last, 'activity_identity');

		const seenComments = new Set<string>();
		const comments: string[] = [];
		for (const r of sorted) {
			const c = getRow(r, 'activity_comment');
			if (c && !seenComments.has(c)) {
				seenComments.add(c);
				comments.push(c);
			}
		}
		if (comments.length) rec['activity_comment'] = comments.join(' | ');

		const seenSynopses = new Set<string>();
		const synopses: string[] = [];
		for (const r of sorted) {
			const s = getRow(r, 'synopsis');
			if (s && !seenSynopses.has(s)) {
				seenSynopses.add(s);
				synopses.push(s);
			}
		}
		if (synopses.length) rec['synopsis'] = synopses.join('\n');

		// First valid lat/lng across the group
		for (const r of sorted) {
			const lat = getRow(r, 'latitude');
			const lng = getRow(r, 'longitude');
			if (isValidCoord(lat) && isValidCoord(lng)) {
				rec['latitude'] = lat;
				rec['longitude'] = lng;
				rec['geo_source'] = 'existing';
				break;
			}
		}

		merged.push(rec);
	}

	return merged;
}

export function isValidCoord(v: string): boolean {
	if (!v) return false;
	const n = Number.parseFloat(v);
	if (Number.isNaN(n)) return false;
	if (v === '0' || v === '.000000') return false;
	return n !== 0;
}
