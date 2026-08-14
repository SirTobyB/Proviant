import { db } from '$lib/server/db';
import { translator } from '$lib/i18n';
import { articles } from '$lib/server/db/schema';
import { activeLocation, activeLocations } from '$lib/server/locations';
import { getConnectionState, getDeliveryChecklist } from '$lib/server/picnic';
import { importArticleFromPicnic } from '$lib/server/articleImport';
import { bookIn } from '$lib/server/stock';
import { eq } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const t = translator(locals.locale);
	if (getConnectionState() !== 'connected') {
		throw error(403, t('msg.notConnected'));
	}

	let checklist;
	try {
		checklist = await getDeliveryChecklist(params.id);
	} catch (err) {
		throw error(502, err instanceof Error ? err.message : t('msg.notConnected'));
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
		locations: activeLocations()
	};
};

/**
 * Ziel einer Lieferungs-Buchung: der Standard-Lagerort des Artikels, sonst der
 * auf der Seite gewählte Ziel-Lagerort — beide nur, solange sie aktiv sind.
 * Ein stillgelegter Lagerort ist wie gelöscht und darf nichts mehr aufnehmen.
 */
function deliveryLocationId(defaultLocationId: number | null, fallbackId: number | null): number | null {
	if (defaultLocationId != null && activeLocation(defaultLocationId)) return defaultLocationId;
	return fallbackId != null && activeLocation(fallbackId) ? fallbackId : null;
}

export const actions: Actions = {
	// Bucht ein einzelnes gescanntes Gebinde beim Auspacken ein
	book: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		const articleId = Number(formData.get('articleId'));
		const locationId = Number(formData.get('locationId'));
		const quantity = Number(formData.get('quantity') ?? 1);

		const article = Number.isInteger(articleId)
			? db.select().from(articles).where(eq(articles.id, articleId)).get()
			: undefined;
		if (!article) return fail(400, { message: t('msg.articleNotFound') });
		if (!Number.isInteger(locationId) || !activeLocation(locationId)) {
			return fail(400, { message: t('msg.pickTargetLocation') });
		}
		if (!Number.isInteger(quantity) || quantity < 1) {
			return fail(400, { message: t('msg.invalidQuantity') });
		}

		const bestBeforeRaw = formData.get('bestBefore');
		const bestBefore =
			typeof bestBeforeRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bestBeforeRaw)
				? bestBeforeRaw
				: null;

		bookIn(article.id, locationId, quantity, bestBefore, locals.user?.username ?? null, 'lieferung');
		return { booked: true, articleId, quantity };
	},

	// Sichtprüfung: mehrere offene Positionen auf einmal einbuchen.
	// items = [{ productId, quantity, name, unitQuantity, imageId }] (alle noch
	// offenen Positionen). Noch nicht im Artikelstamm vorhandene Produkte werden
	// vorher automatisch aus Picnic angelegt (idempotent per picnicId-Dedupe).
	// Jede Position landet im Standard-Lagerort ihres Artikels, sonst im Fallback.
	confirmAll: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		const fallbackLocationId = Number(formData.get('fallbackLocationId')) || null;
		let requested: {
			productId: string;
			quantity: number;
			name?: string;
			unitQuantity?: string;
			imageId?: string | null;
		}[] = [];
		try {
			const raw = JSON.parse(String(formData.get('items') ?? '[]'));
			if (Array.isArray(raw)) requested = raw;
		} catch {
			return fail(400, { message: t('msg.invalidLineList') });
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
		let imported = 0;
		const noLocation: string[] = [];
		const failed: string[] = [];
		for (const req of requested) {
			const qty = Number(req.quantity);
			if (!Number.isInteger(qty) || qty < 1) continue;
			const reqName = String(req.name ?? '').trim();
			// Fehler pro Position abfangen: Ein Abbruch mitten im Loop würde als
			// 500 enden, obwohl frühere Positionen schon gebucht sind — ein
			// Retry würde die dann doppelt buchen.
			try {
				let article = byPicnicId.get(String(req.productId));
				let articleId: number;
				let defaultLocationId: number | null;
				let articleName: string;
				if (article) {
					articleId = article.id;
					defaultLocationId = article.defaultLocationId;
					articleName = article.name;
				} else {
					// Artikel fehlt im Stamm: automatisch aus Picnic anlegen
					if (!reqName) continue;
					const result = await importArticleFromPicnic(
						{
							productId: String(req.productId),
							name: reqName,
							unitQuantity: String(req.unitQuantity ?? ''),
							imageId: String(req.imageId ?? '') || null
						},
						null,
						user
					);
					articleId = result.articleId;
					defaultLocationId = null;
					articleName = reqName;
					if (result.created) imported += 1;
				}
				const locationId = deliveryLocationId(defaultLocationId, fallbackLocationId);
				if (!locationId) {
					noLocation.push(articleName);
					continue;
				}
				bookIn(articleId, locationId, qty, null, user, 'lieferung');
				booked += qty;
			} catch {
				failed.push(reqName || String(req.productId));
			}
		}
		return { confirmedAll: true, booked, imported, noLocation, failed };
	},

	// Manuelle Bestätigung einer einzelnen Position ("+"-Taste): bucht 1 Gebinde
	// ein und legt den Artikel vorher automatisch aus Picnic an, falls er fehlt.
	bookOne: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		const productId = String(formData.get('productId') ?? '').trim();
		const name = String(formData.get('name') ?? '').trim();
		const unitQuantity = String(formData.get('unitQuantity') ?? '');
		const imageId = String(formData.get('imageId') ?? '') || null;
		const fallbackLocationId = Number(formData.get('fallbackLocationId')) || null;
		if (!productId || !name) return fail(400, { message: t('msg.invalidProduct') });

		const user = locals.user?.username ?? null;
		const existing = db.select().from(articles).where(eq(articles.picnicId, productId)).get();
		let articleId: number;
		let created = false;
		if (existing) {
			articleId = existing.id;
		} else {
			const result = await importArticleFromPicnic({ productId, name, unitQuantity, imageId }, null, user);
			articleId = result.articleId;
			created = result.created;
		}

		// Import liefert keine defaultLocationId — frisch angelegte Artikel haben keine
		const locationId = deliveryLocationId(existing?.defaultLocationId ?? null, fallbackLocationId);
		if (!locationId) return fail(400, { message: t('msg.noLocation') });
		const location = activeLocation(locationId);
		if (!location) return fail(400, { message: t('msg.locationNotFound') });

		bookIn(articleId, locationId, 1, null, user, 'lieferung');
		return { bookedOne: productId, created, locationName: location.name };
	},

	// Nicht verknüpfte Lieferposition direkt als Artikel importieren
	importArticle: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		const productId = String(formData.get('productId') ?? '').trim();
		const name = String(formData.get('name') ?? '').trim();
		const unitQuantity = String(formData.get('unitQuantity') ?? '');
		const imageId = String(formData.get('imageId') ?? '') || null;
		if (!productId || !name) return fail(400, { message: t('msg.invalidProduct') });

		const result = await importArticleFromPicnic(
			{ productId, name, unitQuantity, imageId },
			null,
			locals.user?.username ?? null
		);
		return { articleImported: name, created: result.created };
	}
};
