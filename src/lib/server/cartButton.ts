/**
 * Serverseite des Warenkorb-Knopfs (`CartButton`) — geteilt von Artikelliste,
 * Artikelseite und Angebotsseite.
 */
import { db } from '#lib/server/db/index.js';
import { articles } from '#lib/server/db/schema.js';
import { translator, type Locale } from '#lib/i18n/index.js';
import { describePicnicError, getCartQuantities, getConnectionState } from '#lib/server/picnic/index.js';
import { addArticleToCart } from '#lib/server/cartActions.js';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

/**
 * Warenkorbmengen je Picnic-ID für die Anzeige „n im Warenkorb“. `null`, wenn
 * Picnic nicht verbunden oder nicht erreichbar ist — die Knöpfe sind dann
 * gesperrt, die Seite selbst funktioniert weiter.
 */
export async function cartQuantitiesForPage(): Promise<Record<string, number> | null> {
	if (getConnectionState() !== 'connected') return null;
	try {
		return Object.fromEntries(await getCartQuantities());
	} catch {
		return null;
	}
}

/** Action `addToCart`: eine Packung des Artikels in den Picnic-Warenkorb. */
export async function addToCartAction(request: Request, locale: Locale) {
	const t = translator(locale);
	const id = Number((await request.formData()).get('articleId'));
	const article = Number.isInteger(id)
		? db.select({ picnicId: articles.picnicId }).from(articles).where(eq(articles.id, id)).get()
		: undefined;
	if (!article) return fail(400, { cartMessage: t('msg.articleNotFound') });
	if (!article.picnicId) return fail(400, { cartMessage: t('cart.linkFirst') });
	try {
		const result = await addArticleToCart(article.picnicId);
		return result === 'ok' ? { cartAdded: id } : fail(409, { cartMessage: t('order.cart.notApplied') });
	} catch (err) {
		return fail(502, { cartMessage: describePicnicError(err, t, 'In den Warenkorb legen') });
	}
}
