import { readData } from '$lib/server/pipeline/storage.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const data = await readData();
	return { data };
};
