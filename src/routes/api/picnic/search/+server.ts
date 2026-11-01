import { ensureLoggedIn, searchProducts } from '#lib/server/picnic/index.js';
import type { RequestHandler } from './$types';

/**
 * Picnic-Produktsuche zur Verknüpfung von Artikeln mit Picnic-IDs.
 * Liefert { results: [{ id, name, unitQuantity, price, imageId }] }
 * oder { error } wenn kein Picnic-Zugang konfiguriert/möglich ist.
 */
export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q')?.trim();
	if (!query) return Response.json({ results: [] });

	try {
		await ensureLoggedIn();
		const hits = await searchProducts(query);
		return Response.json({ results: hits.slice(0, 15) });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Picnic-Suche fehlgeschlagen';
		return Response.json({ error: message }, { status: 502 });
	}
};
