/**
 * Ablage von Artikel-/Rezeptbildern im Dateisystem (DATA_DIR/images).
 * In der DB steht nur der Dateiname; ausgeliefert wird über /api/images/[file].
 */
import { env } from '$env/dynamic/private';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/svg+xml': 'svg'
};

export function imagesDir(): string {
	const dir = path.join(env.DATA_DIR ?? '.', 'images');
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

function store(bytes: Buffer, mime: string): string {
	const ext = EXT_BY_MIME[mime];
	if (!ext) throw new Error(`Nicht unterstützter Bildtyp: ${mime}`);
	if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Bild ist zu groß (max. 5 MB)');
	const filename = `${crypto.randomUUID()}.${ext}`;
	fs.writeFileSync(path.join(imagesDir(), filename), bytes);
	return filename;
}

/** Lädt ein Bild von einer externen URL herunter (z.B. Open Food Facts). */
export async function saveImageFromUrl(url: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Bild-Download fehlgeschlagen (${response.status})`);
	const mime = (response.headers.get('content-type') ?? '').split(';')[0].trim();
	return store(Buffer.from(await response.arrayBuffer()), mime);
}

/** Speichert ein Bild aus einer Data-URI (z.B. Picnic-Produktbild). */
export function saveImageFromDataUri(dataUri: string): string {
	const match = dataUri.match(/^data:([^;,]+);base64,(.+)$/s);
	if (!match) throw new Error('Ungültige Data-URI');
	return store(Buffer.from(match[2], 'base64'), match[1]);
}

/** Speichert ein hochgeladenes Bild (Formular-Upload). */
export async function saveImageFromUpload(file: File): Promise<string> {
	return store(Buffer.from(await file.arrayBuffer()), file.type);
}

/** Löscht ein gespeichertes Bild; fehlende Dateien sind kein Fehler. */
export function deleteImage(filename: string | null | undefined): void {
	if (!filename) return;
	const file = path.join(imagesDir(), path.basename(filename));
	fs.rmSync(file, { force: true });
}

/** Liefert den Pfad zu einem gespeicherten Bild oder null. */
export function imageFile(filename: string): string | null {
	const file = path.join(imagesDir(), path.basename(filename));
	return fs.existsSync(file) ? file : null;
}
