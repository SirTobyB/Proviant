/**
 * Die beiden Grundrechnungen auf einem Preis — client- und servertauglich.
 *
 * Sie standen zunächst in `server/prices.ts` und waren damit für Komponenten
 * unerreichbar; die Bestellseite rechnete die Ersparnis deshalb von Hand nach.
 * Zwei Fassungen derselben Regel sind hier die schlechteste Idee überhaupt:
 * Picnics Preisquellen sind ohnehin gegenläufig (siehe `picnic/price.ts`), und
 * ein Vorzeichenfehler verbucht einen Rabatt als Aufschlag. Also genau eine
 * Fassung, hier.
 */

/** Was ein Preis mindestens mitbringen muss: Normalpreis, optional Aktion. */
export type PriceParts = { regularPrice: number; promoPrice: number | null };

/** Tatsächlich zu zahlender Preis in Cent. */
export function effectivePrice(price: PriceParts): number {
	return price.promoPrice ?? price.regularPrice;
}

/** Ersparnis in Cent; 0 ohne Rabatt. */
export function savingsOf(price: PriceParts): number {
	return price.promoPrice == null ? 0 : Math.max(0, price.regularPrice - price.promoPrice);
}
