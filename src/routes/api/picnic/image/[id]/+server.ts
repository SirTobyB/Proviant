import { error } from '@sveltejs/kit';
import { ensureLoggedIn, getProductImage } from '$lib/server/picnic';
import type { RequestHandler } from './$types';

/** Liefert ein Picnic-Produktbild aus (Vorschau im Artikelformular). */
export const GET: RequestHandler = async ({ params }) => {
	try {
		await ensureLoggedIn();
		const dataUri = await getProductImage(params.id);
		const match = dataUri.match(/^data:([^;,]+);base64,(.+)$/s);
		if (!match) throw new Error('Unerwartetes Bildformat');
		return new Response(Buffer.from(match[2], 'base64'), {
			headers: {
				'Content-Type': match[1],
				'Cache-Control': 'public, max-age=86400'
			}
		});
	} catch {
		throw error(502, 'Picnic-Bild nicht verfügbar');
	}
};
