import { error } from '@sveltejs/kit';
import { imageFile } from '$lib/server/images';
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from './$types';

// Kein SVG: `images.ts` speichert keins mehr, und Altbestand aus früheren
// Versionen soll gerade nicht mehr als aktives Dokument ausgeliefert werden.
const MIME_BY_EXT: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.gif': 'image/gif'
};

export const GET: RequestHandler = ({ params }) => {
	const file = imageFile(params.file);
	if (!file) throw error(404, 'Bild nicht gefunden');

	const mime = MIME_BY_EXT[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
	return new Response(fs.readFileSync(file), {
		headers: {
			'Content-Type': mime,
			// Dateinamen sind UUIDs — Inhalte ändern sich nie, aggressiv cachen
			'Cache-Control': 'public, max-age=31536000, immutable',
			// Nicht am Content-Type vorbei raten: sonst macht der Browser aus einer
			// als octet-stream ausgelieferten Altdatei doch wieder ein Dokument.
			'X-Content-Type-Options': 'nosniff',
			// Zweiter Riegel für Altbestand: Wer eine solche Datei direkt aufruft,
			// bekommt eine Seite ohne jedes Recht — kein Script, keine Origin.
			// Auf <img>-Einbindungen wirkt sich das nicht aus.
			'Content-Security-Policy': "default-src 'none'; sandbox"
		}
	});
};
