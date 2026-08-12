import { db } from '$lib/server/db';
import { articles, stockEntries, storageLocations } from '$lib/server/db/schema';
import { moveStockEntryFromForm, updateStockEntryFromForm } from '$lib/server/stock';
import { eq, sql } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function getLocation(id: string) {
	const locationId = Number(id);
	if (!Number.isInteger(locationId)) throw error(404, 'Lagerort nicht gefunden');
	const location = db.select().from(storageLocations).where(eq(storageLocations.id, locationId)).get();
	if (!location) throw error(404, 'Lagerort nicht gefunden');
	return location;
}

export const load: PageServerLoad = ({ params }) => {
	const location = getLocation(params.id);

	const entries = db
		.select({
			id: stockEntries.id,
			articleId: articles.id,
			articleName: articles.name,
			imagePath: articles.imagePath,
			amount: articles.amount,
			unit: articles.unit,
			quantity: stockEntries.quantity,
			bestBefore: stockEntries.bestBefore
		})
		.from(stockEntries)
		.innerJoin(articles, eq(articles.id, stockEntries.articleId))
		.where(eq(stockEntries.locationId, location.id))
		.orderBy(articles.name)
		.all();

	// Chargen nach Artikel gruppieren
	const byArticle = new Map<number, { articleId: number; articleName: string; imagePath: string | null; amount: number | null; unit: string | null; entries: typeof entries }>();
	for (const entry of entries) {
		let group = byArticle.get(entry.articleId);
		if (!group) {
			group = {
				articleId: entry.articleId,
				articleName: entry.articleName,
				imagePath: entry.imagePath,
				amount: entry.amount,
				unit: entry.unit,
				entries: []
			};
			byArticle.set(entry.articleId, group);
		}
		group.entries.push(entry);
	}

	return {
		location,
		articles: [...byArticle.values()],
		otherLocations: db
			.select()
			.from(storageLocations)
			.where(sql`${storageLocations.id} != ${location.id}`)
			.orderBy(storageLocations.sortOrder)
			.all()
	};
};

export const actions: Actions = {
	updateEntry: async ({ params, request, locals }) => {
		const location = getLocation(params.id);
		const scope = { locationId: location.id };
		const result = updateStockEntryFromForm(
			await request.formData(),
			scope,
			locals.user?.username ?? null
		);
		if (!result.ok) return fail(result.status, { message: result.message });
		return { ok: true };
	},

	// Charge komplett in einen anderen Lagerort umlagern (z.B. falsch gebucht)
	moveEntry: async ({ params, request, locals }) => {
		const location = getLocation(params.id);
		const result = moveStockEntryFromForm(
			await request.formData(),
			{ locationId: location.id },
			locals.user?.username ?? null
		);
		if (!result.ok) return fail(result.status, { message: result.message });
		return { moved: true, targetName: result.targetName };
	}
};
