import { db } from '$lib/server/db';
import { articles, stockEntries, storageLocations } from '$lib/server/db/schema';
import { auditEdit } from '$lib/server/audit';
import { moveStockEntry } from '$lib/server/stock';
import { and, eq, sql } from 'drizzle-orm';
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

/** Lädt eine Charge und stellt sicher, dass sie zu diesem Lagerort gehört. */
function getEntry(locationId: number, entryId: unknown) {
	const id = Number(entryId);
	if (!Number.isInteger(id)) return null;
	return db
		.select()
		.from(stockEntries)
		.where(and(eq(stockEntries.id, id), eq(stockEntries.locationId, locationId)))
		.get();
}

export const actions: Actions = {
	updateEntry: async ({ params, request, locals }) => {
		const location = getLocation(params.id);
		const formData = await request.formData();
		const entry = getEntry(location.id, formData.get('entryId'));
		if (!entry) return fail(404, { message: 'Charge nicht gefunden' });

		const quantity = Number(formData.get('quantity'));
		if (!Number.isInteger(quantity) || quantity < 0) {
			return fail(400, { message: 'Anzahl ist ungültig' });
		}
		const bestBeforeRaw = formData.get('bestBefore');
		const bestBefore =
			typeof bestBeforeRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bestBeforeRaw)
				? bestBeforeRaw
				: null;

		if (quantity === 0) {
			db.delete(stockEntries).where(eq(stockEntries.id, entry.id)).run();
		} else {
			db.update(stockEntries)
				.set({ quantity, bestBefore, ...auditEdit(locals.user?.username) })
				.where(eq(stockEntries.id, entry.id))
				.run();
		}
		return { ok: true };
	},

	// Charge komplett in einen anderen Lagerort umlagern (z.B. falsch gebucht)
	moveEntry: async ({ params, request, locals }) => {
		const location = getLocation(params.id);
		const formData = await request.formData();
		const entry = getEntry(location.id, formData.get('entryId'));
		if (!entry) return fail(404, { message: 'Charge nicht gefunden' });

		const targetLocationId = Number(formData.get('targetLocationId'));
		if (!Number.isInteger(targetLocationId) || targetLocationId === location.id) {
			return fail(400, { message: 'Bitte einen anderen Ziel-Lagerort wählen' });
		}
		const target = db.select().from(storageLocations).where(eq(storageLocations.id, targetLocationId)).get();
		if (!target) return fail(400, { message: 'Ziel-Lagerort nicht gefunden' });

		moveStockEntry(entry.id, targetLocationId, locals.user?.username ?? null);
		return { moved: true, targetName: target.name };
	}
};
