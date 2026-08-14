/**
 * Beschriftungen fürs Buchungsjournal. Rein und ohne Framework-Bezug, damit
 * die Zuordnung von Buchungsart zu Text testbar bleibt.
 */

export type MovementType = 'in' | 'out' | 'move' | 'correction';

const TYPE_LABELS: Record<MovementType, string> = {
	in: 'Zugang',
	out: 'Abgang',
	move: 'Umlagerung',
	correction: 'Korrektur'
};

const SOURCE_LABELS: Record<string, string> = {
	scan: 'Scanner',
	inventur: 'Inventur',
	lieferung: 'Lieferung',
	artikelliste: 'Artikelliste',
	charge: 'Charge'
};

export function movementTypeLabel(type: string): string {
	return TYPE_LABELS[type as MovementType] ?? type;
}

/** Unbekannte Herkunft (z.B. aus einer älteren Version) unverändert zeigen. */
export function movementSourceLabel(source: string | null): string {
	if (!source) return '';
	return SOURCE_LABELS[source] ?? source;
}

/**
 * Mengenangabe je Buchungsart: Zu-/Abgänge mit Vorzeichen, Umlagerungen ohne
 * (der Gesamtbestand ändert sich nicht), reine MHD-Korrekturen ohne Zahl.
 */
export function movementAmountLabel(type: string, quantity: number): string {
	if (type === 'move') return `${Math.abs(quantity)}×`;
	if (quantity === 0) return 'MHD';
	return `${quantity > 0 ? '+' : '−'}${Math.abs(quantity)}`;
}

/** Farbklasse passend zur Wirkung auf den Bestand. */
export function movementAmountClass(type: string, quantity: number): string {
	if (type === 'move' || quantity === 0) return 'text-gray-500';
	return quantity > 0 ? 'text-green-700' : 'text-amber-700';
}
