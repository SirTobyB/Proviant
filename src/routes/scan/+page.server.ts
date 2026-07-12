import { db } from '$lib/server/db';
import { articles, storageLocations } from '$lib/server/db/schema';
import { bookIn, bookOut } from '$lib/server/stock';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return {
		locations: db.select().from(storageLocations).orderBy(storageLocations.sortOrder).all()
	};
};

function parseBooking(formData: FormData) {
	const articleId = Number(formData.get('articleId'));
	const quantity = Number(formData.get('quantity'));
	const article = Number.isInteger(articleId)
		? db.select().from(articles).where(eq(articles.id, articleId)).get()
		: undefined;
	if (!article) return { error: 'Artikel nicht gefunden' } as const;
	if (!Number.isInteger(quantity) || quantity < 1) {
		return { error: 'Anzahl muss mindestens 1 sein' } as const;
	}
	return { article, quantity } as const;
}

export const actions: Actions = {
	einbuchen: async ({ request, locals }) => {
		const formData = await request.formData();
		const parsed = parseBooking(formData);
		if ('error' in parsed) return fail(400, { message: parsed.error });

		const locationId = Number(formData.get('locationId'));
		if (!Number.isInteger(locationId) || locationId < 1) {
			return fail(400, { message: 'Bitte einen Lagerort wählen' });
		}
		const bestBeforeRaw = formData.get('bestBefore');
		const bestBefore =
			typeof bestBeforeRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bestBeforeRaw)
				? bestBeforeRaw
				: null;

		bookIn(parsed.article.id, locationId, parsed.quantity, bestBefore, locals.user?.username ?? null);
		return { booked: 'in' as const, articleName: parsed.article.name, quantity: parsed.quantity };
	},

	ausbuchen: async ({ request, locals }) => {
		const parsed = parseBooking(await request.formData());
		if ('error' in parsed) return fail(400, { message: parsed.error });

		const booked = bookOut(parsed.article.id, parsed.quantity, locals.user?.username ?? null);
		if (booked === 0) return fail(400, { message: 'Kein Bestand zum Ausbuchen vorhanden' });
		return { booked: 'out' as const, articleName: parsed.article.name, quantity: booked };
	}
};
