/**
 * Plattencache für Picnic-Produktbilder.
 *
 * Listen wie der Artikelimport aus den Favoriten zeigen hunderte Bilder auf
 * einmal. Ohne Cache holte jeder Aufruf das Bild live bei Picnic — ungebremst
 * und bei jedem Seitenaufruf aufs Neue. Picnics Bild-IDs sind Inhalts-Hashes,
 * ein Bild ändert sich unter seiner ID also nie: einmal geholt, gilt es für
 * immer. Gleichzeitige Abrufe derselben ID teilen sich eine Anfrage, und mehr
 * als `maxConcurrent` Abrufe laufen nie parallel bei Picnic auf.
 *
 * Bewusst ohne SvelteKit-Import (Ordner und Abruf kommen als Parameter), damit
 * eigenständig testbar.
 */
import fs from 'node:fs';
import path from 'node:path';

export type CachedImage = { bytes: Buffer; contentType: string };

/** Bild-IDs landen im Dateinamen — alles außer diesen Zeichen ist ein Pfadtrick. */
const IMAGE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function isValidImageId(id: string): boolean {
	return IMAGE_ID.test(id);
}

/** Bildformat aus den ersten Bytes, nie aus einer Angabe des Absenders (siehe `server/images.ts`). */
export function imageContentType(bytes: Uint8Array): string | null {
	const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
	if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') {
		return 'image/webp';
	}
	if (b.subarray(0, 6).toString('latin1').startsWith('GIF8')) return 'image/gif';
	return null;
}

/** Begrenzt, wie viele Aufgaben gleichzeitig laufen; der Rest wartet der Reihe nach. */
export function createLimiter(max: number) {
	let running = 0;
	const waiting: (() => void)[] = [];
	return async function limit<T>(task: () => Promise<T>): Promise<T> {
		if (running >= max) await new Promise<void>((resolve) => waiting.push(resolve));
		running += 1;
		try {
			return await task();
		} finally {
			running -= 1;
			waiting.shift()?.();
		}
	};
}

export function createImageCache(options: {
	dir: string;
	fetchImage: (id: string) => Promise<Uint8Array>;
	maxConcurrent: number;
}) {
	const limit = createLimiter(options.maxConcurrent);
	const inFlight = new Map<string, Promise<CachedImage>>();

	function fromDisk(file: string): CachedImage | null {
		let bytes: Buffer;
		try {
			bytes = fs.readFileSync(file);
		} catch {
			return null;
		}
		const contentType = imageContentType(bytes);
		return contentType ? { bytes, contentType } : null;
	}

	async function fetchAndStore(id: string, file: string): Promise<CachedImage> {
		const bytes = Buffer.from(await limit(() => options.fetchImage(id)));
		const contentType = imageContentType(bytes);
		if (!contentType) throw new Error(`Picnic-Bild ${id} hat kein bekanntes Bildformat`);
		fs.mkdirSync(options.dir, { recursive: true });
		// Erst unter Zwischennamen schreiben: ein abgebrochener Schreibvorgang
		// hinterließe sonst ein halbes Bild, das ab dann dauerhaft ausgeliefert würde.
		const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
		fs.writeFileSync(temp, bytes);
		fs.renameSync(temp, file);
		return { bytes, contentType };
	}

	/** Bild zur ID — von der Platte, sonst einmalig bei Picnic geholt. */
	return async function get(id: string): Promise<CachedImage> {
		if (!isValidImageId(id)) throw new Error(`Ungültige Bild-ID: ${id}`);
		const file = path.join(options.dir, id);
		const cached = fromDisk(file);
		if (cached) return cached;

		let pending = inFlight.get(id);
		if (!pending) {
			pending = fetchAndStore(id, file).finally(() => inFlight.delete(id));
			inFlight.set(id, pending);
		}
		return pending;
	};
}
