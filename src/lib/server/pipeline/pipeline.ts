import Papa from 'papaparse';
import { buildAddress } from './address';
import { dedupe, isValidCoord } from './dedupe';
import { fetchRawCsv } from './fetchSource';
import { geocodeMissing } from './geocode';
import {
	ageGroup,
	getRow,
	normalizeAnimalSize,
	normalizeCircumstance,
	normalizeOutcome,
	normalizePriorBites,
	normalizeSeverity,
	normalizeSex,
	normalizeVictimAge,
	normalizeVictimRelation,
	parseDate,
	unexpectedSummary
} from './normalize';
import { readData, readGeoCache, writeData, writeGeoCache } from './storage';
import type { BitesData, CleanedRecord, GeoCache, RawRecord, RunSummary } from './types';

const EXPECTED_COLUMNS = [
	'bite_no',
	'activity_identity',
	'bite_date',
	'bite_type',
	'bite_severity',
	'bite_location',
	'bite_circumstance',
	'victim_age',
	'victim_relation',
	'animal_type',
	'animal_name',
	'sex',
	'animal_size',
	'breed_group',
	'primary_breed',
	'secondary_breed',
	'incident_location',
	'act_street_no',
	'act_street_dir',
	'act_street_name',
	'act_street_type',
	'act_city',
	'act_state',
	'act_zip_code',
	'latitude',
	'longitude',
	'prior_bites',
	'act_result_1',
	'act_result_2',
	'act_result_3',
	'act_result_4',
	'synopsis'
];

function parseCsv(text: string): RawRecord[] {
	const parsed = Papa.parse<RawRecord>(text, { header: true, skipEmptyLines: true });
	return parsed.data;
}

function validateColumns(rows: RawRecord[]): string[] {
	const warnings: string[] = [];
	if (rows.length === 0) {
		throw new Error('No rows parsed from source CSV');
	}
	const present = new Set(Object.keys(rows[0]));
	const missing = EXPECTED_COLUMNS.filter((c) => !present.has(c));
	if (missing.length) {
		warnings.push(`Missing expected columns: ${missing.join(', ')}`);
	}
	return warnings;
}

function toRecord(r: RawRecord): CleanedRecord {
	const rawLat = getRow(r, 'latitude');
	const rawLng = getRow(r, 'longitude');
	const hasGeo = isValidCoord(rawLat) && isValidCoord(rawLng);
	const victimAge = normalizeVictimAge(getRow(r, 'victim_age'));
	const date = parseDate(getRow(r, 'bite_date'));

	let outcome = normalizeOutcome(getRow(r, 'act_result_1'));
	if (outcome === 'UNKNOWN') outcome = normalizeOutcome(getRow(r, 'act_result_2'));
	if (outcome === 'UNKNOWN') outcome = normalizeOutcome(getRow(r, 'act_result_3'));

	return {
		bite_id: getRow(r, 'bite_no'),
		date: date ?? '',
		year: date ? Number(date.slice(0, 4)) : null,
		month: date ? Number(date.slice(5, 7)) : null,
		animal_type: getRow(r, 'animal_type').toUpperCase() || 'UNKNOWN',
		animal_name: getRow(r, 'animal_name'),
		breed: getRow(r, 'primary_breed') || getRow(r, 'secondary_breed') || 'UNKNOWN',
		breed_group: getRow(r, 'breed_group') || 'UNKNOWN',
		animal_sex: normalizeSex(getRow(r, 'sex')),
		animal_size: normalizeAnimalSize(getRow(r, 'animal_size')),
		victim_age: victimAge,
		age_group: ageGroup(victimAge),
		bite_location: getRow(r, 'bite_location') || 'UNKNOWN',
		severity: normalizeSeverity(getRow(r, 'bite_severity')),
		circumstance: normalizeCircumstance(getRow(r, 'bite_circumstance')),
		victim_relation: normalizeVictimRelation(getRow(r, 'victim_relation')),
		address: buildAddress(r),
		zip: getRow(r, 'act_zip_code'),
		latitude: hasGeo ? Number.parseFloat(rawLat) : null,
		longitude: hasGeo ? Number.parseFloat(rawLng) : null,
		prior_bites: normalizePriorBites(getRow(r, 'prior_bites')),
		outcome,
		synopsis: getRow(r, 'synopsis')
	};
}

export async function runPipeline(options: { skipGeocode?: boolean } = {}): Promise<{
	data: BitesData;
	cacheUrl: string;
	dataUrl: string;
}> {
	const started = Date.now();
	const warnings: string[] = [];

	const rawText = await fetchRawCsv();
	const rows = parseCsv(rawText);
	warnings.push(...validateColumns(rows));

	const incidents = dedupe(rows);
	const cleaned = incidents.map(toRecord);

	const cache = await readGeoCache();
	const needsGeocode = cleaned.filter((rec) => rec.latitude === null && rec.address);
	const addresses = [...new Set(needsGeocode.map((rec) => rec.address))];

	const {
		cache: updatedCache,
		hits,
		misses
	} = options.skipGeocode
		? { cache, hits: addresses.length, misses: 0 }
		: await geocodeMissing(addresses, cache);
	const newGeocodes = misses;

	for (const rec of cleaned) {
		if (rec.latitude !== null) continue;
		const hit = updatedCache[rec.address];
		if (hit) {
			rec.latitude = hit.lat;
			rec.longitude = hit.lng;
		}
	}

	const geocoded = cleaned.filter((rec) => rec.latitude !== null && rec.longitude !== null);

	const lastUpdated = new Date().toISOString();
	const summary: RunSummary = {
		runAt: new Date(started).toISOString(),
		lastUpdated,
		rawRows: rows.length,
		incidents: cleaned.length,
		geocoded: geocoded.length,
		newGeocodes,
		geocodeCoveragePct: cleaned.length ? Math.round((geocoded.length * 100) / cleaned.length) : 0,
		warnings: [...warnings, ...unexpectedSummary()]
	};

	const data: BitesData = { summary, records: cleaned };
	const dataUrl = await writeData(data);
	const cacheUrl = await writeGeoCache(updatedCache);

	console.log(
		`[pipeline] raw=${rows.length} incidents=${cleaned.length} geocoded=${geocoded.length} ` +
			`(coverage ${summary.geocodeCoveragePct}%) cache hits=${hits} new=${newGeocodes}`
	);

	return { data, cacheUrl, dataUrl };
}

/** Small helper for the initial local backfill: returns cached value count. */
export async function cacheStats(): Promise<number> {
	const cache = await readGeoCache();
	return Object.keys(cache).length;
}
