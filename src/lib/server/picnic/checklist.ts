/**
 * Reine Normalisierung von Picnic-Lieferdaten in eine Sollliste.
 * Bewusst ohne SvelteKit-/Client-Abhängigkeiten, damit unabhängig testbar.
 */

export type DeliveryChecklistItem = {
	productId: string;
	name: string;
	imageId: string | null;
	unitQuantity: string;
	/** Bestellte Anzahl Gebinde (aus dem QUANTITY-Decorator). */
	quantity: number;
};

type Decorator = { type: string; quantity?: number | string };
type OrderArticle = {
	id?: string;
	name?: string;
	image_ids?: string[];
	unit_quantity?: string;
	decorators?: Decorator[];
};
type OrderLine = { items?: OrderArticle[] };
type Order = { items?: OrderLine[] };

/** Menge einer Bestellposition steckt im QUANTITY-Decorator, nicht in items.length. */
export function lineQuantity(decorators: Decorator[] | undefined): number {
	const quantityDecorator = decorators?.find((d) => d.type === 'QUANTITY');
	return typeof quantityDecorator?.quantity === 'number' ? quantityDecorator.quantity : 1;
}

/**
 * Aggregiert alle Positionen sämtlicher (Teil-)Bestellungen einer Lieferung
 * je Produkt-ID und summiert die Mengen.
 */
export function aggregateChecklist(orders: Order[] | undefined): DeliveryChecklistItem[] {
	const byProduct = new Map<string, DeliveryChecklistItem>();
	for (const order of orders ?? []) {
		for (const line of order.items ?? []) {
			const article = line.items?.[0];
			if (!article?.id) continue;
			const quantity = lineQuantity(article.decorators);
			const existing = byProduct.get(article.id);
			if (existing) {
				existing.quantity += quantity;
			} else {
				byProduct.set(article.id, {
					productId: article.id,
					name: article.name ?? article.id,
					imageId: article.image_ids?.[0] ?? null,
					unitQuantity: article.unit_quantity ?? '',
					quantity
				});
			}
		}
	}
	return [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
