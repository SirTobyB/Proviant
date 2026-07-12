import { db } from '$lib/server/db';
import { articles, storageLocations } from '$lib/server/db/schema';
import { getConnectionState, getDeliveryChecklist } from '$lib/server/picnic';
import { bookIn } from '$lib/server/stock';
import { eq } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	if (getConnectionState() !== 'connected') {
		throw error(403, 'Nicht mit Picnic verbunden');
	}

	let checklist;
	try {
		checklist = await getDeliveryChecklist(params.id);
	} catch (err) {
		throw error(502, err instanceof Error ? err.message : 'Lieferung konnte nicht geladen werden');
	}

	// Picnic-Produkte mit unserem Artikelstamm verknüpfen (über picnicId)
	const linked = db
		.select({
			id: articles.id,
			picnicId: articles.picnicId,
			ean: articles.ean,
			imagePath: articles.imagePath,
			defaultLocationId: articles.defaultLocationId
		})
		.from(articles)
		.all();
	const byPicnicId = new Map(linked.filter((a) => a.picnicId).map((a) => [a.picnicId!, a]));

	const items = checklist.map((item) => {
		const article = byPicnicId.get(item.productId);
		return {
			...item,
			articleId: article?.id ?? null,
			ean: article?.ean ?? null,
			imagePath: article?.imagePath ?? null,
			defaultLocationId: article?.defaultLocationId ?? null
		};
	});

	return {
		deliveryId: params.id,
		items,
		locations: db.select().from(storageLocations).orderBy(storageLocations.sortOrder).all()
	};
};

export const actions: Actions = {
	// Bucht ein einzelnes gescanntes Gebinde beim Auspacken ein
	book: async ({ request, locals }) => {
		const formData = await request.formData();
		const articleId = Number(formData.get('articleId'));
		const locationId = Number(formData.get('locationId'));
		const quantity = Number(formData.get('quantity') ?? 1);

		const article = Number.isInteger(articleId)
			? db.select().from(articles).where(eq(articles.id, articleId)).get()
			: undefined;
		if (!article) return fail(400, { message: 'Artikel nicht gefunden' });
		if (!Number.isInteger(locationId) || locationId < 1) {
			return fail(400, { message: 'Bitte einen Ziel-Lagerort wählen' });
		}
		if (!Number.isInteger(quantity) || quantity < 1) {
			return fail(400, { message: 'Ungültige Anzahl' });
		}

		const bestBeforeRaw = formData.get('bestBefore');
		const bestBefore =
			typeof bestBeforeRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bestBeforeRaw)
				? bestBeforeRaw
				: null;

		bookIn(article.id, locationId, quantity, bestBefore, locals.user?.username ?? null);
		return { booked: true, articleId, quantity };
	},

	// Sichtprüfung: mehrere offene Positionen auf einmal einbuchen.
	// items = [{ productId, quantity }] (die noch offenen, verknüpften Positionen).
	// Jede Position landet im Standard-Lagerort ihres Artikels, sonst im Fallback.
	confirmAll: async ({ request, locals }) => {
		const formData = await request.formData();
		const fallbackLocationId = Number(formData.get('fallbackLocationId')) || null;
		let requested: { productId: string; quantity: number }[] = [];
		try {
			const raw = JSON.parse(String(formData.get('items') ?? '[]'));
			if (Array.isArray(raw)) requested = raw;
		} catch {
			return fail(400, { message: 'Ungültige Positionsliste' });
		}

		// Picnic-ID → eigener Artikel (mit Standard-Lagerort)
		const linked = db
			.select({
				id: articles.id,
				name: articles.name,
				picnicId: articles.picnicId,
				defaultLocationId: articles.defaultLocationId
			})
			.from(articles)
			.all();
		const byPicnicId = new Map(linked.filter((a) => a.picnicId).map((a) => [a.picnicId!, a]));

		const user = locals.user?.username ?? null;
		let booked = 0;
		const noLocation: string[] = [];
		for (const req of requested) {
			const article = byPicnicId.get(String(req.productId));
			const qty = Number(req.quantity);
			if (!article || !Number.isInteger(qty) || qty < 1) continue;
			const locationId = article.defaultLocationId ?? fallbackLocationId;
			if (!locationId) {
				noLocation.push(article.name);
				continue;
			}
			bookIn(article.id, locationId, qty, null, user);
			booked += qty;
		}
		return { confirmedAll: true, booked, noLocation };
	}
};
