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
// Deep import wie in `picnic/index.ts`: Bewusst **dieselbe** Suchfunktion wie
// die Bibliothek, damit unser Streichpreis exakt in dem Bereich gesucht wird,
// aus dem `extractProductDetails` auch den aktuellen Preis liest. Eine eigene
// Nachbildung könnte hier auseinanderdriften, und genau das wäre der Bug.
import { findById } from 'picnic-api/lib/domains/catalog/helpers';

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
 * Container, auf den `extractProductDetails` seine **Preis**-Auswertung
 * beschränkt (siehe node_modules/picnic-api/lib/domains/catalog/helpers.js).
 */
const MAIN_CONTAINER_ID = 'product-details-page-root-main-container';

/**
 * Der Seitenbereich, der wirklich zum angefragten Produkt gehört.
 *
 * Nötig, weil `extractProductDetails` den Preis auf diesen Container begrenzt,
 * die `promotion` aber über die **ganze** Seite sucht: Ein Angebot einer
 * Nachbarkachel („Ähnliche Produkte") kann die Aktionsprüfung also auslösen,
 * obwohl das Produkt selbst nicht rabattiert ist. Suchten wir den Streichpreis
 * dann seitenweit, entstünde ein erfundener Rabatt mit überhöhtem Normalpreis.
 *
 * Fehlt der Container, bleibt es bei der ganzen Seite — dieselbe Wahl trifft
 * die Bibliothek, und ein leeres Ergebnis wäre hier schlechter als ein
 * unscharfes.
 */
function priceScope(page: unknown): unknown {
	const body = (page as { layout?: { body?: unknown } } | null)?.layout?.body;
	if (body == null) return page;
	try {
		return findById(body, MAIN_CONTAINER_ID) ?? page;
	} catch {
		// Die PML-Struktur ist dynamisch — im Zweifel lieber die ganze Seite
		return page;
	}
}

/**
 * Durchgestrichener Originalpreis eines rabattierten Produkts aus der **rohen**
 * Produktseite. `getProductDetails()` kennt ihn nicht, `search()` liefert
 * leere Decorators — diese Seite ist die einzige Quelle.
 *
 * Gesucht wird nur im Hauptcontainer des Produkts (siehe `priceScope`), dort
 * der erste Treffer in Dokumentreihenfolge. Ohne Rabatt gibt es gar keine
 * PRICE-Komponente — dann `null`.
 */
export function crossedOutPrice(page: unknown, currentPrice: number): number | null {
	if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;
	for (const node of priceNodes(priceScope(page))) {
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
