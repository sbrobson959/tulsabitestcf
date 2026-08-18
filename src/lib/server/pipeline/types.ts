import type { BitesData, CleanedRecord, RunSummary } from '$lib/types';

export type { BitesData, CleanedRecord, RunSummary };

export type RawRecord = {
	[key: string]: string;
};

export type GeoCache = Record<string, { lat: number; lng: number; source: string }>;
