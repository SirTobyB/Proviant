import { db } from '$lib/server/db';
import { translator, type Translate } from '$lib/i18n';
import { articles } from '$lib/server/db/schema';
import { activeLocation, activeLocations } from '$lib/server/locations';
import { bookIn, bookOut } from '$lib/server/stock';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { locations: activeLocations() };
};

function parseBooking(formData: FormData, t: Translate) {
	const articleId = Number(formData.get('articleId'));
	const quantity = Number(formData.get('quantity'));
	const article = Number.isInteger(articleId)
		? db.select().from(articles).where(eq(articles.id, articleId)).get()
		: undefined;
	if (!article) return { error: t('msg.articleNotFound') } as const;
	if (!Number.isInteger(quantity) || quantity < 1) {
		return { error: t('msg.invalidQuantity') } as const;
	}
	return { article, quantity } as const;
}

export const actions: Actions = {
	einbuchen: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		const parsed = parseBooking(formData, t);
		if ('error' in parsed) return fail(400, { message: parsed.error });

		// Gegen den Stammsatz prüfen: ein stillgelegter Lagerort darf auch aus
		// einem veralteten Formular heraus kein Ziel mehr sein
		const locationId = Number(formData.get('locationId'));
		if (!Number.isInteger(locationId) || !activeLocation(locationId)) {
			return fail(400, { message: t('msg.pickLocation') });
		}
		const bestBeforeRaw = formData.get('bestBefore');
		const bestBefore =
			typeof bestBeforeRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bestBeforeRaw)
				? bestBeforeRaw
				: null;

		bookIn(parsed.article.id, locationId, parsed.quantity, bestBefore, locals.user?.username ?? null, 'scan');
		return { booked: 'in' as const, articleName: parsed.article.name, quantity: parsed.quantity };
	},

	ausbuchen: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const parsed = parseBooking(await request.formData(), t);
		if ('error' in parsed) return fail(400, { message: parsed.error });

		const booked = bookOut(parsed.article.id, parsed.quantity, locals.user?.username ?? null, 'scan');
		if (booked === 0) return fail(400, { message: t('msg.nothingToBookOut') });
		return { booked: 'out' as const, articleName: parsed.article.name, quantity: booked };
	}
};
