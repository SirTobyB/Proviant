/**
 * Ablaufregel des Angebots-Zwischenspeichers (`server/offers.ts`) — rein,
 * damit eigenständig testbar.
 *
 * - `fresh`: jünger als eine Stunde, einfach verwenden.
 * - `stale`: älter, aber noch brauchbar — anzeigen und im Hintergrund
 *   auffrischen (ein Abruf dauert live über zehn Sekunden).
 * - `expired`: älter als ein Tag. Scheitert die Auffrischung so lange, gilt der
 *   alte Stand nicht mehr; Angebote enden, und ein abgelaufener Rabatt wäre
 *   schlimmer als gar keiner.
 */
export const OFFER_MAX_AGE_MS = 60 * 60 * 1000;
export const OFFER_MAX_STALE_MS = 24 * 60 * 60 * 1000;

export type OfferCacheState = 'missing' | 'fresh' | 'stale' | 'expired';

export function offerCacheState(fetchedAt: number | null, now: number): OfferCacheState {
	if (fetchedAt === null) return 'missing';
	const age = now - fetchedAt;
	if (age < OFFER_MAX_AGE_MS) return 'fresh';
	return age < OFFER_MAX_STALE_MS ? 'stale' : 'expired';
}

type OfferPrice = { regularPrice: number; promoPrice: number | null };

/**
 * Angebote der Angebotsseite plus frische Rabatte aus dem Preis-Cache.
 *
 * Picnics Angebotsseite zeigt nicht jedes laufende Angebot — ein persönlicher
 * Bereich wechselt, und manches Produkt steht in keiner Aktionsgruppe (live:
 * Géramont „jetzt 2.22€“, auf der Produktseite im Angebot, auf der
 * Angebotsseite nicht). Was die Bestell- oder Artikelseite am Produkt selbst
 * gesehen hat und höchstens einen Tag alt ist, zählt deshalb mit. Bei
 * Doppelungen gilt die Angebotsseite (der jüngere Stand).
 */
export function mergeOffers<P extends OfferPrice>(
	promoted: Map<string, P>,
	cached: Map<string, P & { fetchedAt: Date }>,
	now: number
): Map<string, P> {
	const merged = new Map(promoted);
	for (const [id, price] of cached) {
		if (merged.has(id) || price.promoPrice == null) continue;
		if (now - price.fetchedAt.getTime() >= OFFER_MAX_STALE_MS) continue;
		merged.set(id, price);
	}
	return merged;
}
