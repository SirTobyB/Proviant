import { db } from '$lib/server/db';
import { articles, stockEntries } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const query = url.searchParams.get('q')?.trim() ?? '';

	const rows = db
		.select({
			id: articles.id,
			name: articles.name,
			imagePath: articles.imagePath,
			amount: articles.amount,
			unit: articles.unit,
			ean: articles.ean,
			picnicId: articles.picnicId,
			minStock: articles.minStock,
			stock: sql<number>`coalesce(sum(${stockEntries.quantity}), 0)`
		})
		.from(articles)
		.leftJoin(stockEntries, eq(stockEntries.articleId, articles.id))
		.where(
			query
				? sql`(lower(${articles.name}) like ${'%' + query.toLowerCase() + '%'} or ${articles.ean} like ${'%' + query + '%'})`
				: undefined
		)
		.groupBy(articles.id)
		.orderBy(sql`${articles.name} collate nocase`)
		.all();

	return { articles: rows, query };
};
