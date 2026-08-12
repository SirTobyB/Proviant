import { describe, expect, it } from 'vitest';
import { aggregateChecklist, lineQuantity } from './checklist';

/** Baut eine Bestellzeile wie Picnic sie liefert. */
function line(id: string, quantity: number, name = id) {
	return {
		items: [
			{
				id,
				name,
				image_ids: ['bild-' + id],
				unit_quantity: '500g',
				decorators: [{ type: 'QUANTITY', quantity }, { type: 'UNIT_QUANTITY' }]
			}
		]
	};
}

describe('lineQuantity', () => {
	it('liest die Menge aus dem QUANTITY-Decorator', () => {
		expect(lineQuantity([{ type: 'IMMUTABLE' }, { type: 'QUANTITY', quantity: 3 }])).toBe(3);
	});

	it('nimmt 1 an, wenn kein Decorator vorhanden ist', () => {
		expect(lineQuantity([{ type: 'UNIT_QUANTITY' }])).toBe(1);
		expect(lineQuantity(undefined)).toBe(1);
	});
});

describe('aggregateChecklist', () => {
	it('übernimmt die Menge aus dem Decorator statt Einträge zu zählen', () => {
		// Kern der Sache: ein Produkt steht genau EINMAL in der Zeile, auch wenn
		// es dreimal bestellt wurde. Zählen der Einträge ergäbe fälschlich 1.
		const items = aggregateChecklist([{ items: [line('s1', 3)] }]);
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ productId: 's1', quantity: 3, unitQuantity: '500g' });
	});

	it('summiert dasselbe Produkt über mehrere Teilbestellungen', () => {
		const items = aggregateChecklist([
			{ items: [line('s1', 2)] },
			{ items: [line('s1', 1), line('s2', 5)] }
		]);
		expect(items.find((i) => i.productId === 's1')?.quantity).toBe(3);
		expect(items.find((i) => i.productId === 's2')?.quantity).toBe(5);
	});

	it('sortiert nach Namen und verträgt leere Eingaben', () => {
		const items = aggregateChecklist([{ items: [line('s2', 1, 'Zucker'), line('s1', 1, 'Butter')] }]);
		expect(items.map((i) => i.name)).toEqual(['Butter', 'Zucker']);
		expect(aggregateChecklist(undefined)).toEqual([]);
		expect(aggregateChecklist([{ items: [{ items: [] }] }])).toEqual([]);
	});
});
