import { db } from '$lib/server/db';
import { articles, stockEntries, storageLocations } from '$lib/server/db/schema';
import { count, eq, sql } from 'drizzle-orm';
import { MHD_SOON_DAYS } from '$lib/mhd';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const locations = db
		.select({
			id: storageLocations.id,
			name: storageLocations.name,
			quantity: sql<number>`coalesce(sum(${stockEntries.quantity}), 0)`
		})
		.from(storageLocations)
		.leftJoin(stockEntries, eq(stockEntries.locationId, storageLocations.id))
		.groupBy(storageLocations.id)
		.orderBy(storageLocations.sortOrder)
		.all();

	const [articleCount] = db.select({ value: count() }).from(articles).all();
	const [stockCount] = db
		.select({ value: sql<number>`coalesce(sum(${stockEntries.quantity}), 0)` })
		.from(stockEntries)
		.all();

	// Chargen mit MHD, die bald ablaufen oder schon abgelaufen sind
	const soonThreshold = new Date(Date.now() + MHD_SOON_DAYS * 86_400_000)
		.toISOString()
		.slice(0, 10);
	const expiring = db
		.select({
			id: stockEntries.id,
			articleId: stockEntries.articleId,
			articleName: articles.name,
			imagePath: articles.imagePath,
			locationName: storageLocations.name,
			quantity: stockEntries.quantity,
			bestBefore: stockEntries.bestBefore
		})
		.from(stockEntries)
		.innerJoin(articles, eq(articles.id, stockEntries.articleId))
		.innerJoin(storageLocations, eq(storageLocations.id, stockEntries.locationId))
		.where(
			sql`${stockEntries.bestBefore} is not null and ${stockEntries.bestBefore} <= ${soonThreshold}`
		)
		.orderBy(stockEntries.bestBefore)
		.all();

	return {
		locations,
		articleCount: articleCount.value,
		stockCount: stockCount.value,
		expiring
	};
};
