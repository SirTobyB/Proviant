/**
 * Mehrfachangebote von Picnic als Stückpreis — client- und servertauglich.
 *
 * Damit sich alle Angebote gleich darstellen und vergleichen lassen, wird
 * eine Aktion wie „2 für 4.99€“, „2+1 gratis“ oder „-50% auf 2. Artikel“ auf
 * einen effektiven Stückpreis bei einer Mindestmenge umgerechnet („je 2,50 €
 * statt 3,29 € · bei 2 Stück“). Gerundet wird **auf**: lieber einen Cent
 * Ersparnis zu wenig als zu viel.
 *
 * Einzelrabatte („20% Rabatt“, „jetzt 2.22€“, „1€ Rabatt“) deutet dieses
 * Modul bewusst nicht. Sie beziehen sich auf den Streichpreis, und ob der
 * angezeigte Preis schon rabattiert ist, verrät nur `originalPrice` — aus dem
 * Text allein entstünde im Zweifel ein doppelt abgezogener Rabatt.
 */

/** Eine Preisstaffel: Stückpreis ab einer Mindestmenge (Cent). */
export type PriceTier = { fromQuantity: number; unitPrice: number };

export type MultiBuyOffer = { unitPrice: number; minQuantity: number };

/** „4.99€“, „3,99 €“, „€3,99“, „£3.99“ → Cent */
const PRICE = String.raw`(?:[€£]\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR)?`;

function cents(raw: string): number {
	return Math.round(Number(raw.replace(',', '.')) * 100);
}

function offer(total: number, minQuantity: number, regularPrice: number): MultiBuyOffer | null {
	const unitPrice = Math.ceil(total / minQuantity);
	return unitPrice > 0 && unitPrice < regularPrice ? { unitPrice, minQuantity } : null;
}

export function offerFromLabel(label: string, regularPrice: number): MultiBuyOffer | null {
	if (!Number.isFinite(regularPrice) || regularPrice <= 0) return null;
	const text = label.trim();

	// „2 für 4.99€“ / „2 voor €3,99“ / „2 for £3.99“ — der Preis ist Pflicht
	let match = text.match(new RegExp(String.raw`^(\d+)\s+(?:für|voor|for)\s+` + PRICE + '$', 'i'));
	if (match && /[€£]|EUR/i.test(text)) {
		const count = Number(match[1]);
		return count >= 2 ? offer(cents(match[2]), count, regularPrice) : null;
	}

	// „2+1 gratis“ / „1+1 free“
	match = text.match(/^(\d+)\s*\+\s*(\d+)\s*(?:gratis|free|kostenlos)$/i);
	if (match) {
		const paid = Number(match[1]);
		const free = Number(match[2]);
		return paid >= 1 && free >= 1 ? offer(paid * regularPrice, paid + free, regularPrice) : null;
	}

	// „-50% auf 2. Artikel“ / „-40% op 2e artikel“
	match = text.match(/^-?\s*(\d{1,3})\s*%\s*(?:auf|op|on)\s+(?:den\s+|het\s+|the\s+)?2(?:\.|e|nd)?\s+\S+$/i);
	if (match) {
		const percent = Number(match[1]);
		return percent > 0 && percent <= 100 ? offer(regularPrice * (2 - percent / 100), 2, regularPrice) : null;
	}

	// „2. zum halben Preis“ / „2e halve prijs“ / „2nd half price“
	if (/^2(?:\.|e|nd)?\s+(?:zum\s+)?(?:halben\s+preis|halve\s+prijs|half\s+price)$/i.test(text)) {
		return offer(regularPrice * 1.5, 2, regularPrice);
	}

	return null;
}

/** Rabatt in ganzen Prozent (abgerundet); 0 ohne Aktion. */
export function discountPercent(price: { regularPrice: number; promoPrice: number | null }): number {
	if (price.promoPrice == null || price.regularPrice <= 0) return 0;
	return Math.max(0, Math.floor((1 - price.promoPrice / price.regularPrice) * 100));
}

/**
 * Reihenfolge der Angebotsseite: Was ohnehin unter dem Mindestbestand liegt,
 * kommt zuerst — dort bringt ein Angebot am meisten —, danach der höhere
 * Rabatt. Ohne Mindestbestand gilt ein Artikel nie als knapp.
 */
export function sortOffers<
	T extends { name: string; stock: number; minStock: number; price: { regularPrice: number; promoPrice: number | null } }
>(offers: T[]): T[] {
	const short = (o: T) => (o.minStock > 0 && o.stock < o.minStock ? 0 : 1);
	return [...offers].sort(
		(a, b) =>
			short(a) - short(b) ||
			discountPercent(b.price) - discountPercent(a.price) ||
			a.name.localeCompare(b.name, 'de')
	);
}
