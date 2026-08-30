/**
 * Reine Deutung der Picnic-Preisstrukturen. Ohne Netz und ohne
 * SvelteKit-Import, damit eigenständig testbar.
 *
 * ACHTUNG — es gibt **zwei Quellen mit gegenläufigen Regeln** (beide live
 * geprüft, siehe CLAUDE.md):
 *
 *   ORDER_LINE:    line.price = Streichpreis, PRICE-Decorator = gezahlter Preis
 *   Katalogseite:  displayPrice = gezahlter Preis, PRICE-Knoten mit
 *                  isCrossed = Streichpreis
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

type PriceNode = { price: number; isCrossed: boolean };

/**
 * Sammelt alle `{ type: "PRICE", price: number }`-Knoten der Seite in
 * Dokumentreihenfolge. Tiefenbegrenzt, weil die PML-Strukturen dynamisch sind
 * und wir uns nicht auf ihre Form verlassen können.
 */
function priceNodes(node: unknown, out: PriceNode[] = [], depth = 0): PriceNode[] {
	if (depth > 40 || node == null || typeof node !== 'object') return out;
	if (Array.isArray(node)) {
		for (const value of node) priceNodes(value, out, depth + 1);
		return out;
	}
	const record = node as Record<string, unknown>;
	if (record.type === 'PRICE' && typeof record.price === 'number') {
		out.push({ price: record.price, isCrossed: record.isCrossed === true });
	}
	for (const value of Object.values(record)) priceNodes(value, out, depth + 1);
	return out;
}

/**
 * Durchgestrichener Originalpreis eines rabattierten Produkts aus der **rohen**
 * Produktseite. `getProductDetails()` kennt ihn nicht, `search()` liefert
 * leere Decorators — diese Seite ist die einzige Quelle.
 *
 * Nimmt den ersten Treffer in Dokumentreihenfolge: der Hauptpreisblock steht
 * vorn, weiter hinten folgen Ähnliche-Produkte-Kacheln mit eigenen Preisen.
 * Ohne Rabatt gibt es gar keine PRICE-Komponente — dann `null`.
 */
export function crossedOutPrice(page: unknown, currentPrice: number): number | null {
	if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;
	for (const node of priceNodes(page)) {
		// Nur ein echt höherer Streichpreis ist ein Rabatt
		if (node.isCrossed && node.price > currentPrice) return node.price;
	}
	return null;
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
