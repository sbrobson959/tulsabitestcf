export type BasemapDef = {
	id: string;
	label: string;
	style: string;
	/** Mapbox Standard config overrides to apply after load (e.g. dark lighting). */
	config?: Record<string, string>;
	/** The UI color scheme to use for this basemap. */
	uiTheme: 'light' | 'dark';
};

export const MAPBOX_TOKEN: string =
	(import.meta.env as { PUBLIC_MAPBOX_TOKEN?: string }).PUBLIC_MAPBOX_TOKEN ?? '';

export const DEFAULT_BASEMAP = 'default';

export const BASEMAPS: BasemapDef[] = [
	{ id: 'default', label: 'Default', style: 'mapbox://styles/mapbox/standard', uiTheme: 'light' },
	{
		id: 'dark',
		label: 'Dark',
		style: 'mapbox://styles/mapbox/standard',
		config: { lightPreset: 'night' },
		uiTheme: 'dark'
	},
	{
		id: 'satellite',
		label: 'Satellite',
		style: 'mapbox://styles/mapbox/satellite-streets-v12',
		uiTheme: 'dark'
	}
];

export function basemapStyle(id: string): string {
	return (BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0]).style;
}

export function basemapById(id: string): BasemapDef {
	return BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];
}
