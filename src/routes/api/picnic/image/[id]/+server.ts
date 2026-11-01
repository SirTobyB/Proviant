import { error } from '@sveltejs/kit';
import { getProductImage, isValidImageId } from '#lib/server/picnic/index.js';
import type { RequestHandler } from './$types';

/**
 * Liefert ein Picnic-Produktbild aus (Vorschau im Artikelformular, Import- und
 * Warenkorblisten). Verlinkt wird als `<id>.png` (siehe `picnicImageSrc`):
 * CrowdSecs Szenario `http-crawl-non_statics` zählt Pfade ohne Bildendung als
 * Seitenabrufe und sperrte die eigene IP, nachdem die Favoriten-Liste gut
 * hundert Bilder auf einmal geladen hatte. Die ID ohne Endung bleibt gültig.
 */
export const GET: RequestHandler = async ({ params }) => {
	const id = params.id.replace(/\.png$/, '');
	if (!isValidImageId(id)) throw error(404, 'Bild nicht gefunden');

	let image;
	try {
		image = await getProductImage(id);
	} catch {
		throw error(502, 'Picnic-Bild nicht verfügbar');
	}
	return new Response(new Uint8Array(image.bytes), {
		headers: {
			'Content-Type': image.contentType,
			// Picnics Bild-IDs sind Inhalts-Hashes — unter einer ID ändert sich nichts
			'Cache-Control': 'private, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
