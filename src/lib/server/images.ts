/**
 * Ablage von Artikel-/Rezeptbildern im Dateisystem (DATA_DIR/images).
 * In der DB steht nur der Dateiname; ausgeliefert wird über /api/images/[file].
 */
import { env } from '$env/dynamic/private';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Smartphone-Fotos liegen oft bei 3–8 MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Erlaubte Bildformate, erkannt an ihrer Signatur (den ersten Bytes).
 *
 * **SVG fehlt hier bewusst.** Eine SVG-Datei ist ein aktives Dokument: sie darf
 * `<script>` enthalten, und wer sie unter /api/images/… direkt im Browser
 * öffnet, führt dieses Script auf der Origin der App aus. Ein Bildformat ohne
 * Skriptfähigkeit ist die einzige Zusicherung, die wir hier geben können.
 */
const SIGNATURES: { ext: string; matches: (b: Buffer) => boolean }[] = [
	{ ext: 'jpg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
	{
		ext: 'png',
		matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
	},
	{ ext: 'gif', matches: (b) => b.subarray(0, 6).toString('latin1').startsWith('GIF8') },
	{
		ext: 'webp',
		matches: (b) =>
			b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP'
	}
];

export function imagesDir(): string {
	const dir = path.join(env.DATA_DIR ?? '.', 'images');
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

/**
 * Legt ein Bild unter zufälligem Namen ab und gibt den Dateinamen zurück.
 *
 * Der Typ wird **aus dem Inhalt** bestimmt, nie aus einer Angabe des Absenders:
 * `File.type` beim Upload ist der Content-Type des Multipart-Teils und damit
 * frei wählbar — auch das `accept` am Eingabefeld ist reine Oberfläche. Wer den
 * Typ glaubt, statt ihn zu prüfen, legt beliebigen Inhalt unter beliebiger
 * Endung ab.
 */
function store(bytes: Buffer): string {
	if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Bild ist zu groß (max. 10 MB)');
	const ext = SIGNATURES.find((s) => s.matches(bytes))?.ext;
	if (!ext) throw new Error('Nicht unterstütztes Bildformat (erlaubt: JPEG, PNG, GIF, WebP)');
	const filename = `${crypto.randomUUID()}.${ext}`;
	fs.writeFileSync(path.join(imagesDir(), filename), bytes);
	return filename;
}

/**
 * Lädt ein Bild von Open Food Facts herunter (Vorbefüllung nach EAN-Scan).
 *
 * Die URL stammt aus einem Formularfeld und ist damit frei wählbar — ohne die
 * Einschränkung hier ließe sich der Server als Sprungbrett ins Heimnetz
 * benutzen: er steht hinter dem Reverse Proxy und erreicht Adressen, die von
 * außen nicht erreichbar sind. Erlaubt ist deshalb nur die eine Quelle, die das
 * Formular überhaupt anbietet, und Weiterleitungen führen aus ihr nicht heraus.
 */
export async function saveImageFromUrl(url: string): Promise<string> {
	let ziel: URL;
	try {
		ziel = new URL(url);
	} catch {
		throw new Error('Bild-URL ist ungültig');
	}
	if (ziel.protocol !== 'https:' || !/(^|\.)openfoodfacts\.org$/.test(ziel.hostname)) {
		throw new Error('Bild-URL nicht erlaubt (nur https://…openfoodfacts.org)');
	}
	const response = await fetch(ziel, { redirect: 'error' });
	if (!response.ok) throw new Error(`Bild-Download fehlgeschlagen (${response.status})`);
	return store(Buffer.from(await response.arrayBuffer()));
}

/** Speichert ein Bild aus einer Data-URI (z.B. Picnic-Produktbild). */
export function saveImageFromDataUri(dataUri: string): string {
	const match = dataUri.match(/^data:([^;,]+);base64,(.+)$/s);
	if (!match) throw new Error('Ungültige Data-URI');
	return store(Buffer.from(match[2], 'base64'));
}

/** Speichert ein hochgeladenes Bild (Formular-Upload). */
export async function saveImageFromUpload(file: File): Promise<string> {
	return store(Buffer.from(await file.arrayBuffer()));
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
