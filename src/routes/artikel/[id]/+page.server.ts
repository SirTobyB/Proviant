import { db } from '$lib/server/db';
import { articles, stockEntries, storageLocations } from '$lib/server/db/schema';
import { parseArticleForm } from '$lib/server/articleForm';
import { allArticleTagNames, setArticleTags, tagsForArticle } from '$lib/server/articleTags';
import { auditEdit } from '$lib/server/audit';
import { deleteImage } from '$lib/server/images';
import { moveStockEntry } from '$lib/server/stock';
import { and, eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function getArticle(id: string) {
	const articleId = Number(id);
	if (!Number.isInteger(articleId)) throw error(404, 'Artikel nicht gefunden');
	const article = db.select().from(articles).where(eq(articles.id, articleId)).get();
	if (!article) throw error(404, 'Artikel nicht gefunden');
	return article;
}

export const load: PageServerLoad = ({ params }) => {
	const article = getArticle(params.id);

	// Chargen dieses Artikels über alle Lagerorte, nach Lagerort gruppiert
	const entries = db
		.select({
			id: stockEntries.id,
			locationId: stockEntries.locationId,
			locationName: storageLocations.name,
			quantity: stockEntries.quantity,
			bestBefore: stockEntries.bestBefore
		})
		.from(stockEntries)
		.innerJoin(storageLocations, eq(storageLocations.id, stockEntries.locationId))
		.where(eq(stockEntries.articleId, article.id))
		.orderBy(storageLocations.sortOrder, stockEntries.bestBefore)
		.all();

	const byLocation = new Map<number, { locationId: number; locationName: string; entries: typeof entries }>();
	for (const entry of entries) {
		let group = byLocation.get(entry.locationId);
		if (!group) {
			group = { locationId: entry.locationId, locationName: entry.locationName, entries: [] };
			byLocation.set(entry.locationId, group);
		}
		group.entries.push(entry);
	}

	return {
		article,
		tags: tagsForArticle(article.id),
		stock: [...byLocation.values()],
		locations: db.select().from(storageLocations).orderBy(storageLocations.sortOrder).all(),
		allTags: allArticleTagNames()
	};
};

/** Lädt eine Charge und stellt sicher, dass sie zu diesem Artikel gehört. */
function getEntry(articleId: number, entryId: unknown) {
	const id = Number(entryId);
	if (!Number.isInteger(id)) return null;
	return db
		.select()
		.from(stockEntries)
		.where(and(eq(stockEntries.id, id), eq(stockEntries.articleId, articleId)))
		.get();
}

export const actions: Actions = {
	update: async ({ params, request, locals }) => {
		const user = locals.user?.username ?? null;
		const article = getArticle(params.id);
		const { values, imagePath, tags, error: message } = await parseArticleForm(await request.formData());
		if (message) return fail(400, { message });

		try {
			db.update(articles)
				.set({
					...values,
					...(imagePath !== undefined ? { imagePath } : {}),
					...auditEdit(user)
				})
				.where(eq(articles.id, article.id))
				.run();
		} catch (err) {
			if (err instanceof Error && err.message.includes('UNIQUE constraint failed: articles.ean')) {
				return fail(400, { message: `Ein Artikel mit der EAN ${values.ean} existiert bereits` });
			}
			throw err;
		}
		setArticleTags(article.id, tags, user);

		// Altes Bild erst nach erfolgreichem Update entfernen
		if (imagePath !== undefined && article.imagePath) deleteImage(article.imagePath);

		redirect(303, '/artikel');
	},

	delete: ({ params }) => {
		const article = getArticle(params.id);
		db.delete(articles).where(eq(articles.id, article.id)).run();
		deleteImage(article.imagePath);
		redirect(303, '/artikel');
	},

	// Charge bearbeiten (Anzahl/MHD); Anzahl 0 löscht die Charge.
	// Fehler bewusst als entryMessage — form.message gehört dem Artikelformular.
	updateEntry: async ({ params, request, locals }) => {
		const article = getArticle(params.id);
		const formData = await request.formData();
		const entry = getEntry(article.id, formData.get('entryId'));
		if (!entry) return fail(404, { entryMessage: 'Charge nicht gefunden' });

		const quantity = Number(formData.get('quantity'));
		if (!Number.isInteger(quantity) || quantity < 0) {
			return fail(400, { entryMessage: 'Anzahl ist ungültig' });
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

	// Charge in einen anderen Lagerort umlagern (merged in gleiche-MHD-Charge am Ziel)
	moveEntry: async ({ params, request, locals }) => {
		const article = getArticle(params.id);
		const formData = await request.formData();
		const entry = getEntry(article.id, formData.get('entryId'));
		if (!entry) return fail(404, { entryMessage: 'Charge nicht gefunden' });

		const targetLocationId = Number(formData.get('targetLocationId'));
		if (!Number.isInteger(targetLocationId) || targetLocationId === entry.locationId) {
			return fail(400, { entryMessage: 'Bitte einen anderen Ziel-Lagerort wählen' });
		}
		const target = db.select().from(storageLocations).where(eq(storageLocations.id, targetLocationId)).get();
		if (!target) return fail(400, { entryMessage: 'Ziel-Lagerort nicht gefunden' });

		moveStockEntry(entry.id, targetLocationId, locals.user?.username ?? null);
		return { moved: true, targetName: target.name };
	}
};
