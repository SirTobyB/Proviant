import { describe, expect, it } from 'vitest';
import { catalogPrice, lineSavings, tilePrice } from './price';

/** Ohne Mehrfachangebot und ohne Staffeln. */
const plain = { promoMinQuantity: null, priceRanges: null };

describe('catalogPrice', () => {
	// Live geprüft an s1021273 (Mazola Rapsöl: 3,49 € statt 4,49 €)
	it('deutet originalPrice als Streichpreis und displayPrice als Aktionspreis', () => {
		expect(
			catalogPrice({ displayPrice: 349, originalPrice: 449, promotion: { label: '1 € Rabatt' } })
		).toEqual({ regularPrice: 449, promoPrice: 349, promoLabel: '1 € Rabatt', ...plain });
	});

	it('meldet ohne Streichpreis keinen Rabatt', () => {
		expect(catalogPrice({ displayPrice: 249, originalPrice: null, promotion: null })).toEqual({
			regularPrice: 249,
			promoPrice: null,
			promoLabel: null,
			...plain
		});
	});

	// Aktion gemeldet, aber kein Streichpreis: lieber kein Rabatt als ein erfundener
	it('behält bei fehlendem Streichpreis nur die Beschriftung', () => {
		expect(catalogPrice({ displayPrice: 249, originalPrice: null, promotion: { label: '2 für 1' } })).toEqual({
			regularPrice: 249,
			promoPrice: null,
			promoLabel: '2 für 1',
			...plain
		});
	});

	// Ein Streichpreis unter dem aktuellen Preis wäre ein negativer Rabatt —
	// eher Datenfehler als Angebot, deshalb lieber nichts melden.
	it('ignoriert einen Streichpreis, der nicht höher liegt', () => {
		expect(catalogPrice({ displayPrice: 349, originalPrice: 349 })?.promoPrice).toBeNull();
		expect(catalogPrice({ displayPrice: 349, originalPrice: 300 })).toEqual({
			regularPrice: 349,
			promoPrice: null,
			promoLabel: null,
			...plain
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
			promoLabel: null,
			...plain
		});
	});

	// Live: „2 für 2.22€“ an s1027145 — displayPrice ist der Normalpreis, kein originalPrice
	it('rechnet ein Mehrfachangebot auf den Stückpreis bei Mindestmenge um', () => {
		expect(catalogPrice({ displayPrice: 129, originalPrice: null, promotion: { label: '2 für 2.22€' } })).toEqual({
			regularPrice: 129,
			promoPrice: 111,
			promoLabel: '2 für 2.22€',
			promoMinQuantity: 2,
			priceRanges: null
		});
	});

	it('übernimmt Preisstaffeln ab der zweiten Stufe', () => {
		const ranged = catalogPrice({
			displayPrice: 229,
			priceRanges: [
				{ price: 229, from_quantity: 1 },
				{ price: 219, from_quantity: 3 },
				{ price: 209, from_quantity: 4 }
			]
		});
		expect(ranged?.priceRanges).toEqual([
			{ fromQuantity: 3, unitPrice: 219 },
			{ fromQuantity: 4, unitPrice: 209 }
		]);
		// Nur die Grundstufe ist keine Staffel
		expect(catalogPrice({ displayPrice: 149, priceRanges: [{ price: 149, from_quantity: 1 }] })?.priceRanges).toBeNull();
		expect(catalogPrice({ displayPrice: 149, priceRanges: 'kaputt' })?.priceRanges).toBeNull();
	});
});

describe('tilePrice', () => {
	// Live: Kacheln der Angebotsseite und der Aktionsgruppen
	it('deutet originalPrice als Streichpreis und nimmt die Angebotsbeschriftung', () => {
		expect(
			tilePrice({ displayPrice: 222, originalPrice: 349, labels: [{ text: 'Bio' }, { text: 'jetzt 2.22€' }] })
		).toEqual({ regularPrice: 349, promoPrice: 222, promoLabel: 'jetzt 2.22€', ...plain });
	});

	it('rechnet ein Mehrfachangebot aus der Beschriftung um', () => {
		expect(tilePrice({ displayPrice: 249, originalPrice: null, labels: [{ text: '2+1 gratis' }] })).toEqual({
			regularPrice: 249,
			promoPrice: 166,
			promoLabel: '2+1 gratis',
			promoMinQuantity: 3,
			priceRanges: null
		});
	});

	// Live: Aktionsgruppe De Cecco — „jetzt 1.49€“, aber kein Streichpreis
	it('meldet ohne Streichpreis und ohne deutbares Mehrfachangebot keinen Rabatt', () => {
		expect(tilePrice({ displayPrice: 149, originalPrice: null, labels: [{ text: 'jetzt 1.49€' }] })).toEqual({
			regularPrice: 149,
			promoPrice: null,
			promoLabel: null,
			...plain
		});
	});

	it('verkraftet Datenmüll, ohne zu werfen', () => {
		expect(tilePrice(null)).toBeNull();
		expect(tilePrice({ displayPrice: 100, labels: 'kaputt' })).toEqual({
			regularPrice: 100,
			promoPrice: null,
			promoLabel: null,
			...plain
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
