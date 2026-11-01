import { describe, expect, it } from 'vitest';
import { priceTiers, tierHint } from './priceTiers';

describe('tierHint', () => {
	// Live: Gewürzketchup 2,29 €, ab 3 Stück 2,19 €
	it('schlägt die Staffel vor, wenn genau eine Packung fehlt', () => {
		expect(tierHint(2, 249, [{ fromQuantity: 3, unitPrice: 219 }])).toEqual({
			fromQuantity: 3,
			unitPrice: 219,
			extraCost: 159 // 3 × 2,19 € − 2 × 2,49 €
		});
	});

	it('schweigt, wenn die Staffel weiter weg oder schon erreicht ist', () => {
		expect(tierHint(1, 249, [{ fromQuantity: 3, unitPrice: 219 }])).toBeNull();
		expect(tierHint(3, 249, [{ fromQuantity: 3, unitPrice: 219 }])).toBeNull();
	});

	it('behandelt ein Mehrfachangebot wie eine Staffel', () => {
		// „1+1 gratis“ als Stufe: ab 2 Stück je 1,50 € — die zweite Packung kostet nichts
		expect(tierHint(1, 300, [{ fromQuantity: 2, unitPrice: 150 }])).toEqual({
			fromQuantity: 2,
			unitPrice: 150,
			extraCost: 0
		});
	});

	it('nimmt die nächste Stufe, auch wenn schon eine niedrigere gilt', () => {
		const tiers = [
			{ fromQuantity: 2, unitPrice: 289 },
			{ fromQuantity: 3, unitPrice: 279 }
		];
		expect(tierHint(2, 299, tiers)).toEqual({ fromQuantity: 3, unitPrice: 279, extraCost: 259 }); // 837 − 578
	});

	it('meldet keinen Hinweis ohne Staffel, ohne Menge oder ohne Vorteil', () => {
		expect(tierHint(2, 249, [])).toBeNull();
		expect(tierHint(0, 249, [{ fromQuantity: 1, unitPrice: 200 }])).toBeNull();
		expect(tierHint(2, 249, [{ fromQuantity: 3, unitPrice: 249 }])).toBeNull();
	});
});

describe('priceTiers', () => {
	it('nimmt Staffeln und ein Mehrfachangebot als Stufen zusammen', () => {
		expect(
			priceTiers({
				promoPrice: 150,
				promoMinQuantity: 2,
				priceRanges: [{ fromQuantity: 4, unitPrice: 140 }]
			})
		).toEqual([
			{ fromQuantity: 2, unitPrice: 150 },
			{ fromQuantity: 4, unitPrice: 140 }
		]);
	});

	it('zählt einen Einzelrabatt nicht als Stufe', () => {
		expect(priceTiers({ promoPrice: 222, promoMinQuantity: null, priceRanges: null })).toEqual([]);
		expect(priceTiers(null)).toEqual([]);
	});
});
