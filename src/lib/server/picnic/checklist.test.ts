import { describe, expect, it } from 'vitest';
import { aggregateChecklist, deliveryIssues, lineQuantity } from './checklist';

/**
 * Storno-Decorator, wie Picnic ihn an der **Lieferung** führt (live geprüft an
 * einer Lieferung, bei der eine Position nicht mitkam).
 */
function issuesDecorator(issues: { article_id: string; quantity: number; reason?: string }[]) {
	return [
		{
			type: 'ARTICLE_DELIVERY_ISSUES',
			issues: issues.map((i) => ({
				article_id: i.article_id,
				quantity: i.quantity,
				reason: { type: i.reason ?? 'PRODUCT_NOT_SHIPPED' },
				resolution: { type: 'REFUND' },
				price: 269,
				feedback_label: null
			}))
		}
	];
}

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

describe('deliveryIssues', () => {
	it('liest Artikel-ID, Menge und Grund aus dem Decorator', () => {
		const issues = deliveryIssues(issuesDecorator([{ article_id: 's1024786', quantity: 1 }]));
		expect(issues.get('s1024786')).toEqual({ quantity: 1, reason: 'PRODUCT_NOT_SHIPPED' });
	});

	it('summiert mehrere Meldungen zum selben Artikel', () => {
		const issues = deliveryIssues(
			issuesDecorator([
				{ article_id: 's1', quantity: 1 },
				{ article_id: 's1', quantity: 2, reason: 'PRODUCT_LOW_QUALITY' }
			])
		);
		expect(issues.get('s1')?.quantity).toBe(3);
	});

	// Der Decorator ist undokumentiert: lieber nichts melden als Datenmüll
	it('ignoriert fremde Decorators und kaputte Einträge', () => {
		expect(deliveryIssues(undefined).size).toBe(0);
		expect(deliveryIssues([{ type: 'BANNERS' }]).size).toBe(0);
		expect(deliveryIssues([{ type: 'ARTICLE_DELIVERY_ISSUES' }]).size).toBe(0);
		expect(deliveryIssues([{ type: 'ARTICLE_DELIVERY_ISSUES', issues: 'kaputt' }]).size).toBe(0);
		const partial = deliveryIssues([
			{ type: 'ARTICLE_DELIVERY_ISSUES', issues: [{ quantity: 2 }, { article_id: 's1' }] }
		]);
		expect(partial.size).toBe(1);
		// Menge fehlt → 1 annehmen, Grund fehlt → null statt erfundener Text
		expect(partial.get('s1')).toEqual({ quantity: 1, reason: null });
	});
});

describe('aggregateChecklist mit Stornos', () => {
	it('zieht die stornierte Menge vom Soll ab und merkt sich den Grund', () => {
		const items = aggregateChecklist(
			[{ items: [line('s1', 3)] }],
			issuesDecorator([{ article_id: 's1', quantity: 1 }])
		);
		expect(items[0]).toMatchObject({
			quantity: 2,
			orderedQuantity: 3,
			cancelledQuantity: 1,
			cancelReason: 'PRODUCT_NOT_SHIPPED'
		});
	});

	it('behält eine komplett stornierte Position mit Soll 0 in der Liste', () => {
		// Ausblenden wäre bequemer, aber dann bliebe unerklärt, warum die Position
		// aus der Lieferung verschwunden ist.
		const items = aggregateChecklist(
			[{ items: [line('s1', 1)] }],
			issuesDecorator([{ article_id: 's1', quantity: 1 }])
		);
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ quantity: 0, cancelledQuantity: 1 });
	});

	it('lässt das Soll nicht negativ werden', () => {
		const items = aggregateChecklist(
			[{ items: [line('s1', 1)] }],
			issuesDecorator([{ article_id: 's1', quantity: 5 }])
		);
		expect(items[0]).toMatchObject({ quantity: 0, cancelledQuantity: 1 });
	});

	it('lässt Positionen ohne Meldung unberührt', () => {
		const items = aggregateChecklist(
			[{ items: [line('s1', 2), line('s2', 1)] }],
			issuesDecorator([{ article_id: 's1', quantity: 1 }])
		);
		expect(items.find((i) => i.productId === 's2')).toMatchObject({
			quantity: 1,
			cancelledQuantity: 0,
			cancelReason: null
		});
	});
});
