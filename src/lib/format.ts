/**
 * Kleine Darstellungshelfer, die sonst in jeder zweiten Seite dupliziert
 * würden. Bewusst ohne Framework-Bezug, damit überall verwendbar.
 */
import { BCP47, type Locale, type Translate } from '$lib/i18n';

/**
 * Auswählbare Maßeinheiten. Die Werte sind **Daten** und stehen so in der
 * Datenbank — übersetzt wird nur die Beschriftung, damit ein Sprachwechsel
 * keine Bestandsdaten umdeutet.
 */
export const UNITS = ['g', 'kg', 'ml', 'l', 'Stück'] as const;

/**
 * Beschriftung einer Einheit; Unbekanntes bleibt unverändert stehen.
 *
 * `amount` steuert die Ein-/Mehrzahl („1 pc" gegen „6 pcs"). Ohne Angabe —
 * etwa als Eintrag einer Auswahlliste — gilt die Mehrzahlform.
 */
export function unitLabel(unit: string | null, t: Translate, amount?: number | null): string {
	if (!unit) return '';
	// g/kg/ml/l sind international, nur „Stück" hat je Sprache ein eigenes Wort
	if (unit !== 'Stück') return unit;
	return amount == null ? t('form.unitPiece') : t('form.unitPiece', { n: amount });
}

/** Gebindegröße als Text, z.B. „500 g"; leer, wenn keine Menge hinterlegt ist. */
export function packageSize(
	amount: number | null,
	unit: string | null,
	locale: Locale,
	t: Translate
): string {
	if (amount == null) return '';
	return `${amount.toLocaleString(BCP47[locale])} ${unitLabel(unit, t, amount)}`.trim();
}

/** Picnic liefert Preise in Cent. Die Währung bleibt Euro, nur die Schreibweise folgt der Sprache. */
export function formatPrice(cents: number, locale: Locale): string {
	return (cents / 100).toLocaleString(BCP47[locale], { style: 'currency', currency: 'EUR' });
}

/**
 * Link für einen Tag-Filter: erhält die Suche und schaltet den bereits aktiven
 * Tag wieder ab (Klick auf denselben Tag = Filter aufheben).
 */
export function tagFilterHref(
	basePath: string,
	tag: string,
	options: { query?: string; activeTag?: string } = {}
): string {
	const params = new URLSearchParams();
	if (options.query) params.set('q', options.query);
	if (tag && tag !== options.activeTag) params.set('tag', tag);
	const queryString = params.toString();
	return `${basePath}${queryString ? `?${queryString}` : ''}`;
}
