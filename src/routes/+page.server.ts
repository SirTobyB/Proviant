import { db } from '$lib/server/db';
import { articles, stockEntries, storageLocations } from '$lib/server/db/schema';
import { count } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const locations = db.select().from(storageLocations).orderBy(storageLocations.sortOrder).all();
	const [articleCount] = db.select({ value: count() }).from(articles).all();
	const [stockCount] = db.select({ value: count() }).from(stockEntries).all();

	return {
		locations,
		articleCount: articleCount.value,
		stockCount: stockCount.value
	};
};
