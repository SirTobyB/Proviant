import { db } from '$lib/server/db';
import { articles, stockEntries, storageLocations } from '$lib/server/db/schema';
import { allArticleTagNames, tagsForArticles } from '$lib/server/articleTags';
import { bookIn, bookOut } from '$lib/server/stock';
import { eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const query = url.searchParams.get('q')?.trim() ?? '';
	const tagFilter = url.searchParams.get('tag')?.trim() ?? '';

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

	// Tags separat als Bulk-Map holen — ein Join in die Aggregations-Query würde
	// sum(quantity) mit der Tag-Anzahl multiplizieren
	const tagMap = tagsForArticles(rows.map((r) => r.id));
	const tagged = rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
	const filtered = tagFilter ? tagged.filter((r) => r.tags.includes(tagFilter)) : tagged;

	return { articles: filtered, query, tagFilter, allTags: allArticleTagNames() };
};

function getArticle(formData: FormData) {
	const id = Number(formData.get('articleId'));
	return Number.isInteger(id) ? db.select().from(articles).where(eq(articles.id, id)).get() : undefined;
}

/** Menge aus dem Formular (Default 1, max. 999). */
function parseQuantity(formData: FormData): number {
	const quantity = Number(formData.get('quantity'));
	if (!Number.isInteger(quantity) || quantity < 1) return 1;
	return Math.min(quantity, 999);
}

export const actions: Actions = {
	// Schnell einbuchen: in den Standard-Lagerort (oder ersten Lagerort), ohne MHD
	bookIn: async ({ request, locals }) => {
		const formData = await request.formData();
		const article = getArticle(formData);
		if (!article) return fail(400, { message: 'Artikel nicht gefunden' });
		const locationId =
			article.defaultLocationId ??
			db.select({ id: storageLocations.id }).from(storageLocations).orderBy(storageLocations.sortOrder).get()?.id;
		if (!locationId) return fail(400, { message: 'Kein Lagerort vorhanden' });
		bookIn(article.id, locationId, parseQuantity(formData), null, locals.user?.username ?? null);
		return { adjusted: article.id };
	},

	// Schnell ausbuchen: FEFO (nächstes MHD zuerst)
	bookOut: async ({ request, locals }) => {
		const formData = await request.formData();
		const article = getArticle(formData);
		if (!article) return fail(400, { message: 'Artikel nicht gefunden' });
		bookOut(article.id, parseQuantity(formData), locals.user?.username ?? null);
		return { adjusted: article.id };
	}
};
