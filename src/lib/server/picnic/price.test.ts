import { describe, expect, it } from 'vitest';
import { catalogPrice, lineSavings } from './price';

describe('catalogPrice', () => {
	// Live geprüft an s1021273 (Mazola Rapsöl: 3,49 € statt 4,49 €)
	it('deutet originalPrice als Streichpreis und displayPrice als Aktionspreis', () => {
		expect(
			catalogPrice({ displayPrice: 349, originalPrice: 449, promotion: { label: '1 € Rabatt' } })
		).toEqual({ regularPrice: 449, promoPrice: 349, promoLabel: '1 € Rabatt' });
	});

	it('meldet ohne Streichpreis keinen Rabatt', () => {
		expect(catalogPrice({ displayPrice: 249, originalPrice: null, promotion: null })).toEqual({
			regularPrice: 249,
			promoPrice: null,
			promoLabel: null
		});
	});

	// Aktion gemeldet, aber kein Streichpreis: lieber kein Rabatt als ein erfundener
	it('behält bei fehlendem Streichpreis nur die Beschriftung', () => {
		expect(catalogPrice({ displayPrice: 249, originalPrice: null, promotion: { label: '2 für 1' } })).toEqual({
			regularPrice: 249,
			promoPrice: null,
			promoLabel: '2 für 1'
		});
	});

	// Ein Streichpreis unter dem aktuellen Preis wäre ein negativer Rabatt —
	// eher Datenfehler als Angebot, deshalb lieber nichts melden.
	it('ignoriert einen Streichpreis, der nicht höher liegt', () => {
		expect(catalogPrice({ displayPrice: 349, originalPrice: 349 })?.promoPrice).toBeNull();
		expect(catalogPrice({ displayPrice: 349, originalPrice: 300 })).toEqual({
			regularPrice: 349,
			promoPrice: null,
			promoLabel: null
		});
	});

	it('verkraftet Datenmüll, ohne zu werfen', () => {
		expect(catalogPrice(null)).toBeNull();
		expect(catalogPrice({})).toBeNull();
		expect(catalogPrice({ displayPrice: 0 })).toBeNull();
		expect(catalogPrice({ displayPrice: 'viel' })).toBeNull();
		expect(catalogPrice({ displayPrice: 100, originalPrice: 'viel', promotion: { label: 7 } })).toEqual({
			regularPrice: 100,
			promoPrice: null,
			promoLabel: null
		});
	});
});

describe('lineSavings', () => {
	// An der ORDER_LINE ist die Semantik genau umgekehrt zur Katalogseite:
	// line.price ist der Streichpreis, der PRICE-Decorator der gezahlte Preis.
	it('liest Streichpreis aus line.price und Aktionspreis aus dem Decorator', () => {
		const line = {
			price: 249,
			decorators: [
				{ type: 'PRICE', display_price: 199 },
				{ type: 'PROMO', text: 'jetzt 1.99€' }
			]
		};
		expect(lineSavings(line)).toEqual({
			regularPrice: 249,
			promoPrice: 199,
			promoLabel: 'jetzt 1.99€'
		});
	});

	it('meldet ohne Decorators keinen Rabatt', () => {
		expect(lineSavings({ price: 325 })).toEqual({
			regularPrice: 325,
			promoPrice: null,
			promoLabel: null
		});
	});

	it('ignoriert einen Aktionspreis, der nicht unter dem Normalpreis liegt', () => {
		const line = { price: 199, decorators: [{ type: 'PRICE', display_price: 249 }] };
		expect(lineSavings(line)?.promoPrice).toBeNull();
	});

	it('gibt null zurück, wenn kein brauchbarer Preis da ist', () => {
		expect(lineSavings({})).toBeNull();
		expect(lineSavings(null)).toBeNull();
		expect(lineSavings({ price: 0 })).toBeNull();
	});
});
