import { describe, expect, it } from 'vitest';
import { extractSearchHits } from './search';

/**
 * Ausschnitt der Fusion-Suchseite, wie Picnic DE sie für „milch" liefert
 * (live geprüft): Produkte als `sellingUnit`, tief verschachtelt, dasselbe
 * Produkt teils mehrfach.
 */
const milch = {
	unit: { id: 's1025099', name: 'Weihenstephan Frische Milch 3,5%', unit_quantity: '500ml', display_price: 99, image_id: 'img1', decorators: [] },
	bio: { id: 's1022962', name: 'Edeka Bio Bio Frische Vollmilch 3,8%', unit_quantity: '1L', display_price: 135, image_id: 'img2' }
};
const seite = {
	layout: {
		body: {
			children: [
				{ pml: { component: { analytics: { contexts: [{ data: { sellingUnit: milch.unit } }] } } } },
				{ children: [{ content: { sellingUnit: milch.bio } }, { content: { sellingUnit: milch.unit } }] }
			]
		}
	}
};

describe('extractSearchHits', () => {
	it('liest Produkte in Dokumentreihenfolge und ohne Dubletten', () => {
		expect(extractSearchHits(seite)).toEqual([
			{ id: 's1025099', name: 'Weihenstephan Frische Milch 3,5%', unitQuantity: '500ml', price: 99, imageId: 'img1' },
			{ id: 's1022962', name: 'Edeka Bio Bio Frische Vollmilch 3,8%', unitQuantity: '1L', price: 135, imageId: 'img2' }
		]);
	});

	it('lässt unvollständige Einträge weg', () => {
		const page = {
			a: { sellingUnit: { id: 's1', name: 'Ohne Preis' } },
			b: { sellingUnit: { name: 'Ohne ID', display_price: 100 } },
			c: { sellingUnit: { id: 's3', name: 'Ohne Bild und Menge', display_price: 100 } }
		};
		expect(extractSearchHits(page)).toEqual([
			{ id: 's3', name: 'Ohne Bild und Menge', unitQuantity: '', price: 100, imageId: null }
		]);
	});

	it('verkraftet Datenmüll, ohne zu werfen', () => {
		expect(extractSearchHits(null)).toEqual([]);
		expect(extractSearchHits('nope')).toEqual([]);
		expect(extractSearchHits({ sellingUnit: 'kaputt' })).toEqual([]);
	});
});
