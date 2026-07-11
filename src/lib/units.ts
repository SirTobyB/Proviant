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
};

/**
 * Prüft, ob der Vorrat eines Artikels den Bedarf einer Zutat deckt, und berechnet
 * die noch zu bestellenden Gebinde (aufgerundet, Vorrat abgezogen).
 *
 * @param requiredAmount Bedarf laut Rezept (bereits auf Portionen skaliert)
 * @param requiredUnit   Einheit des Bedarfs
 * @param packageAmount  Gebindegröße des verknüpften Artikels
 * @param packageUnit    Einheit der Gebindegröße
 * @param stockPackages  Anzahl Gebinde im Bestand
 */
export function coverage(
	requiredAmount: number,
	requiredUnit: string | null,
	packageAmount: number | null,
	packageUnit: string | null,
	stockPackages: number
): CoverageResult {
	const requiredBase = toBase(requiredAmount, requiredUnit);
	const packageBase = packageAmount != null ? toBase(packageAmount, packageUnit) : null;

	// Vergleich nur möglich, wenn beide Seiten dieselbe Einheitenfamilie haben
	const comparable =
		requiredBase != null &&
		packageBase != null &&
		packageBase > 0 &&
		unitFamily(requiredUnit) === unitFamily(packageUnit);

	if (!comparable) {
		return { covered: false, comparable: false, neededPackages: 0 };
	}

	const availableBase = packageBase! * stockPackages;
	const missingBase = requiredBase! - availableBase;
	if (missingBase <= 0) {
		return { covered: true, comparable: true, neededPackages: 0 };
	}
	return {
		covered: false,
		comparable: true,
		neededPackages: Math.ceil(missingBase / packageBase!)
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
