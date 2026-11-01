/**
 * Anlage eines Artikels aus einem Picnic-Produkt (Bulk-Import aus Lieferungen
 * und Einzelimport beim Auspacken).
 */
import { db } from '#lib/server/db/index.js';
import { articles } from '#lib/server/db/schema.js';
import { auditEdit, auditNew } from '#lib/server/audit.js';
import { saveImageFromDataUri } from '#lib/server/images.js';
import {
	getProductDetails,
	getProductImage,
	picnicErrorKind,
	type PicnicErrorKind,
	type ProductFacts
} from '#lib/server/picnic/index.js';
import { logWarn } from '#lib/server/log.js';
import { parseUnitQuantity } from '#lib/server/picnic/unitQuantity.js';
import { eq } from 'drizzle-orm';

export type PicnicProductInput = {
	productId: string;
	name: string;
	unitQuantity: string;
	imageId: string | null;
};

/**
 * `picnicError`: Die Produktdaten ließen sich nicht abrufen (Artikel ist
 * trotzdem angelegt). Ein Massenimport hört bei `rateLimited` & Co. auf.
 */
export type ImportResult = { articleId: number; created: boolean; picnicError?: PicnicErrorKind };

/**
 * Legt einen Artikel aus Picnic-Produktdaten an. Existiert bereits ein Artikel
 * mit derselben Picnic-ID, wird nichts angelegt (created: false).
 * Bildfehler brechen den Import nicht ab — dann kommt der Artikel ohne Bild.
 */
export async function importArticleFromPicnic(
	product: PicnicProductInput,
	defaultLocationId: number | null,
	user: string | null
): Promise<ImportResult> {
	const existing = db
		.select({ id: articles.id })
		.from(articles)
		.where(eq(articles.picnicId, product.productId))
		.get();
	if (existing) return { articleId: existing.id, created: false };

	const { amount, unit } = parseUnitQuantity(product.unitQuantity);

	let imagePath: string | null = null;
	if (product.imageId) {
		try {
			imagePath = saveImageFromDataUri(await getProductImage(product.imageId));
		} catch {
			// ohne Bild importieren
		}
	}

	const articleId = db
		.insert(articles)
		.values({
			name: product.name,
			amount,
			unit,
			picnicId: product.productId,
			imagePath,
			defaultLocationId,
			minStock: 0,
			...auditNew(user)
		})
		.returning({ id: articles.id })
		.get().id;

	// Produktdaten nachziehen; scheitert das, bleibt der Artikel eben ohne —
	// sie lassen sich später auf der Artikelseite von Picnic nachladen
	// — gedrosselt, weil Importe viele Artikel am Stück anlegen
	try {
		const { facts } = await getProductDetails(product.productId, { bulk: true });
		applyProductFacts(articleId, facts, user);
	} catch (err) {
		logWarn('Produktdaten beim Import nicht abrufbar', {
			picnicId: product.productId,
			fehler: err instanceof Error ? err.message : String(err)
		});
		return { articleId, created: true, picnicError: picnicErrorKind(err) };
	}

	return { articleId, created: true };
}

/** Schreibt Marke, Herkunft, Bio und Nährwerte von Picnic an den Artikel (überschreibt). */
export function applyProductFacts(articleId: number, facts: ProductFacts, user: string | null): void {
	db.update(articles)
		.set({
			brand: facts.brand,
			origin: facts.origin,
			organic: facts.organic,
			nutrition: facts.nutrition ? JSON.stringify(facts.nutrition) : null,
			...auditEdit(user)
		})
		.where(eq(articles.id, articleId))
		.run();
}
