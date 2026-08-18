import type { RawRecord } from './types';

const unexpected = new Map<string, Map<string, number>>();

export function logUnexpected(category: string, value: string) {
	const key = value.trim().toUpperCase().slice(0, 80);
	if (!key) return;
	if (!unexpected.has(category)) unexpected.set(category, new Map());
	const counts = unexpected.get(category)!;
	counts.set(key, (counts.get(key) ?? 0) + 1);
}

export function unexpectedSummary(): string[] {
	const lines: string[] = [];
	for (const [category, counts] of [...unexpected.entries()].sort((a, b) =>
		a[0].localeCompare(b[0])
	)) {
		const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
		const top = sorted
			.slice(0, 8)
			.map(([v, c]) => `    [${c}] ${v.length > 60 ? v.slice(0, 57) + '...' : v}`)
			.join('\n');
		lines.push(`  ${category}:\n${top}`);
		if (sorted.length > 8) lines.push(`    ... and ${sorted.length - 8} more`);
	}
	return lines;
}

const CIRCUMSTANCE_MAP: Record<string, string> = {
	PROVOKED: 'PROVOKED',
	UNPROVOKED: 'UNPROVOKED',
	UNKNOWN: 'UNKNOWN',
	PROVOKOED: 'PROVOKED',
	PROVOCATED: 'PROVOKED',
	PRONVOKED: 'PROVOKED',
	PROVOJKED: 'PROVOKED',
	PROVOKRD: 'PROVOKED',
	POVOKED: 'PROVOKED',
	PTOVOKED: 'PROVOKED',
	UNRPOVOKED: 'UNPROVOKED',
	UNPRO: 'UNPROVOKED',
	UNPROOVKED: 'UNPROVOKED',
	UNPOVKED: 'UNPROVOKED',
	UNPROVOKD: 'UNPROVOKED',
	UPROVOKED: 'UNPROVOKED',
	UNPROVOOKE: 'UNPROVOKED',
	UNPROVOKOE: 'UNPROVOKED',
	UNROVOKED: 'UNPROVOKED',
	UNPROVKED: 'UNPROVOKED'
};

const NON_CIRCUMSTANCE_VALUES = new Set(['YES', '3', '(R) CALF', 'MINOR', 'KNOWN', 'AGING DOG']);

export function normalizeCircumstance(val: string): string {
	const v = val.trim().toUpperCase();
	if (!v || NON_CIRCUMSTANCE_VALUES.has(v)) return 'UNKNOWN';
	const result = CIRCUMSTANCE_MAP[v];
	if (!result) {
		logUnexpected('bite_circumstance', val);
		return v;
	}
	return result;
}

const VICTIM_RELATION_MAP: Record<string, string> = {
	OWNER: 'OWNER',
	OWMER: 'OWNER',
	OWNED: 'OWNER',
	KNOWN: 'KNOWN',
	KOWN: 'KNOWN',
	NKNOWN: 'KNOWN',
	SP: 'SP',
	SELF: 'SELF',
	NONE: 'NONE',
	TPD: 'POLICE',
	POLICE: 'POLICE',
	NEIGHBOR: 'NEIGHBOR',
	FAMILY: 'FAMILY',
	FOSTER: 'FOSTER',
	CLIENT: 'CLIENT',
	FEEDS: 'FEEDS',
	STRAY: 'STRAY',
	SERVICE: 'SERVICE',
	RESIDENT: 'RESIDENT'
};

const VICTIM_RELATION_UNKNOWN_VARIANTS = new Set([
	'UNKNOWN',
	'UNKOWN',
	'UNNOWN',
	'UNONOWN',
	'UNKNIOWN',
	'ONKOWN',
	'UNKONWN',
	'UNHKNOWN',
	'UNLNOWN',
	'UNKNOW',
	'UNKNKOWN',
	'UNPROVOKED'
]);

export function normalizeVictimRelation(val: string): string {
	const v = val.trim().toUpperCase();
	if (!v) return 'UNKNOWN';
	if (VICTIM_RELATION_UNKNOWN_VARIANTS.has(v)) return 'UNKNOWN';
	if (/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(v)) {
		logUnexpected('victim_relation', val);
		return 'UNKNOWN';
	}
	const result = VICTIM_RELATION_MAP[v];
	if (!result) {
		logUnexpected('victim_relation', val);
		return 'UNKNOWN';
	}
	return result;
}

const ANIMAL_SIZE_MAP: Record<string, string> = {
	SMALL: 'SMALL',
	MED: 'MEDIUM',
	MEDIUM: 'MEDIUM',
	LARGE: 'LARGE',
	PUPPY: 'SMALL',
	KITTN: 'SMALL',
	TOY: 'SMALL',
	'X-LRG': 'LARGE'
};

export function normalizeAnimalSize(val: string): string {
	const v = val.trim().toUpperCase();
	const result = ANIMAL_SIZE_MAP[v];
	if (!result) {
		logUnexpected('animal_size', val);
		return v || 'UNKNOWN';
	}
	return result;
}

