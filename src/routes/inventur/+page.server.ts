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

	// Nur Artikel mit Bestand > 0: der Inner-Join schließt bestandslose Artikel
	// von selbst aus (jede Zeile hat mindestens eine Charge mit quantity >= 1)
	const rows = db
		.select({
			id: articles.id,
			name: articles.name,
			imagePath: articles.imagePath,
			amount: articles.amount,
			unit: articles.unit,
			stock: sql<number>`sum(${stockEntries.quantity})`
		})
		.from(articles)
		.innerJoin(stockEntries, eq(stockEntries.articleId, articles.id))
		.where(query ? sql`lower(${articles.name}) like ${'%' + query.toLowerCase() + '%'}` : undefined)
		.groupBy(articles.id)
		.orderBy(sql`${articles.name} collate nocase`)
		.all();

	// Lagerort-Aufschlüsselung je Artikel (z.B. "Kühlschrank 2×, Vorratsregal 1×"),
	// damit man vor einer Minus-Korrektur sieht, wo der Bestand liegt
	const locationRows = db
		.select({
			articleId: stockEntries.articleId,
			locationName: storageLocations.name,
			quantity: sql<number>`sum(${stockEntries.quantity})`
		})
		.from(stockEntries)
		.innerJoin(storageLocations, eq(storageLocations.id, stockEntries.locationId))
		.groupBy(stockEntries.articleId, stockEntries.locationId)
		.orderBy(storageLocations.sortOrder)
		.all();
	const locationMap = new Map<number, string[]>();
	for (const row of locationRows) {
		const list = locationMap.get(row.articleId) ?? [];
		list.push(`${row.locationName} ${row.quantity}×`);
		locationMap.set(row.articleId, list);
	}

	// Tags separat als Bulk-Map (kein Join in die Aggregation — würde sum() verfälschen)
	const tagMap = tagsForArticles(rows.map((r) => r.id));
	const enriched = rows.map((r) => ({
		...r,
		tags: tagMap.get(r.id) ?? [],
		locations: locationMap.get(r.id) ?? []
	}));
	const filtered = tagFilter ? enriched.filter((r) => r.tags.includes(tagFilter)) : enriched;

	return { articles: filtered, query, tagFilter, allTags: allArticleTagNames() };
};

export const actions: Actions = {
	/**
	 * Inventurkorrektur: setzt den Gesamtbestand eines Artikels auf den
	 * gezählten Wert. Das Delta wird serverseitig gegen den LIVE-Bestand
	 * berechnet (nicht gegen die evtl. veraltete Anzeige) — nach der Buchung
	 * entspricht der Bestand immer dem gezählten Wert.
	 */
	setStock: async ({ request, locals }) => {
		const formData = await request.formData();
		const user = locals.user?.username ?? null;

		const articleId = Number(formData.get('articleId'));
		const article = Number.isInteger(articleId)
			? db.select().from(articles).where(eq(articles.id, articleId)).get()
			: undefined;
		if (!article) return fail(400, { message: 'Artikel nicht gefunden' });

		// 0 ist ein gültiger Zählwert (alles verbraucht) — bewusst NICHT parseQuantity
		const newTotal = Number(formData.get('newTotal'));
		if (!Number.isInteger(newTotal) || newTotal < 0 || newTotal > 999) {
			return fail(400, { message: 'Zählwert muss eine ganze Zahl zwischen 0 und 999 sein' });
		}

		// Ab hier kein await mehr: better-sqlite3 ist synchron, dadurch sind
		// Bestandsermittlung und Buchung effektiv atomar.
		const current =
			db
				.select({ total: sql<number>`coalesce(sum(${stockEntries.quantity}), 0)` })
				.from(stockEntries)
				.where(eq(stockEntries.articleId, article.id))
				.get()?.total ?? 0;
		const delta = newTotal - current;

		if (delta > 0) {
			// Zugang ohne MHD in den Standard-Lagerort (wie die Schnellkorrektur auf /artikel)
			const locationId =
				article.defaultLocationId ??
				db.select({ id: storageLocations.id }).from(storageLocations).orderBy(storageLocations.sortOrder).get()?.id;
			if (!locationId) return fail(400, { message: 'Kein Lagerort vorhanden' });
			bookIn(article.id, locationId, delta, null, user);
		} else if (delta < 0) {
			bookOut(article.id, -delta, user);
		}

		return { adjusted: article.id, newTotal };
	}
};
