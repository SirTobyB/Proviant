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

/** Preis mit optionalem Mehrfachangebot (Aktionspreis gilt je volles Bündel). */
export type PriceWithOffer = PriceParts & { promoMinQuantity?: number | null };

/**
 * Gesamtpreis für `quantity` Packungen. Ein Mehrfachangebot („2 für …“) gilt
 * nur für volle Bündel, der Rest kostet den Normalpreis — `effectivePrice *
 * Menge` verspräche sonst schon bei einer Packung den Bündelpreis.
 */
export function totalFor(price: PriceWithOffer, quantity: number): number {
	if (quantity <= 0) return 0;
	if (price.promoPrice == null) return price.regularPrice * quantity;
	const bundle = Math.max(1, price.promoMinQuantity ?? 1);
	const discounted = Math.floor(quantity / bundle) * bundle;
	return discounted * price.promoPrice + (quantity - discounted) * price.regularPrice;
}

/** Ersparnis gegenüber dem Normalpreis für `quantity` Packungen. */
export function savingsFor(price: PriceWithOffer, quantity: number): number {
	return Math.max(0, price.regularPrice * Math.max(0, quantity) - totalFor(price, quantity));
}
