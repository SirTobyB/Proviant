/**
 * Beschriftungen fürs Buchungsjournal. Rein und ohne Framework-Bezug, damit
 * die Zuordnung von Buchungsart zu Text testbar bleibt.
 */

import type { Translate } from '$lib/i18n';

export type MovementType = 'in' | 'out' | 'move' | 'correction' | 'missing';

const TYPES: MovementType[] = ['in', 'out', 'move', 'correction', 'missing'];
const SOURCES = ['scan', 'inventur', 'lieferung', 'artikelliste', 'charge'];

/** Unbekannte Art (z.B. aus einer neueren Version) unverändert zeigen. */
export function movementTypeLabel(type: string, t: Translate): string {
	return TYPES.includes(type as MovementType) ? t(`journal.type.${type as MovementType}`) : type;
}

/** Unbekannte Herkunft (z.B. aus einer älteren Version) unverändert zeigen. */
export function movementSourceLabel(source: string | null, t: Translate): string {
	if (!source) return '';
	return SOURCES.includes(source)
		? t(`journal.source.${source as 'scan'}`)
		: source;
}

/**
 * Mengenangabe je Buchungsart: Zu-/Abgänge mit Vorzeichen, Umlagerungen und
 * Fehlbestände ohne (beide ändern den Gesamtbestand nicht), reine
 * MHD-Korrekturen ohne Zahl.
 */
export function movementAmountLabel(type: string, quantity: number, t: Translate): string {
	if (type === 'move' || type === 'missing') return `${Math.abs(quantity)}×`;
	if (quantity === 0) return t('journal.bestBeforeOnly');
	return `${quantity > 0 ? '+' : '−'}${Math.abs(quantity)}`;
}

/** Farbklasse passend zur Wirkung auf den Bestand. */
export function movementAmountClass(type: string, quantity: number): string {
	// Fehlbestand ändert nichts am Bestand, ist aber auch keine Routine —
	// deshalb neutral eingefärbt wie die Umlagerung, nicht grün/rot
	if (type === 'move' || type === 'missing' || quantity === 0) return 'text-gray-500';
	return quantity > 0 ? 'text-green-700' : 'text-amber-700';
}
