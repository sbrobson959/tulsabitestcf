import type { RawRecord } from './types';
import { getRow } from './normalize';

/**
 * Build a full street address for the Census geocoder from the incident
 * address parts. Falls back to the raw incident_location string when the
 * structured street fields are empty.
 */
export function buildAddress(r: RawRecord): string {
	const loc = getRow(r, 'incident_location');
	if (loc && loc.toUpperCase() !== 'UNKNOWN') {
		let clean = loc
			.replace(/,,/g, ',')
			.replace(/^0+(\d)/, '$1')
			.trim()
			.replace(/[ ,.]+$/, '');
		clean = clean.replace(/TULA,/g, 'TULSA,').replace(/TULA /g, 'TULSA ');
		const hasTulsa = /TULSA,?\s+OK/i.test(clean);
		const hasOkState = /,?\s+OK(?:\s+\d{5})?$/i.test(clean);
		if (!hasTulsa && !hasOkState) clean = `${clean}, Tulsa, OK`;
		return clean;
	}

	const parts = [
		getRow(r, 'act_street_no'),
		getRow(r, 'act_street_dir'),
		getRow(r, 'act_street_name'),
		getRow(r, 'act_street_type')
	].filter(Boolean);
	const street = parts.join(' ');
	const city = getRow(r, 'act_city') || 'Tulsa';
	const state = getRow(r, 'act_state') || 'OK';
	return `${street}, ${city}, ${state}`;
}
