/**
 * Mengenrabatt-Hinweis — client- und servertauglich.
 *
 * Picnic staffelt manche Preise („ab 3 Stück je 2,19 €“), und Mehrfachangebote
 * („1+1 gratis“) wirken genauso: ab einer Mindestmenge wird jede Packung
 * billiger. Vorgeschlagen wird das nur, wenn **genau eine** Packung mehr die
 * nächste Stufe erreicht (so vom Nutzer festgelegt) — mehr wäre schon eine
 * andere Einkaufsmenge. Die Menge selbst ändert sich nie von allein; der
 * Hinweis bietet nur einen Knopf an.
 */
import type { PriceTier } from '#lib/offers.js';

export type TierHint = {
	/** Menge, ab der die Stufe gilt (= vorgeschlagene Menge + 1). */
	fromQuantity: number;
	/** Stückpreis dieser Stufe in Cent. */
	unitPrice: number;
	/** Mehrkosten der zusätzlichen Packung in Cent. */
	extraCost: number;
};

function unitPriceAt(quantity: number, regularUnitPrice: number, tiers: PriceTier[]): number {
	return tiers
		.filter((tier) => tier.fromQuantity <= quantity)
		.reduce((best, tier) => Math.min(best, tier.unitPrice), regularUnitPrice);
}

export function tierHint(quantity: number, regularUnitPrice: number, tiers: PriceTier[]): TierHint | null {
	if (!Number.isInteger(quantity) || quantity < 1) return null;
	const next = tiers.find((tier) => tier.fromQuantity === quantity + 1);
	if (!next) return null;
	const current = unitPriceAt(quantity, regularUnitPrice, tiers);
	if (next.unitPrice >= current) return null;
	return {
		fromQuantity: next.fromQuantity,
		unitPrice: next.unitPrice,
		extraCost: next.fromQuantity * next.unitPrice - quantity * current
	};
}

/**
 * Alle Mengenstufen eines Preises: Picnics Staffeln plus ein Mehrfachangebot
 * („1+1 gratis“ = ab 2 Stück je halber Preis). Ein Einzelrabatt gilt ab der
 * ersten Packung und ist deshalb keine Stufe.
 */
export function priceTiers(
	price: { promoPrice: number | null; promoMinQuantity: number | null; priceRanges: PriceTier[] | null } | null
): PriceTier[] {
	if (!price) return [];
	const tiers = [...(price.priceRanges ?? [])];
	if (price.promoPrice != null && price.promoMinQuantity != null && price.promoMinQuantity > 1) {
		tiers.push({ fromQuantity: price.promoMinQuantity, unitPrice: price.promoPrice });
	}
	return tiers.sort((a, b) => a.fromQuantity - b.fromQuantity);
}
