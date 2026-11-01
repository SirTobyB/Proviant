import { db } from '#lib/server/db/index.js';
import { articles, stockEntries } from '#lib/server/db/schema.js';
import { currentOffers } from '#lib/server/offers.js';
import { getConnectionState } from '#lib/server/picnic/index.js';
import { sortOffers } from '#lib/offers.js';
import { addToCartAction, cartQuantitiesForPage } from '#lib/server/cartButton.js';
import { eq, isNotNull, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

/** Alle eigenen Artikel, die bei Picnic gerade im Angebot sind. */
export const load: PageServerLoad = async () => {
	const connection = getConnectionState();
	const offers = await currentOffers();

	const rows = db
		.select({
			id: articles.id,
			name: articles.name,
			imagePath: articles.imagePath,
			amount: articles.amount,
			unit: articles.unit,
			picnicId: articles.picnicId,
			minStock: articles.minStock,
			stock: sql<number>`coalesce(sum(${stockEntries.quantity}), 0)`
		})
		.from(articles)
		.leftJoin(stockEntries, eq(stockEntries.articleId, articles.id))
		.where(isNotNull(articles.picnicId))
		.groupBy(articles.id)
		.all();

	const items = sortOffers(
		rows.flatMap((row) => {
			const price = row.picnicId ? offers.get(row.picnicId) : undefined;
			return price ? [{ ...row, price }] : [];
		})
	);

	return { connection, items, cart: await cartQuantitiesForPage() };
};

export const actions: Actions = {
	addToCart: ({ request, locals }) => addToCartAction(request, locals.locale)
};
