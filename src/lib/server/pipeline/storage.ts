import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import seedData from './seed/data.json';
import seedCache from './seed/geocode-cache.json';
import type { BitesData, GeoCache } from './types';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

export const DATA_DIR = path.resolve(process.cwd(), 'data');
const BLOD_STORE_ROOT = 'bites2';

type BlobStore = typeof import('@vercel/blob');

async function blobStore(): Promise<BlobStore> {
	return import('@vercel/blob');
}

export async function readData(): Promise<BitesData | null> {
	const text = await readJson('data.json');
	if (text) {
		try {
			return JSON.parse(text) as BitesData;
		} catch {
			// fall through to seed
		}
	}
	return seedData as BitesData;
}

export async function readGeoCache(): Promise<GeoCache> {
	const text = await readJson('geocode-cache.json');
	if (text) {
		try {
			return JSON.parse(text) as GeoCache;
		} catch {
			// fall through to seed
		}
	}
	return seedCache as GeoCache;
}

export async function writeData(data: BitesData): Promise<string> {
	return writeJson('data.json', JSON.stringify(data), 'application/json');
}

export async function writeGeoCache(cache: GeoCache): Promise<string> {
	return writeJson('geocode-cache.json', JSON.stringify(cache), 'application/json');
}

async function readJson(key: string): Promise<string | null> {
	if (BLOB_READ_WRITE_TOKEN) {
		const { get } = await blobStore();
		const pathname = `${BLOD_STORE_ROOT}/${key}`;
		const result = await get(pathname, { access: 'public', useCache: false });
		if (!result) return null;
		if (result.statusCode === 304) return null;
		return await new Response(result.stream as unknown as BodyInit).text();
	}
	try {
		return await readFile(path.join(DATA_DIR, key), 'utf8');
	} catch {
		return null;
	}
}

async function writeJson(key: string, body: string, contentType: string): Promise<string> {
	if (BLOB_READ_WRITE_TOKEN) {
		const { put } = await blobStore();
		const pathname = `${BLOD_STORE_ROOT}/${key}`;
		const result = await put(pathname, body, {
			access: 'public',
			allowOverwrite: true,
			contentType,
			addRandomSuffix: false,
			cacheControlMaxAge: 300
		});
		return result.url;
	}
	await mkdir(DATA_DIR, { recursive: true });
	const file = path.join(DATA_DIR, key);
	await writeFile(file, body, 'utf8');
	return `file://${file}`;
}
