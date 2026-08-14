/**
 * Reine Normalisierung von Picnic-Lieferdaten in eine Sollliste.
 * Bewusst ohne SvelteKit-/Client-Abhängigkeiten, damit unabhängig testbar.
 */

export type DeliveryChecklistItem = {
	productId: string;
	name: string;
	imageId: string | null;
	unitQuantity: string;
	/** Noch zu erwartende Gebinde: bestellt abzüglich der von Picnic stornierten. */
	quantity: number;
	/** Ursprünglich bestellte Anzahl (aus dem QUANTITY-Decorator). */
	orderedQuantity: number;
	/** Von Picnic als nicht geliefert gemeldete Anzahl. */
	cancelledQuantity: number;
	/** Grund laut Picnic, z.B. `PRODUCT_NOT_SHIPPED`; null, wenn nicht genannt. */
	cancelReason: string | null;
};

/** Von Picnic gemeldeter Lieferausfall einer Position. */
export type DeliveryIssue = { quantity: number; reason: string | null };

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
 * Von Picnic gemeldete Lieferausfälle je Artikel-ID.
 *
 * Sitzt **an der Lieferung**, nicht an der Bestellposition: Die Position selbst
 * sieht unverändert aus (voller QUANTITY-Decorator, voller Preis), nur dieser
 * Decorator verrät, dass etwas nicht mitkam. Live geprüft; in den Typen der
 * `picnic-api` fehlt er (dort steht nur ein anders geformtes
 * `ARTICLE_DELIVERY_FAILURES`) — deshalb defensiv parsen und im Zweifel nichts
 * melden, statt eine bestellte Position fälschlich als storniert zu führen.
 */
export function deliveryIssues(decorators: unknown): Map<string, DeliveryIssue> {
	const result = new Map<string, DeliveryIssue>();
	if (!Array.isArray(decorators)) return result;

	for (const decorator of decorators) {
		if (decorator?.type !== 'ARTICLE_DELIVERY_ISSUES') continue;
		if (!Array.isArray(decorator.issues)) continue;
		for (const issue of decorator.issues) {
			const articleId = typeof issue?.article_id === 'string' ? issue.article_id : null;
			if (!articleId) continue;
			// Menge fehlt oder ist unbrauchbar → eine Einheit annehmen, das ist der
			// Regelfall und untertreibt eher, als zu viel abzuziehen
			const raw = Number(issue.quantity);
			const quantity = Number.isInteger(raw) && raw > 0 ? raw : 1;
			const reason = typeof issue.reason?.type === 'string' ? issue.reason.type : null;
			const existing = result.get(articleId);
			if (existing) {
				existing.quantity += quantity;
				existing.reason ??= reason;
			} else {
				result.set(articleId, { quantity, reason });
			}
		}
	}
	return result;
}

/**
 * Aggregiert alle Positionen sämtlicher (Teil-)Bestellungen einer Lieferung
 * je Produkt-ID und summiert die Mengen.
 *
 * `decorators` sind die Decorators der **Lieferung** (nicht der Bestellung):
 * daraus stammen die Storno-Meldungen, die vom Soll abgezogen werden.
 */
export function aggregateChecklist(
	orders: Order[] | undefined,
	decorators?: unknown
): DeliveryChecklistItem[] {
	const byProduct = new Map<string, DeliveryChecklistItem>();
	for (const order of orders ?? []) {
		for (const line of order.items ?? []) {
			const article = line.items?.[0];
			if (!article?.id) continue;
			const quantity = lineQuantity(article.decorators);
			const existing = byProduct.get(article.id);
			if (existing) {
				existing.orderedQuantity += quantity;
			} else {
				byProduct.set(article.id, {
					productId: article.id,
					name: article.name ?? article.id,
					imageId: article.image_ids?.[0] ?? null,
					unitQuantity: article.unit_quantity ?? '',
					quantity: 0,
					orderedQuantity: quantity,
					cancelledQuantity: 0,
					cancelReason: null
				});
			}
		}
	}

	// Storno erst nach der Aggregation abziehen: Picnic meldet je Artikel, die
	// Bestellung kann denselben Artikel aber über mehrere Teilbestellungen führen
	const issues = deliveryIssues(decorators);
	for (const item of byProduct.values()) {
		const issue = issues.get(item.productId);
		item.cancelledQuantity = Math.min(issue?.quantity ?? 0, item.orderedQuantity);
		item.cancelReason = item.cancelledQuantity > 0 ? (issue?.reason ?? null) : null;
		item.quantity = item.orderedQuantity - item.cancelledQuantity;
	}

	return [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
