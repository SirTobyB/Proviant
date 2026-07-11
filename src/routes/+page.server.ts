import { db } from '$lib/server/db';
import { articles, stockEntries, storageLocations } from '$lib/server/db/schema';
import { count, eq, sql } from 'drizzle-orm';
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

	return {
		locations,
		articleCount: articleCount.value,
		stockCount: stockCount.value
	};
};
