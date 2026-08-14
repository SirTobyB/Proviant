import { describe, expect, it } from 'vitest';
import { formatPrice, packageSize, tagFilterHref, unitLabel } from './format';
import { translator } from './i18n';

/** Intl setzt vor das Euro-Zeichen ein geschuetztes Leerzeichen. */
const nbsp = String.fromCharCode(160);

const tDe = translator('de');
const tEn = translator('en');
const tNl = translator('nl');

describe('packageSize', () => {
	it('formatiert Menge und Einheit deutsch', () => {
		expect(packageSize(500, 'g', 'de', tDe)).toBe('500 g');
		expect(packageSize(0.7, 'l', 'de', tDe)).toBe('0,7 l');
		expect(packageSize(1500, 'g', 'de', tDe)).toBe('1.500 g');
	});

	it('folgt der Sprache bei Dezimal- und Tausendertrennung', () => {
		// Englisch dreht Punkt und Komma um, Niederländisch schreibt wie Deutsch
		expect(packageSize(0.7, 'l', 'en', tEn)).toBe('0.7 l');
		expect(packageSize(1500, 'g', 'en', tEn)).toBe('1,500 g');
		expect(packageSize(0.7, 'l', 'nl', tNl)).toBe('0,7 l');
	});

	it('übersetzt die Stück-Einheit, lässt den gespeicherten Wert aber unangetastet', () => {
		expect(packageSize(6, 'Stück', 'de', tDe)).toBe('6 Stück');
		expect(packageSize(6, 'Stück', 'en', tEn)).toBe('6 pcs');
		expect(packageSize(6, 'Stück', 'nl', tNl)).toBe('6 stuks');
	});

	it('bleibt leer, wenn keine Menge hinterlegt ist', () => {
		expect(packageSize(null, 'g', 'de', tDe)).toBe('');
		expect(packageSize(6, null, 'de', tDe)).toBe('6');
	});
});

describe('formatPrice', () => {
	it('rechnet Cent in Euro um', () => {
		// Intl setzt vor das €-Zeichen ein geschütztes Leerzeichen (U+00A0)
		expect(formatPrice(169, 'de')).toBe(`1,69${nbsp}€`);
		expect(formatPrice(0, 'de')).toBe(`0,00${nbsp}€`);
	});
});

describe('formatPrice je Sprache', () => {
	it('schreibt den Betrag anders, bleibt aber bei Euro', () => {
		expect(formatPrice(169, 'en')).toBe('€1.69');
		expect(formatPrice(169, 'nl')).toBe(`€${nbsp}1,69`);
	});
});

describe('unitLabel', () => {
	it('lässt internationale Einheiten und Unbekanntes stehen', () => {
		expect(unitLabel('kg', tEn)).toBe('kg');
		expect(unitLabel('Dose', tEn)).toBe('Dose');
		expect(unitLabel(null, tEn)).toBe('');
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
