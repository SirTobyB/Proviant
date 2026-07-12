import { db } from '$lib/server/db';
import { articles, stockEntries, storageLocations } from '$lib/server/db/schema';
import { bookIn, bookOut } from '$lib/server/stock';
import { eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

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
			defaultLocationId: articles.defaultLocationId,
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

function getArticle(formData: FormData) {
	const id = Number(formData.get('articleId'));
	return Number.isInteger(id) ? db.select().from(articles).where(eq(articles.id, id)).get() : undefined;
}

export const actions: Actions = {
	// Schnell +1: in den Standard-Lagerort (oder ersten Lagerort), ohne MHD
	bookIn: async ({ request, locals }) => {
		const article = getArticle(await request.formData());
		if (!article) return fail(400, { message: 'Artikel nicht gefunden' });
		const locationId =
			article.defaultLocationId ??
			db.select({ id: storageLocations.id }).from(storageLocations).orderBy(storageLocations.sortOrder).get()?.id;
		if (!locationId) return fail(400, { message: 'Kein Lagerort vorhanden' });
		bookIn(article.id, locationId, 1, null, locals.user?.username ?? null);
		return { adjusted: article.id };
	},

	// Schnell −1: FEFO (nächstes MHD zuerst)
	bookOut: async ({ request, locals }) => {
		const article = getArticle(await request.formData());
		if (!article) return fail(400, { message: 'Artikel nicht gefunden' });
		bookOut(article.id, 1, locals.user?.username ?? null);
		return { adjusted: article.id };
	}
};
