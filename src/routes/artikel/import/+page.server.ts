import { db } from '#lib/server/db/index.js';
import { translator } from '#lib/i18n/index.js';
import { articles } from '#lib/server/db/schema.js';
import { activeLocation, activeLocations } from '#lib/server/locations.js';
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
	// Ein Produkt je Anfrage: Die Seite arbeitet die Auswahl nacheinander ab
	// (Fortschritt, abbrechbar) statt in einer Anfrage, die bei Hunderten
	// Favoriten minutenlang offen bliebe. Der Picnic-Abruf ist zusätzlich
	// serverseitig gedrosselt (siehe `importArticleFromPicnic`).
	importOne: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		const productId = String(formData.get('productId') ?? '').trim();
		const name = String(formData.get('name') ?? '').trim();
		if (!productId || !name) return fail(400, { message: t('msg.invalidProductSelection'), kind: null });

		// Ein veraltetes Formular darf keinen stillgelegten Lagerort setzen
		const defaultLocationRaw = Number(formData.get('defaultLocationId'));
		let defaultLocationId: number | null = null;
		if (Number.isInteger(defaultLocationRaw) && defaultLocationRaw > 0) {
			if (!activeLocation(defaultLocationRaw)) return fail(400, { message: t('msg.locationNotFound'), kind: null });
			defaultLocationId = defaultLocationRaw;
		}

		const imageId = String(formData.get('imageId') ?? '').trim();
		const result = await importArticleFromPicnic(
			{ productId, name, unitQuantity: String(formData.get('unitQuantity') ?? ''), imageId: imageId || null },
			defaultLocationId,
			locals.user?.username ?? null
		);
		return { created: result.created, picnicError: result.picnicError ?? null };
	}
};
