import { db } from '$lib/server/db';
import { translator, type Translate } from '$lib/i18n';
import { articles, stockEntries, storageLocations } from '$lib/server/db/schema';
import { activeLocationsExcept } from '$lib/server/locations';
import { moveStockEntryFromForm, updateStockEntryFromForm } from '$lib/server/stock';
import { eq } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function getLocation(id: string, t: Translate) {
	const locationId = Number(id);
	if (!Number.isInteger(locationId)) throw error(404, t('msg.locationNotFound'));
	const location = db.select().from(storageLocations).where(eq(storageLocations.id, locationId)).get();
	if (!location) throw error(404, t('msg.locationNotFound'));
	return location;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const t = translator(locals.locale);
	const location = getLocation(params.id, t);

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
		otherLocations: activeLocationsExcept(location.id)
	};
};

export const actions: Actions = {
	updateEntry: async ({ params, request, locals }) => {
		const t = translator(locals.locale);
		const location = getLocation(params.id, t);
		const scope = { locationId: location.id };
		const result = updateStockEntryFromForm(
			await request.formData(),
			scope,
			locals.user?.username ?? null,
			t
		);
		if (!result.ok) return fail(result.status, { message: result.message });
		return { ok: true };
	},

	// Charge komplett in einen anderen Lagerort umlagern (z.B. falsch gebucht)
	moveEntry: async ({ params, request, locals }) => {
		const t = translator(locals.locale);
		const location = getLocation(params.id, t);
		const result = moveStockEntryFromForm(
			await request.formData(),
			{ locationId: location.id },
			locals.user?.username ?? null,
			t
		);
		if (!result.ok) return fail(result.status, { message: result.message });
		return { moved: true, targetName: result.targetName };
	}
};
