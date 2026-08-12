import { describe, expect, it } from 'vitest';
import { parseUnitQuantity } from './unitQuantity';

describe('parseUnitQuantity', () => {
	it.each([
		['500g', 500, 'g'],
		['1,5 kg', 1.5, 'kg'],
		['750ml', 750, 'ml'],
		['0,7l', 0.7, 'l'],
		['6 Stück', 6, 'Stück'],
		['6er Pack', 6, 'Stück'],
		['4er-Pack', 4, 'Stück'],
		['2 x 125g', 250, 'g'],
		['3x250ml', 750, 'ml'],
		['1 Stück mind. 300g', 1, 'Stück']
	])('liest „%s" als %s %s', (text, amount, unit) => {
		expect(parseUnitQuantity(text)).toEqual({ amount, unit });
	});

	it.each(['', '   ', 'nach Gewicht', '100 Blatt', null, undefined])(
		'gibt bei „%s" nichts zurück statt zu raten',
		(text) => {
			expect(parseUnitQuantity(text)).toEqual({ amount: null, unit: null });
		}
	);
});
