import { db } from '#lib/server/db/index.js';
import { translator } from '#lib/i18n/index.js';
import { articles } from '#lib/server/db/schema.js';
import { activeLocations } from '#lib/server/locations.js';
import {
	describePicnicError,
	getConnectionState,
	listFavoriteProducts,
	listOrderedProducts
} from '#lib/server/picnic/index.js';
import { importArticleFromPicnic } from '#lib/server/articleImport.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const DELIVERY_LIMIT = 10;

/**
 * Ein importierbares Produkt, egal aus welcher Quelle. Lieferungen liefern
 * Kaufhäufigkeit und -datum, Favoriten ihren Gang (für Zwischenüberschriften).
 */
type ImportProduct = {
	productId: string;
	name: string;
	unitQuantity: string;
	imageId: string | null;
	timesOrdered: number | null;
	lastOrderedAt: string | null;
	aisle: string | null;
};

type Source = 'lieferungen' | 'favoriten';

async function loadProducts(source: Source): Promise<ImportProduct[]> {
	if (source === 'favoriten') {
		return (await listFavoriteProducts()).flatMap((aisle) =>
			aisle.products.map((p) => ({ ...p, timesOrdered: null, lastOrderedAt: null, aisle: aisle.title }))
		);
	}
	return (await listOrderedProducts(DELIVERY_LIMIT)).map((p) => ({ ...p, aisle: null }));
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const source: Source = url.searchParams.get('quelle') === 'favoriten' ? 'favoriten' : 'lieferungen';
	const connection = getConnectionState();
	const locations = activeLocations();
	if (connection !== 'connected') {
		return { connection, source, products: [] as ImportProduct[], linkedIds: [] as string[], locations, error: null };
	}

	// Bereits verknüpfte Picnic-IDs, um Vorhandenes zu markieren
	const linkedIds = db
		.select({ picnicId: articles.picnicId })
		.from(articles)
		.all()
		.map((a) => a.picnicId)
		.filter((id): id is string => Boolean(id));

	try {
		const products = await loadProducts(source);
		return { connection, source, products, linkedIds, locations, error: null };
	} catch (err) {
		return {
			connection,
			source,
			products: [] as ImportProduct[],
			linkedIds,
			locations,
			error: describePicnicError(err, translator(locals.locale), 'Bestellte Produkte laden')
		};
	}
};

export const actions: Actions = {
	import: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		const defaultLocationRaw = Number(formData.get('defaultLocationId'));
		const defaultLocationId =
			Number.isInteger(defaultLocationRaw) && defaultLocationRaw > 0 ? defaultLocationRaw : null;

		let selected: { productId: string; name: string; unitQuantity: string; imageId: string | null }[];
		try {
			const raw = JSON.parse(String(formData.get('products') ?? '[]'));
			if (!Array.isArray(raw)) throw new Error();
			selected = raw;
		} catch {
			return fail(400, { message: t('msg.invalidProductSelection') });
		}
		if (selected.length === 0) return fail(400, { message: t('msg.nothingSelected') });

		const user = locals.user?.username ?? null;
		let created = 0;
		let skipped = 0;
		for (const product of selected) {
			if (!product.productId || !product.name) continue;
			const result = await importArticleFromPicnic(
				{
					productId: String(product.productId),
					name: String(product.name),
					unitQuantity: String(product.unitQuantity ?? ''),
					imageId: product.imageId ? String(product.imageId) : null
				},
				defaultLocationId,
				user
			);
			if (result.created) created += 1;
			else skipped += 1;
		}

		return { imported: created, skipped };
	}
};
