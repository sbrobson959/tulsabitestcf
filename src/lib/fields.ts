import type { CleanedRecord, FieldDef } from '$lib/types';

export const FIELDS: FieldDef[] = [
	{
		key: 'animal_type',
		label: 'Animal Type',
		type: 'categorical',
		desc: 'Dog, cat, or other',
		order: ['DOG', 'CAT', 'OTHER', 'UNKNOWN']
	},
	{
		key: 'breed_group',
		label: 'Breed Group',
		type: 'categorical',
		desc: 'Broad breed category',
		order: [
			'MASTIFF',
			'SHEPHERD',
			'SETTER/RETRIEVE',
			'TOY',
			'SPORTING',
			'HERDING',
			'TERRIER',
			'NON-SPORT',
			'HOUND',
			'WORKING',
			'UNKNOWN'
		]
	},
	{
		key: 'breed',
		label: 'Breed',
		type: 'categorical',
		desc: 'Primary breed'
	},
	{
		key: 'animal_sex',
		label: 'Animal Sex',
		type: 'categorical',
		desc: 'Sex and spay/neuter status',
		order: ['MALE', 'FEMALE', 'MALE (NEUTERED)', 'FEMALE (SPAYED)', 'UNKNOWN']
	},
	{
		key: 'animal_size',
		label: 'Animal Size',
		type: 'categorical',
		desc: 'Small, medium, or large',
		order: ['SMALL', 'MEDIUM', 'LARGE', 'UNKNOWN']
	},
	{
		key: 'severity',
		label: 'Bite Severity',
		type: 'categorical',
		desc: 'Classified severity of the bite',
		order: ['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL', 'UNKNOWN']
	},
	{
		key: 'circumstance',
		label: 'Circumstance',
		type: 'categorical',
		desc: 'Provoked or unprovoked',
		order: ['PROVOKED', 'UNPROVOKED', 'UNKNOWN']
	},
	{
		key: 'victim_relation',
		label: 'Victim Relation',
		type: 'categorical',
		desc: 'Relationship of victim to animal',
		order: ['OWNER', 'KNOWN', 'STRAY', 'FAMILY', 'NEIGHBOR', 'SP', 'SELF', 'POLICE', 'UNKNOWN']
	},
	{
		key: 'age_group',
		label: 'Victim Age Group',
		type: 'categorical',
		desc: 'Banded victim age',
		order: ['CHILD', 'TEEN', 'ADULT', 'SENIOR', 'UNKNOWN']
	},
	{
		key: 'bite_location',
		label: 'Bite Location',
		type: 'categorical',
		desc: 'Body part bitten'
	},
	{
		key: 'outcome',
		label: 'Outcome',
		type: 'categorical',
		desc: 'Primary enforcement action',
		order: [
			'MICROCHIP SCANNED',
			'IMPOUNDED',
			'REPORT TAKEN',
			'UNABLE TO LOCATE',
			'COMPLAINT',
			'UNABLE TO CONTACT',
			'GONE ON ARRIVAL',
			'NOTICE ISSUED',
			'RESOLVED',
			'CITATION ISSUED',
			'EDUCATION',
			'UNKNOWN'
		]
	},
	{
		key: 'prior_bites',
		label: 'Prior Bites',
		type: 'categorical',
		desc: 'Animal had a prior bite history',
		order: ['YES', 'NO', 'UNKNOWN']
	},
	{
		key: 'victim_age',
		label: 'Victim Age',
		type: 'numeric',
		desc: 'Exact victim age at time of incident'
	},
	{
		key: 'date',
		label: 'Date',
		type: 'date',
		desc: 'Date of the bite incident'
	},
	{
		key: 'year',
		label: 'Year',
		type: 'numeric',
		desc: 'Year of the incident'
	},
	{
		key: 'month',
		label: 'Month',
		type: 'categorical',
		desc: 'Month of the incident',
		order: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
		valueLabels: {
			'1': 'Jan',
			'2': 'Feb',
			'3': 'Mar',
			'4': 'Apr',
			'5': 'May',
			'6': 'Jun',
			'7': 'Jul',
			'8': 'Aug',
			'9': 'Sep',
			'10': 'Oct',
			'11': 'Nov',
			'12': 'Dec'
		}
	}
];

export const FILTERABLE_FIELDS = FIELDS;

export function fieldByKey(key: string): FieldDef | undefined {
	return FIELDS.find((f) => f.key === key);
}

export function valueOf(rec: CleanedRecord, key: string): string | number | null {
	return rec[key as keyof CleanedRecord] as string | number | null;
}

/** Distinct values for a categorical field, most common first. */
export function categoricalValues(records: CleanedRecord[], key: string): string[] {
	const counts = new Map<string, number>();
	for (const rec of records) {
		const v = String(valueOf(rec, key) ?? 'UNKNOWN');
		counts.set(v, (counts.get(v) ?? 0) + 1);
	}
	return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
}
