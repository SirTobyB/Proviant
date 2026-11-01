/**
 * Reine Deutung der Picnic-Preisstrukturen. Ohne Netz und ohne
 * SvelteKit-Import, damit eigenständig testbar.
 *
 * ACHTUNG — es gibt **zwei Quellen mit gegenläufigen Regeln** (beide live
 * geprüft, siehe CLAUDE.md):
 *
 *   ORDER_LINE:    line.price = Streichpreis, PRICE-Decorator = gezahlter Preis
 *   Katalogseite:  displayPrice = gezahlter Preis, originalPrice =
 *                  Streichpreis (aus `catalog.getProduct()`)
 *
 * Die beiden Funktionen bleiben deshalb bewusst getrennt statt hinter einer
 * gemeinsamen Abstraktion — eine Zusammenlegung lüde genau zu der
 * Verwechslung ein, die hier der teuerste Fehler wäre (Rabatt als Aufschlag).
 */
export type ProductPrice = {
	/** Normalpreis in Cent (der Streichpreis). */
	regularPrice: number;
	/** Aktionspreis in Cent; `null` = kein Rabatt. */
	promoPrice: number | null;
	/** Beschriftung der Aktion, z.B. „10% Rabatt". Reine Anzeige. */
	promoLabel: string | null;
};

/**
 * Der Ausschnitt von `catalog.getProduct()`, den die Preisdeutung braucht.
 * Bewusst schmal und mit `unknown`-tauglichen Feldern: die Bibliothek parst
 * dynamische PML-Strukturen, ein Feld kann also auch einmal fehlen.
 */
export type CatalogProductPrices = {
	displayPrice?: unknown;
	originalPrice?: unknown;
	promotion?: { label?: unknown } | null;
};

/**
 * Preis eines Produkts von der **Katalogseite**: `displayPrice` ist der
 * gezahlte (ggf. rabattierte) Preis, `originalPrice` der Streichpreis.
 *
 * Seit picnic-api 5 liest die Bibliothek beides selbst aus dem Hauptcontainer
 * der Produktseite — vorher lag genau diese Eingrenzung hier, weil ein
 * Nachbarangebot („Ähnliche Produkte") sonst einen erfundenen Rabatt erzeugte.
 * Geblieben ist die Plausibilitätsprüfung: Nur ein echt **höherer**
 * Streichpreis ist ein Rabatt, alles andere wäre ein Datenfehler.
 */
export function catalogPrice(product: CatalogProductPrices | null | undefined): ProductPrice | null {
	const current = product?.displayPrice;
	if (typeof current !== 'number' || !Number.isFinite(current) || current <= 0) return null;

	const label = typeof product?.promotion?.label === 'string' ? product.promotion.label : null;
	const original = product?.originalPrice;
	const regular = typeof original === 'number' && original > current ? original : null;

	// Aktion gemeldet, aber kein Streichpreis: Beschriftung behalten, Ersparnis
	// weglassen. Lieber kein Rabatt als ein erfundener.
	return regular == null
		? { regularPrice: current, promoPrice: null, promoLabel: label }
		: { regularPrice: regular, promoPrice: current, promoLabel: label };
}

/**
 * Preis und Ersparnis einer Bestellposition (ORDER_LINE) einer Lieferung.
 *
 * `line.price` ist der **Zeilen-Gesamtpreis** zum Normalpreis, nicht der
 * Stückpreis (live geprüft: Menge 2 → price 298 bei 1,49 € je Stück). Für
 * einen Stückpreis müsste durch die QUANTITY geteilt werden; die Anzeige
 * bleibt bewusst auf Zeilenebene, dort stimmt die Zahl ohne Division.
 */
export function lineSavings(line: unknown): ProductPrice | null {
	if (line == null || typeof line !== 'object') return null;
	const record = line as { price?: unknown; decorators?: unknown };

	const regularPrice = typeof record.price === 'number' ? record.price : null;
	if (regularPrice == null || regularPrice <= 0) return null;

	const decorators = Array.isArray(record.decorators) ? record.decorators : [];
	const priceDecorator = decorators.find(
		(d: unknown) => (d as { type?: unknown } | null)?.type === 'PRICE'
	) as { display_price?: unknown } | undefined;
	const promoDecorator = decorators.find(
		(d: unknown) => (d as { type?: unknown } | null)?.type === 'PROMO'
	) as { text?: unknown } | undefined;

	const candidate =
		typeof priceDecorator?.display_price === 'number' ? priceDecorator.display_price : null;

	return {
		regularPrice,
		// Ein „Aktionspreis" über dem Normalpreis ist ein Datenfehler, kein Angebot
		promoPrice: candidate != null && candidate > 0 && candidate < regularPrice ? candidate : null,
		promoLabel: typeof promoDecorator?.text === 'string' ? promoDecorator.text : null
	};
}
