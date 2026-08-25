import { describe, expect, it } from 'vitest';
import {
	assignedLocationId,
	missingLocationNames,
	newItemsNeedingLocation,
	openQuantity,
	type DeliveryLine
} from './deliveryNewItems';

const linie = (over: Partial<DeliveryLine> = {}): DeliveryLine => ({
	productId: 'p1',
	name: 'Milch',
	quantity: 2,
	articleId: null,
	...over
});

describe('openQuantity', () => {
	it('zieht die schon geprüfte Menge ab', () => {
		expect(openQuantity(linie())).toBe(2);
		expect(openQuantity(linie(), { p1: 1 })).toBe(1);
		expect(openQuantity(linie(), { p1: 2 })).toBe(0);
	});

	it('geht bei Überzählung nicht ins Minus', () => {
		expect(openQuantity(linie(), { p1: 5 })).toBe(0);
	});

	it('wertet kaputte Mengen als nichts Offenes', () => {
		expect(openQuantity(linie({ quantity: Number.NaN }))).toBe(0);
		expect(openQuantity(linie({ quantity: 1.5 }))).toBe(0);
		expect(openQuantity(linie({ quantity: -1 }))).toBe(0);
	});
});

describe('newItemsNeedingLocation', () => {
	it('meldet nur offene Positionen ohne Artikel im Stamm', () => {
		const lines = [
			linie({ productId: 'neu', name: 'Neu' }),
			linie({ productId: 'bekannt', name: 'Bekannt', articleId: 7 }),
			linie({ productId: 'fertig', name: 'Fertig' })
		];
		const names = newItemsNeedingLocation(lines, { fertig: 2 }).map((l) => l.name);
		expect(names).toEqual(['Neu']);
	});

	it('meldet nichts, wenn alles verknüpft ist', () => {
		expect(newItemsNeedingLocation([linie({ articleId: 3 })])).toEqual([]);
	});
});

describe('assignedLocationId', () => {
	it('nimmt Zahl und Zahl-String an', () => {
		expect(assignedLocationId({ p1: 4 }, 'p1')).toBe(4);
		expect(assignedLocationId({ p1: '4' }, 'p1')).toBe(4);
	});

	it('wertet Leeres und Unsinn als nicht gewählt', () => {
		expect(assignedLocationId({}, 'p1')).toBeNull();
		expect(assignedLocationId({ p1: '' }, 'p1')).toBeNull();
		expect(assignedLocationId({ p1: null }, 'p1')).toBeNull();
		expect(assignedLocationId({ p1: '0' }, 'p1')).toBeNull();
		expect(assignedLocationId({ p1: 'Keller' }, 'p1')).toBeNull();
		expect(assignedLocationId({ p1: '2.5' }, 'p1')).toBeNull();
	});
});

describe('missingLocationNames', () => {
	it('nennt die neuen Artikel ohne Lagerort beim Namen', () => {
		const neu = [linie({ productId: 'a', name: 'Apfel' }), linie({ productId: 'b', name: 'Brot' })];
		expect(missingLocationNames(neu, { a: '3' })).toEqual(['Brot']);
	});

	it('ist leer, sobald alle gesetzt sind', () => {
		const neu = [linie({ productId: 'a', name: 'Apfel' })];
		expect(missingLocationNames(neu, { a: '3' })).toEqual([]);
	});
});
