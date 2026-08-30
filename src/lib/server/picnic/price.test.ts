import { describe, expect, it } from 'vitest';
import { crossedOutPrice, lineSavings } from './price';

/**
 * Ausschnitt einer rohen Produktseite, wie Picnic sie für ein **rabattiertes**
 * Produkt liefert (live geprüft an s1021273, Mazola Rapsöl: 3,49 € statt 4,49 €).
 * Verschachtelt, weil der Parser die Knoten in beliebiger Tiefe finden muss.
 */
const angebotsSeite = {
	layout: {
		body: {
			children: [
				{
					pml: {
						component: {
							children: [
								{ type: 'PRICE', price: 349, color: '#b40117', fontSize: 28 },
								{ type: 'PRICE', price: 449, color: '#c9c6c3', fontSize: 22, isCrossed: true }
							]
						}
					}
				}
			]
		}
	}
};

/**
 * Ohne Rabatt gibt es **gar keine** PRICE-Komponente (live geprüft an
 * s1020625) — der Preis steckt dann in einer markdown.props-Struktur.
 */
const normalSeite = {
	layout: { body: { children: [{ markdown: { props: { __ep1: { v0: { price: 249 } } } } }] } }
};

describe('crossedOutPrice', () => {
	it('findet den durchgestrichenen Originalpreis', () => {
		expect(crossedOutPrice(angebotsSeite, 349)).toBe(449);
	});

	it('meldet ohne PRICE-Komponente keinen Rabatt', () => {
		expect(crossedOutPrice(normalSeite, 249)).toBeNull();
	});

	// Ein Streichpreis unter dem aktuellen Preis wäre ein negativer Rabatt —
	// eher Datenfehler als Angebot, deshalb lieber nichts melden.
	it('ignoriert einen Streichpreis, der nicht höher liegt', () => {
		const seite = { c: [{ type: 'PRICE', price: 349, isCrossed: true }] };
		expect(crossedOutPrice(seite, 349)).toBeNull();
		expect(crossedOutPrice({ c: [{ type: 'PRICE', price: 300, isCrossed: true }] }, 349)).toBeNull();
	});

	it('verkraftet Datenmüll, ohne zu werfen', () => {
		expect(crossedOutPrice(null, 100)).toBeNull();
		expect(crossedOutPrice('nope', 100)).toBeNull();
		expect(crossedOutPrice({ type: 'PRICE', price: 'viel', isCrossed: true }, 100)).toBeNull();
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
