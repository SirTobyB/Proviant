/**
 * Mengen- und Einheitenlogik für Rezepte: Umrechnung in Basiseinheiten,
 * Vorrats-Deckung und Aufrunden auf Gebinde für Bestellungen.
 */

export type UnitFamily = 'mass' | 'volume' | 'count' | null;

/** Ordnet eine Einheit ihrer Familie und dem Faktor zur Basiseinheit zu. */
const UNIT_TO_BASE: Record<string, { family: Exclude<UnitFamily, null>; factor: number }> = {
	g: { family: 'mass', factor: 1 },
	kg: { family: 'mass', factor: 1000 },
	ml: { family: 'volume', factor: 1 },
	l: { family: 'volume', factor: 1000 },
	Stück: { family: 'count', factor: 1 }
};

export function unitFamily(unit: string | null | undefined): UnitFamily {
	if (!unit) return null;
	return UNIT_TO_BASE[unit]?.family ?? null;
}

/** Rechnet eine Menge in die Basiseinheit ihrer Familie um (g, ml oder Stück). */
export function toBase(amount: number, unit: string | null | undefined): number | null {
	if (!unit) return null;
	const entry = UNIT_TO_BASE[unit];
	return entry ? amount * entry.factor : null;
}

export type CoverageResult = {
	/** Reicht der Vorrat für den (skalierten) Bedarf? */
	covered: boolean;
	/** Konnten Bedarf und Vorrat überhaupt verglichen werden (kompatible Einheiten)? */
	comparable: boolean;
	/** Noch benötigte Gebinde (auf ganze Packungen aufgerundet), 0 wenn gedeckt. */
	neededPackages: number;
	/** Picnic-Artikel für die fehlende Menge (erster kompatibler Alternativartikel mit Picnic-Verknüpfung). */
	orderPicnicId: string | null;
};

export type IngredientArticleStock = {
	packageAmount: number | null;
	packageUnit: string | null;
	stockPackages: number;
	picnicId: string | null;
};

/**
 * Prüft, ob der (zusammengezählte) Vorrat aller akzeptierten Alternativartikel
 * einer Zutat den Bedarf deckt, und berechnet die noch zu bestellenden Gebinde
 * des ersten kompatiblen Artikels mit Picnic-Verknüpfung.
 *
 * @param requiredAmount Bedarf laut Rezept (bereits auf Portionen skaliert)
 * @param requiredUnit   Einheit des Bedarfs
 * @param articles       Akzeptierte Alternativartikel mit Gebindegröße und Bestand
 */
export function coverageMulti(
	requiredAmount: number,
	requiredUnit: string | null,
	articles: IngredientArticleStock[]
): CoverageResult {
	const requiredBase = toBase(requiredAmount, requiredUnit);
	const requiredFamily = unitFamily(requiredUnit);
	if (requiredBase == null || requiredFamily == null) {
		return { covered: false, comparable: false, neededPackages: 0, orderPicnicId: null };
	}

	let availableBase = 0;
	let comparable = false;
	// Referenz für die Gebinde-Rundung (erster kompatibler Artikel); für die
	// tatsächliche Bestellung zählt nur ein Artikel mit Picnic-Verknüpfung.
	let referenceArticle: IngredientArticleStock | null = null;
	let orderArticle: IngredientArticleStock | null = null;

	// Bestand aller Alternativartikel mit passender Einheitenfamilie zusammenzählen.
	for (const article of articles) {
		const packageBase =
			article.packageAmount != null ? toBase(article.packageAmount, article.packageUnit) : null;
		if (packageBase == null || packageBase <= 0 || unitFamily(article.packageUnit) !== requiredFamily) {
			continue;
		}
		comparable = true;
		availableBase += packageBase * article.stockPackages;
		if (referenceArticle == null) referenceArticle = article;
		if (orderArticle == null && article.picnicId) orderArticle = article;
	}

	if (!comparable || !referenceArticle) {
		return { covered: false, comparable: false, neededPackages: 0, orderPicnicId: null };
	}

	const missingBase = requiredBase - availableBase;
	if (missingBase <= 0) {
		return { covered: true, comparable: true, neededPackages: 0, orderPicnicId: orderArticle?.picnicId ?? null };
	}
	// Gebindegröße für die Rundung: bevorzugt der bestellbare Artikel (damit die
	// Warenkorb-Menge stimmt), sonst der erste kompatible Artikel (nur Anzeige).
	const sizingArticle = orderArticle ?? referenceArticle;
	const sizingPackageBase = toBase(sizingArticle.packageAmount!, sizingArticle.packageUnit)!;
	return {
		covered: false,
		comparable: true,
		neededPackages: Math.ceil(missingBase / sizingPackageBase),
		orderPicnicId: orderArticle?.picnicId ?? null
	};
}

/** Skaliert eine Rezeptmenge von den Basis-Portionen auf die gewünschten Portionen. */
export function scaleAmount(
	amount: number | null,
	baseServings: number,
	wantedServings: number
): number | null {
	if (amount == null) return null;
	if (baseServings <= 0) return amount;
	return (amount * wantedServings) / baseServings;
}
