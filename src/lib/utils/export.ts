import Papa from 'papaparse';
import type { CleanedRecord } from '$lib/types';

type Col = { key: keyof CleanedRecord; label: string };

/** Columns exported for each incident, in display order. */
export const EXPORT_COLUMNS: Col[] = [
	{ key: 'bite_id', label: 'Bite ID' },
	{ key: 'date', label: 'Date' },
	{ key: 'year', label: 'Year' },
	{ key: 'month', label: 'Month' },
	{ key: 'animal_type', label: 'Animal Type' },
	{ key: 'animal_name', label: 'Animal Name' },
	{ key: 'breed', label: 'Breed' },
	{ key: 'breed_group', label: 'Breed Group' },
	{ key: 'animal_sex', label: 'Animal Sex' },
	{ key: 'animal_size', label: 'Animal Size' },
	{ key: 'victim_age', label: 'Victim Age' },
	{ key: 'age_group', label: 'Age Group' },
	{ key: 'bite_location', label: 'Bite Location' },
	{ key: 'severity', label: 'Severity' },
	{ key: 'circumstance', label: 'Circumstance' },
	{ key: 'victim_relation', label: 'Victim Relation' },
	{ key: 'address', label: 'Address' },
	{ key: 'zip', label: 'ZIP' },
	{ key: 'latitude', label: 'Latitude' },
	{ key: 'longitude', label: 'Longitude' },
	{ key: 'prior_bites', label: 'Prior Bites' },
	{ key: 'outcome', label: 'Outcome' },
	{ key: 'synopsis', label: 'Synopsis' }
];

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function filename(records: CleanedRecord[], ext: 'csv' | 'xlsx') {
	const n = records.length.toLocaleString('en-US').replace(/,/g, '-');
	return `tulsa-animal-bites_${n}-records_${today()}.${ext}`;
}

function downloadBlob(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Download the given incident records as UTF-8 CSV (with BOM for Excel). */
export function downloadCSV(records: CleanedRecord[]) {
	const data = records.map((r) => EXPORT_COLUMNS.map((c) => r[c.key]));
	const csv = Papa.unparse({ fields: EXPORT_COLUMNS.map((c) => c.label), data });
	downloadBlob(
		new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }),
		filename(records, 'csv')
	);
}

/** Download the given incident records as a real .xlsx workbook. */
export async function downloadXLSX(records: CleanedRecord[]) {
	const { default: writeXlsxFile } = await import('write-excel-file/browser');
	const columns = EXPORT_COLUMNS.map((c) => ({
		header: c.label,
		cell: (r: CleanedRecord) => ({
			value: (r[c.key] === null || r[c.key] === undefined ? '' : r[c.key]) as string | number
		})
	}));
	await writeXlsxFile(records, { columns }).toFile(filename(records, 'xlsx'));
}
