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
import { offerFromLabel, type PriceTier } from '#lib/offers.js';

export type ProductPrice = {
	/** Normalpreis in Cent (der Streichpreis). */
	regularPrice: number;
	/** Aktionspreis in Cent; `null` = kein Rabatt. */
	promoPrice: number | null;
	/** Beschriftung der Aktion, z.B. „10% Rabatt". Reine Anzeige. */
	promoLabel: string | null;
};

/**
 * Preis von der Katalogseite: zusätzlich Mehrfachangebot und Preisstaffeln.
 * Ein Mehrfachangebot („2 für 4.99€“) steht als Stückpreis in `promoPrice`
 * und gilt erst ab `promoMinQuantity` Packungen.
 */
export type CatalogPrice = ProductPrice & {
	/** Mindestmenge, ab der `promoPrice` gilt; `null` = ab einer Packung. */
	promoMinQuantity: number | null;
	/** Staffelpreise ab der zweiten Stufe; `null` = keine Staffel. */
	priceRanges: PriceTier[] | null;
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
	priceRanges?: unknown;
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
export function catalogPrice(product: CatalogProductPrices | null | undefined): CatalogPrice | null {
	const label = typeof product?.promotion?.label === 'string' ? product.promotion.label : null;
	return interpret(product?.displayPrice, product?.originalPrice, label ? [label] : [], product?.priceRanges, label);
}

/**
 * Preis einer **Produktkachel** (Angebotsseite, Aktionsgruppen, Ersatzvorschläge).
 * Dieselbe Regel wie `catalogPrice`; die Aktion steht hier aber nicht in
 * `promotion`, sondern zwischen anderen Beschriftungen („Bio“, „2+1 gratis“).
 */
export function tilePrice(tile: unknown): CatalogPrice | null {
	if (tile == null || typeof tile !== 'object') return null;
	const record = tile as { displayPrice?: unknown; originalPrice?: unknown; labels?: unknown; priceRanges?: unknown };
	const labels = Array.isArray(record.labels)
		? record.labels.map((l: unknown) => (l as { text?: unknown } | null)?.text).filter((t): t is string => typeof t === 'string')
		: [];
	return interpret(record.displayPrice, record.originalPrice, labels, record.priceRanges, null);
}

/** Angebotsbeschriftungen enthalten Zahlen („20% Rabatt“), Siegel wie „Bio“ nicht. */
function offerLabel(labels: string[]): string | null {
	return labels.find((label) => /\d/.test(label)) ?? null;
}

function tiers(raw: unknown): PriceTier[] | null {
	if (!Array.isArray(raw)) return null;
	const result = raw
		.map((r: unknown) => r as { price?: unknown; from_quantity?: unknown } | null)
		.filter(
			(r): r is { price: number; from_quantity: number } =>
				typeof r?.price === 'number' && r.price > 0 && typeof r.from_quantity === 'number' && r.from_quantity >= 2
		)
		.map((r) => ({ fromQuantity: r.from_quantity, unitPrice: r.price }))
		.sort((a, b) => a.fromQuantity - b.fromQuantity);
	return result.length > 0 ? result : null;
}

function interpret(
	displayPrice: unknown,
	originalPrice: unknown,
	labels: string[],
	priceRanges: unknown,
	fallbackLabel: string | null
): CatalogPrice | null {
	if (typeof displayPrice !== 'number' || !Number.isFinite(displayPrice) || displayPrice <= 0) return null;
	const ranges = tiers(priceRanges);

	// Echter Streichpreis: der Einzelrabatt steht fest
	if (typeof originalPrice === 'number' && originalPrice > displayPrice) {
		return {
			regularPrice: originalPrice,
			promoPrice: displayPrice,
			promoLabel: offerLabel(labels) ?? fallbackLabel,
			promoMinQuantity: null,
			priceRanges: ranges
		};
	}

	// Kein Streichpreis: höchstens ein Mehrfachangebot, dann ist displayPrice
	// der Normalpreis (live geprüft an „2 für …“, „n+1 gratis“, „auf 2. Artikel“)
	for (const label of labels) {
		const offer = offerFromLabel(label, displayPrice);
		if (offer) {
			return {
				regularPrice: displayPrice,
				promoPrice: offer.unitPrice,
				promoLabel: label,
				promoMinQuantity: offer.minQuantity,
				priceRanges: ranges
			};
		}
	}

	// Aktion gemeldet, aber nicht deutbar: Beschriftung behalten, Ersparnis
	// weglassen. Lieber kein Rabatt als ein erfundener.
	return { regularPrice: displayPrice, promoPrice: null, promoLabel: fallbackLabel, promoMinQuantity: null, priceRanges: ranges };
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
