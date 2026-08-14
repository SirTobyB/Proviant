import { db } from '$lib/server/db';
import { translator } from '$lib/i18n';
import { articles } from '$lib/server/db/schema';
import { activeLocations } from '$lib/server/locations';
import {
	getConnectionState,
	listOrderedProducts,
	type OrderedProduct
} from '$lib/server/picnic';
import { importArticleFromPicnic } from '$lib/server/articleImport';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const DELIVERY_LIMIT = 10;

export const load: PageServerLoad = async () => {
	const connection = getConnectionState();
	const locations = activeLocations();
	if (connection !== 'connected') {
		return { connection, products: [] as OrderedProduct[], linkedIds: [] as string[], locations, error: null };
	}

	// Bereits verknüpfte Picnic-IDs, um Vorhandenes zu markieren
	const linkedIds = db
		.select({ picnicId: articles.picnicId })
		.from(articles)
		.all()
		.map((a) => a.picnicId)
		.filter((id): id is string => Boolean(id));

	try {
		const products = await listOrderedProducts(DELIVERY_LIMIT);
		return { connection, products, linkedIds, locations, error: null };
	} catch (err) {
		return {
			connection,
			products: [] as OrderedProduct[],
			linkedIds,
			locations,
			error: err instanceof Error ? err.message : 'Bestellte Produkte konnten nicht geladen werden'
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
