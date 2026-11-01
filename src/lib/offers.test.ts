import { describe, expect, it } from 'vitest';
import { offerFromLabel } from './offers';

// Beschriftungen wie live auf Picnics Angebotsseite (Picnic DE, November 2026);
// der Normalpreis ist dort der angezeigte Preis der Kachel.
describe('offerFromLabel', () => {
	it('rechnet „n für x €“ auf den Stückpreis um', () => {
		expect(offerFromLabel('2 für 4.99€', 329)).toEqual({ unitPrice: 250, minQuantity: 2 });
		expect(offerFromLabel('3 für 2.22€', 89)).toEqual({ unitPrice: 74, minQuantity: 3 });
		expect(offerFromLabel('2 für 3,99 €', 249)).toEqual({ unitPrice: 200, minQuantity: 2 });
		expect(offerFromLabel('2 voor €3,99', 249)).toEqual({ unitPrice: 200, minQuantity: 2 });
		expect(offerFromLabel('2 for £3.99', 249)).toEqual({ unitPrice: 200, minQuantity: 2 });
	});

	it('rechnet „n+m gratis“ auf den Stückpreis um', () => {
		expect(offerFromLabel('1+1 gratis', 300)).toEqual({ unitPrice: 150, minQuantity: 2 });
		expect(offerFromLabel('2+1 gratis', 249)).toEqual({ unitPrice: 166, minQuantity: 3 });
		expect(offerFromLabel('3+1 gratis', 99)).toEqual({ unitPrice: 75, minQuantity: 4 });
	});

	it('rechnet einen Rabatt auf den zweiten Artikel auf den Stückpreis um', () => {
		expect(offerFromLabel('-50% auf 2. Artikel', 229)).toEqual({ unitPrice: 172, minQuantity: 2 });
		expect(offerFromLabel('-40% auf 2. Artikel', 329)).toEqual({ unitPrice: 264, minQuantity: 2 });
		expect(offerFromLabel('2. zum halben Preis', 300)).toEqual({ unitPrice: 225, minQuantity: 2 });
		expect(offerFromLabel('2e halve prijs', 300)).toEqual({ unitPrice: 225, minQuantity: 2 });
	});

	it('überlässt Einzelrabatte dem Streichpreis der Kachel', () => {
		// „20% Rabatt“ und „jetzt 2.22€“ beziehen sich auf den Streichpreis; ob
		// der angezeigte Preis schon rabattiert ist, weiß nur `originalPrice`
		expect(offerFromLabel('20% Rabatt', 249)).toBeNull();
		expect(offerFromLabel('jetzt 2.22€', 349)).toBeNull();
		expect(offerFromLabel('1€ Rabatt', 349)).toBeNull();
	});

	it('ignoriert Beschriftungen ohne Angebot', () => {
		expect(offerFromLabel('Bio', 300)).toBeNull();
		expect(offerFromLabel('Family', 300)).toBeNull();
		expect(offerFromLabel('2 für 1', 300)).toBeNull(); // ohne Preis nicht sicher deutbar
	});

	it('meldet kein Angebot, wenn es keinen Vorteil bringt', () => {
		expect(offerFromLabel('2 für 9.99€', 249)).toBeNull();
		expect(offerFromLabel('2 für 4.99€', 0)).toBeNull();
	});
});
