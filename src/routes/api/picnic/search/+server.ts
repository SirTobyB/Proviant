import { json } from '@sveltejs/kit';
import { ensureLoggedIn, searchProducts } from '$lib/server/picnic';
import type { RequestHandler } from './$types';

/**
 * Picnic-Produktsuche zur Verknüpfung von Artikeln mit Picnic-IDs.
 * Liefert { results: [{ id, name, unitQuantity, price, imageId }] }
 * oder { error } wenn kein Picnic-Zugang konfiguriert/möglich ist.
 */
export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q')?.trim();
	if (!query) return json({ results: [] });

	try {
		await ensureLoggedIn();
		const units = await searchProducts(query);
		return json({
			results: units.slice(0, 15).map((unit) => ({
				id: unit.id,
				name: unit.name,
				unitQuantity: unit.unit_quantity,
				price: unit.display_price,
				imageId: unit.image_id
			}))
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Picnic-Suche fehlgeschlagen';
		return json({ error: message }, { status: 502 });
	}
};
