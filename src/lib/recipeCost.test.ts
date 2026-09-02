import { describe, expect, it } from 'vitest';
import { recipeCost, type CostIngredient, type CostPrice } from './recipeCost';

function artikel(name: string, picnicId: string | null, packageAmount: number, stockPackages = 0) {
	return { id: 1, name, packageAmount, packageUnit: 'g', picnicId, stockPackages };
}

function zutat(amount: number, articles: CostIngredient['articles']): CostIngredient {
	return { amount, unit: 'g', freeText: null, articles };
}

const preise = (entries: [string, CostPrice][]) => new Map<string, CostPrice>(entries);

describe('recipeCost', () => {
	it('rechnet Gebinde mal Preis, ohne Vorrat identisch in beiden Blöcken', () => {
		const result = recipeCost({
			ingredients: [zutat(1000, [artikel('Mehl', 'p1', 500)])],
			baseServings: 2,
			portions: 2,
			prices: preise([['p1', { regularPrice: 199, promoPrice: null }]])
		});
		expect(result.all.total).toBe(398); // 2 Gebinde à 1,99 €
		expect(result.toOrder.total).toBe(398);
		expect(result.all.perPortion).toBe(199);
	});

	// Der Kern der Trennung: Vorrat senkt „zu bestellen", nicht „alle Zutaten".
	it('blendet den Vorrat nur im all-Block aus', () => {
		const result = recipeCost({
			ingredients: [zutat(1000, [artikel('Mehl', 'p1', 500, 1)])],
			baseServings: 2,
			portions: 2,
			prices: preise([['p1', { regularPrice: 199, promoPrice: null }]])
		});
		expect(result.toOrder.total).toBe(199); // ein Gebinde liegt da
		expect(result.all.total).toBe(398);
	});

	it('skaliert auf die gewünschten Portionen', () => {
		const result = recipeCost({
			ingredients: [zutat(500, [artikel('Mehl', 'p1', 500)])],
			baseServings: 2,
			portions: 6, // 1500 g -> 3 Gebinde
			prices: preise([['p1', { regularPrice: 100, promoPrice: null }]])
		});
		expect(result.all.total).toBe(300);
		expect(result.all.perPortion).toBe(50);
	});

	it('weist die Ersparnis aus und rechnet mit dem Aktionspreis', () => {
		const result = recipeCost({
			ingredients: [zutat(1000, [artikel('Öl', 'p1', 500)])],
			baseServings: 1,
			portions: 1,
			prices: preise([['p1', { regularPrice: 449, promoPrice: 349 }]])
		});
		expect(result.all.total).toBe(698); // 2 x 3,49 €
		expect(result.all.savings).toBe(200); // 2 x 1,00 €
	});

	// „Untergrenze statt stiller Null": eine Zutat ohne Preis darf die Summe
	// nicht vollständig aussehen lassen.
	it('meldet fehlende Preise als unvollständig', () => {
		const result = recipeCost({
			ingredients: [
				zutat(500, [artikel('Mehl', 'p1', 500)]),
				zutat(500, [artikel('Hefe', 'p2', 500)])
			],
			baseServings: 1,
			portions: 1,
			prices: preise([['p1', { regularPrice: 100, promoPrice: null }]])
		});
		expect(result.all.total).toBe(100);
		expect(result.all.complete).toBe(false);
		expect(result.all.unpriced).toEqual(['Hefe']);
	});

	// Die beiden Blöcke können unterschiedlich vollständig sein.
	it('lässt eine gedeckte preislose Zutat den toOrder-Block nicht trüben', () => {
		const result = recipeCost({
			ingredients: [zutat(500, [artikel('Salz', 'p9', 500, 10)])],
			baseServings: 1,
			portions: 1,
			prices: new Map()
		});
		expect(result.toOrder.complete).toBe(true); // es ist nichts zu kaufen
		expect(result.toOrder.total).toBe(0);
		expect(result.all.complete).toBe(false); // gekauft werden müsste es aber
	});

	it('überspringt Freitext-Zutaten ohne Artikel', () => {
		const result = recipeCost({
			ingredients: [{ amount: null, unit: null, freeText: 'Salz nach Gefühl', articles: [] }],
			baseServings: 1,
			portions: 1,
			prices: new Map()
		});
		expect(result.all.complete).toBe(true);
		expect(result.all.total).toBe(0);
	});

	it('meldet nicht vergleichbare Einheiten als unvollständig', () => {
		const result = recipeCost({
			ingredients: [{ amount: 2, unit: 'l', freeText: null, articles: [artikel('Mehl', 'p1', 500)] }],
			baseServings: 1,
			portions: 1,
			prices: preise([['p1', { regularPrice: 100, promoPrice: null }]])
		});
		expect(result.all.complete).toBe(false);
		expect(result.all.unpriced).toEqual(['Mehl']);
	});

	it('verkraftet 0 Portionen ohne Division durch null', () => {
		const result = recipeCost({
			ingredients: [zutat(500, [artikel('Mehl', 'p1', 500)])],
			baseServings: 2,
			portions: 0,
			prices: preise([['p1', { regularPrice: 100, promoPrice: null }]])
		});
		expect(Number.isFinite(result.all.perPortion)).toBe(true);
		expect(result.all.perPortion).toBe(0);
	});
});
