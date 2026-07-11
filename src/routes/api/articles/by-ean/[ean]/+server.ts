import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { articles, stockEntries, storageLocations } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/** Artikel-Lookup per EAN für den Scanner; liefert Artikel samt Bestand. */
export const GET: RequestHandler = ({ params }) => {
	const ean = params.ean.replace(/\D/g, '');
	const article = db.select().from(articles).where(eq(articles.ean, ean)).get();
	if (!article) return json({ found: false });

	const stock = db
		.select({
			locationId: stockEntries.locationId,
			locationName: storageLocations.name,
			quantity: sql<number>`sum(${stockEntries.quantity})`
		})
		.from(stockEntries)
		.innerJoin(storageLocations, eq(storageLocations.id, stockEntries.locationId))
		.where(eq(stockEntries.articleId, article.id))
		.groupBy(stockEntries.locationId)
		.all();

	return json({
		found: true,
		article,
		stock,
		totalStock: stock.reduce((sum, entry) => sum + entry.quantity, 0)
	});
};
