import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createImageCache, createLimiter, imageContentType, isValidImageId } from './imageCache';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

let dir: string;
beforeEach(() => {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'picnic-bilder-'));
});
afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true });
});

/** Ein Abruf, der zählt und erst auf Zuruf fertig wird. */
function controllableFetch(bytes: Buffer = PNG) {
	const calls: string[] = [];
	const releases: (() => void)[] = [];
	let active = 0;
	let maxActive = 0;
	const fetchImage = async (id: string) => {
		calls.push(id);
		active += 1;
		maxActive = Math.max(maxActive, active);
		await new Promise<void>((resolve) => releases.push(resolve));
		active -= 1;
		return bytes;
	};
	return { fetchImage, calls, releases, maxActive: () => maxActive };
}

/** Lässt angestoßene Promises weiterlaufen, bis nichts mehr nachkommt. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('isValidImageId', () => {
	it('akzeptiert Picnics Hash-IDs', () => {
		expect(isValidImageId('a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90')).toBe(true);
	});

	it.each(['', '../picnic-auth-key', 'a/b', 'a.png', 'x'.repeat(129)])('lehnt „%s" ab', (id) => {
		expect(isValidImageId(id)).toBe(false);
	});
});

describe('imageContentType', () => {
	it('erkennt das Format am Inhalt', () => {
		expect(imageContentType(PNG)).toBe('image/png');
		expect(imageContentType(JPEG)).toBe('image/jpeg');
		expect(imageContentType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
	});
});

describe('createLimiter', () => {
	it('lässt nie mehr als max Aufgaben gleichzeitig laufen und arbeitet alle ab', async () => {
		const limit = createLimiter(2);
		let active = 0;
		let maxActive = 0;
		const results = await Promise.all(
			Array.from({ length: 7 }, (_, i) =>
				limit(async () => {
					active += 1;
					maxActive = Math.max(maxActive, active);
					await settle();
					active -= 1;
					return i;
				})
			)
		);
		expect(maxActive).toBe(2);
		expect(results).toEqual([0, 1, 2, 3, 4, 5, 6]);
	});

	it('gibt den Platz auch nach einem Fehler frei', async () => {
		const limit = createLimiter(1);
		await expect(limit(async () => Promise.reject(new Error('kaputt')))).rejects.toThrow('kaputt');
		await expect(limit(async () => 'weiter')).resolves.toBe('weiter');
	});
});

describe('createImageCache', () => {
	it('holt ein Bild nur einmal und liefert es danach von der Platte', async () => {
		const fake = controllableFetch();
		const get = createImageCache({ dir, fetchImage: fake.fetchImage, maxConcurrent: 4 });

		const first = get('abc');
		await settle();
		fake.releases.shift()!();
		expect(await first).toEqual({ bytes: PNG, contentType: 'image/png' });

		// Neuer Cache auf demselben Ordner — wie nach einem Neustart
		const again = createImageCache({ dir, fetchImage: fake.fetchImage, maxConcurrent: 4 });
		expect((await again('abc')).contentType).toBe('image/png');
		expect(fake.calls).toEqual(['abc']);
	});

	it('teilt gleichzeitige Abrufe derselben ID', async () => {
		const fake = controllableFetch();
		const get = createImageCache({ dir, fetchImage: fake.fetchImage, maxConcurrent: 4 });

		const both = Promise.all([get('abc'), get('abc')]);
		await settle();
		fake.releases.forEach((release) => release());
		await both;
		expect(fake.calls).toEqual(['abc']);
	});

	it('fragt höchstens maxConcurrent Bilder gleichzeitig bei Picnic an', async () => {
		const fake = controllableFetch();
		const get = createImageCache({ dir, fetchImage: fake.fetchImage, maxConcurrent: 3 });

		const all = Promise.all(Array.from({ length: 10 }, (_, i) => get(`bild${i}`)));
		while (fake.calls.length < 10 || fake.releases.length > 0) {
			await settle();
			fake.releases.shift()?.();
		}
		await all;
		expect(fake.maxActive()).toBe(3);
	});

	it('speichert keinen Inhalt, der kein Bild ist', async () => {
		const get = createImageCache({
			dir,
			fetchImage: async () => Buffer.from('<html>Fehlerseite</html>'),
			maxConcurrent: 1
		});
		await expect(get('abc')).rejects.toThrow('kein bekanntes Bildformat');
		expect(fs.readdirSync(dir)).toEqual([]);
	});

	it('lehnt ungültige IDs ab, ohne Picnic zu fragen', async () => {
		const fake = controllableFetch();
		const get = createImageCache({ dir, fetchImage: fake.fetchImage, maxConcurrent: 1 });
		await expect(get('../picnic-auth-key')).rejects.toThrow('Ungültige Bild-ID');
		expect(fake.calls).toEqual([]);
	});
});
