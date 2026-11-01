import { describe, expect, it } from 'vitest';
import { savingsFor, totalFor } from './prices';

describe('totalFor / savingsFor', () => {
	const discount = { regularPrice: 349, promoPrice: 222 };
	const oneplusone = { regularPrice: 300, promoPrice: 150, promoMinQuantity: 2 };

	it('rechnet einen Einzelrabatt auf jede Packung', () => {
		expect(totalFor(discount, 2)).toBe(444);
		expect(savingsFor(discount, 2)).toBe(254);
	});

	it('gewährt ein Mehrfachangebot nur für volle Bündel', () => {
		expect(totalFor(oneplusone, 1)).toBe(300);
		expect(totalFor(oneplusone, 2)).toBe(300);
		expect(totalFor(oneplusone, 3)).toBe(600);
		expect(savingsFor(oneplusone, 1)).toBe(0);
		expect(savingsFor(oneplusone, 3)).toBe(300);
	});

	it('rechnet ohne Aktion zum Normalpreis', () => {
		expect(totalFor({ regularPrice: 249, promoPrice: null }, 3)).toBe(747);
		expect(savingsFor({ regularPrice: 249, promoPrice: null }, 3)).toBe(0);
	});

	// Live: Gewürzketchup 2,29 €, ab 3 Stück 2,19 €, ab 4 Stück 2,09 €
	it('rechnet Preisstaffeln ab ihrer Mindestmenge', () => {
		const ketchup = {
			regularPrice: 229,
			promoPrice: null,
			priceRanges: [
				{ fromQuantity: 3, unitPrice: 219 },
				{ fromQuantity: 4, unitPrice: 209 }
			]
		};
		expect(totalFor(ketchup, 2)).toBe(458);
		expect(totalFor(ketchup, 3)).toBe(657);
		expect(totalFor(ketchup, 5)).toBe(1045);
		expect(savingsFor(ketchup, 3)).toBe(30);
	});

	it('gibt bei Menge 0 nichts aus', () => {
		expect(totalFor(oneplusone, 0)).toBe(0);
		expect(savingsFor(discount, 0)).toBe(0);
	});
});
