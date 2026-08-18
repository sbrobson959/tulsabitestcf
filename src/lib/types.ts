export type RunSummary = {
	runAt: string;
	lastUpdated: string;
	rawRows: number;
	incidents: number;
	geocoded: number;
	newGeocodes: number;
	geocodeCoveragePct: number;
	warnings: string[];
};

export type CleanedRecord = {
	bite_id: string;
	date: string;
	year: number | null;
	month: number | null;
	animal_type: string;
	animal_name: string;
	breed: string;
	breed_group: string;
	animal_sex: string;
	animal_size: string;
	victim_age: number | null;
	age_group: string;
	bite_location: string;
	severity: string;
	circumstance: string;
	victim_relation: string;
	address: string;
	zip: string;
	latitude: number | null;
	longitude: number | null;
	prior_bites: string;
	outcome: string;
	synopsis: string;
};

export type BitesData = {
	summary: RunSummary;
	records: CleanedRecord[];
};

export type FieldType = 'categorical' | 'numeric' | 'date' | 'coords';

export type FieldDef = {
	key: keyof CleanedRecord;
	label: string;
	type: FieldType;
	desc?: string;
	/** sort priority for categorical color assignment (stable palettes) */
	order?: string[];
	/** display labels for raw values (e.g. month "1" -> "Jan") used in filters */
	valueLabels?: Record<string, string>;
};

export type LayerMode = 'hexbin' | 'heatmap' | 'points' | 'clusters' | 'grid';
