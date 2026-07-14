/**
 * Anlage eines Artikels aus einem Picnic-Produkt (Bulk-Import aus Lieferungen
 * und Einzelimport beim Auspacken).
 */
import { db } from '$lib/server/db';
import { articles } from '$lib/server/db/schema';
import { auditNew } from '$lib/server/audit';
import { saveImageFromDataUri } from '$lib/server/images';
import { getProductImage } from '$lib/server/picnic';
import { parseUnitQuantity } from '$lib/server/picnic/unitQuantity';
import { eq } from 'drizzle-orm';

export type PicnicProductInput = {
	productId: string;
	name: string;
	unitQuantity: string;
	imageId: string | null;
};

export type ImportResult = { articleId: number; created: boolean };

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

	return { articleId, created: true };
}
