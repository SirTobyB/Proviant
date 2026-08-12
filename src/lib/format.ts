/**
 * Kleine Darstellungshelfer, die sonst in jeder zweiten Seite dupliziert
 * würden. Bewusst ohne Framework-Bezug, damit überall verwendbar.
 */

/** Gebindegröße als Text, z.B. „500 g"; leer, wenn keine Menge hinterlegt ist. */
export function packageSize(amount: number | null, unit: string | null): string {
	if (amount == null) return '';
	return `${amount.toLocaleString('de-DE')} ${unit ?? ''}`.trim();
}

/** Picnic liefert Preise in Cent. */
export function formatPrice(cents: number): string {
	return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
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