const SEX_MAP: Record<string, string> = {
	M: 'MALE',
	F: 'FEMALE',
	N: 'MALE (NEUTERED)',
	S: 'FEMALE (SPAYED)',
	U: 'UNKNOWN'
};

export function normalizeSex(val: string): string {
	const v = val.trim().toUpperCase();
	const result = SEX_MAP[v];
	if (result) return result;
	if (v) logUnexpected('sex', val);
	return v || 'UNKNOWN';
}

const SEVERITY_GROUP: Record<string, string> = {
	'1': 'LIGHT',
	'2': 'LIGHT',
	'2A': 'LIGHT',
	MINOR: 'LIGHT',
	MILD: 'LIGHT',
	LOW: 'LIGHT',
	'3': 'MODERATE',
	'3A': 'MODERATE',
	'3B': 'MODERATE',
	MEDIUM: 'MODERATE',
	'4': 'SEVERE',
	SEVERE: 'SEVERE',
	'5': 'CRITICAL',
	'6': 'CRITICAL'
};

export function normalizeSeverity(val: string): string {
	const raw = val.trim().toUpperCase();
	if (!raw || raw === 'UNKNOWN' || raw === 'E') return 'UNKNOWN';
	if (raw.startsWith('(') || raw.startsWith('/')) return 'UNKNOWN';
	const result = SEVERITY_GROUP[raw];
	if (result) return result;
	const n = Number.parseInt(raw, 10);
	if (!Number.isNaN(n) && n > 0 && n <= 6) return SEVERITY_GROUP[String(n)] ?? 'MODERATE';
	logUnexpected('bite_severity', val);
	return 'UNKNOWN';
}

export function normalizeVictimAge(val: string): number | null {
	const v = val.trim();
	if (!v) return null;
	const n = Number.parseFloat(v);
	if (Number.isNaN(n)) {
		logUnexpected('victim_age', val);
		return null;
	}
	return Math.trunc(n);
}

const DATE_FORMATS = [
	{ regex: /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/, parse: (v: string) => v.slice(0, 10) },
	{ regex: /^\d{4}-\d{2}-\d{2}$/, parse: (v: string) => v },
	{ regex: /^\d{1,2}\/\d{1,2}\/\d{4}[ T]\d{2}:\d{2}:\d{2}$/, parse: (v: string) => toIsoSlash(v) },
	{ regex: /^\d{1,2}\/\d{1,2}\/\d{4}$/, parse: (v: string) => toIsoSlash(v) },
	{ regex: /^\d{4}\/\d{2}\/\d{2}$/, parse: (v: string) => v.replace(/\//g, '-') },
	{
		regex: /^\d{4}\/\d{2}\/\d{2}[ T]\d{2}:\d{2}:\d{2}$/,
		parse: (v: string) => v.slice(0, 10).replace(/\//g, '-')
	},
	{ regex: /^\d{1,2}-\d{1,2}-\d{4}$/, parse: (v: string) => toIsoDash(v) }
];

function toIsoSlash(v: string): string {
	const [m, d, y] = v.split(/[/ T]/).slice(0, 3);
	return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function toIsoDash(v: string): string {
	const [m, d, y] = v.split('-');
	return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function parseDate(val: string): string | null {
	const v = val.trim();
	if (!v) return null;
	for (const fmt of DATE_FORMATS) {
		if (fmt.regex.test(v)) return fmt.parse(v);
	}
	const candidate = v.slice(0, 10);
	if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
	logUnexpected('date_format', val);
	return null;
}

export function normalizePriorBites(val: string): string {
	const v = val.trim();
	if (!v) return 'UNKNOWN';
	if (v === 'Y' || v === 'YES' || v === '1') return 'YES';
	if (v === '0' || v.toUpperCase() === 'NO') return 'NO';
	return 'YES';
}

export const OUTCOME_MAP: Record<string, string> = {
	MC: 'MICROCHIP SCANNED',
	IMPND: 'IMPOUNDED',
	RPRT: 'REPORT TAKEN',
	UTL: 'UNABLE TO LOCATE',
	UTMC: 'UNABLE TO LOCATE',
	COMP: 'COMPLAINT',
	UTC: 'UNABLE TO CONTACT',
	GOA: 'GONE ON ARRIVAL',
	NOTIC: 'NOTICE ISSUED',
	RSVLD: 'RESOLVED',
	CITE: 'CITATION ISSUED',
	DOA: 'DEAD ON ARRIVAL',
	EDUC: 'EDUCATION'
};

export function normalizeOutcome(val: string): string {
	const v = val.trim().toUpperCase();
	if (!v) return 'UNKNOWN';
	const result = OUTCOME_MAP[v];
	if (result) return result;
	if (v.length > 12) logUnexpected('outcome', val);
	return v;
}

export function ageGroup(age: number | null): string {
	if (age === null) return 'UNKNOWN';
	if (age <= 12) return 'CHILD';
	if (age <= 17) return 'TEEN';
	if (age <= 64) return 'ADULT';
	return 'SENIOR';
}

export function getRow(r: RawRecord, key: string): string {
	return (r[key] ?? '').trim();
}
