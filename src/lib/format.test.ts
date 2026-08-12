import { describe, expect, it } from 'vitest';
import { formatPrice, packageSize, tagFilterHref } from './format';

/** Intl setzt vor das Euro-Zeichen ein geschuetztes Leerzeichen. */
const nbsp = String.fromCharCode(160);

describe('packageSize', () => {
	it('formatiert Menge und Einheit deutsch', () => {
		expect(packageSize(500, 'g')).toBe('500 g');
		expect(packageSize(0.7, 'l')).toBe('0,7 l');
		expect(packageSize(1500, 'g')).toBe('1.500 g');
	});

	it('bleibt leer, wenn keine Menge hinterlegt ist', () => {
		expect(packageSize(null, 'g')).toBe('');
		expect(packageSize(6, null)).toBe('6');
	});
});

describe('formatPrice', () => {
	it('rechnet Cent in Euro um', () => {
		// Intl setzt vor das €-Zeichen ein geschütztes Leerzeichen (U+00A0)
		expect(formatPrice(169)).toBe('1,69 €');
		expect(formatPrice(0)).toBe('0,00 €');
	});
});

describe('tagFilterHref', () => {
	it('setzt den Tag und erhält die Suche', () => {
		expect(tagFilterHref('/artikel', 'Tiefkühl')).toBe('/artikel?tag=Tiefk%C3%BChl');
		expect(tagFilterHref('/artikel', 'Tiefkühl', { query: 'milch' })).toBe(
			'/artikel?q=milch&tag=Tiefk%C3%BChl'
		);
	});

	it('schaltet den bereits aktiven Tag wieder ab', () => {
		expect(tagFilterHref('/inventur', 'Tiefkühl', { query: 'milch', activeTag: 'Tiefkühl' })).toBe(
			'/inventur?q=milch'
		);
		expect(tagFilterHref('/inventur', 'Tiefkühl', { activeTag: 'Tiefkühl' })).toBe('/inventur');
	});
});
