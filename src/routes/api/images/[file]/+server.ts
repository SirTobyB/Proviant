import { error } from '@sveltejs/kit';
import { imageFile } from '$lib/server/images';
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from './$types';

const MIME_BY_EXT: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml'
};

export const GET: RequestHandler = ({ params }) => {
	const file = imageFile(params.file);
	if (!file) throw error(404, 'Bild nicht gefunden');

	const mime = MIME_BY_EXT[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
	return new Response(fs.readFileSync(file), {
		headers: {
			'Content-Type': mime,
			// Dateinamen sind UUIDs — Inhalte ändern sich nie, aggressiv cachen
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
