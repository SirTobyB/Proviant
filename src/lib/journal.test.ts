import { describe, expect, it } from 'vitest';
import {
	movementAmountClass,
	movementAmountLabel,
	movementSourceLabel,
	movementTypeLabel
} from './journal';
import { translator } from './i18n';

const tDe = translator('de');
const tEn = translator('en');
const tNl = translator('nl');

describe('movementTypeLabel', () => {
	it('benennt die Buchungsarten deutsch', () => {
		expect(movementTypeLabel('in', tDe)).toBe('Zugang');
		expect(movementTypeLabel('out', tDe)).toBe('Abgang');
		expect(movementTypeLabel('move', tDe)).toBe('Umlagerung');
		expect(movementTypeLabel('correction', tDe)).toBe('Korrektur');
	});

	it('benennt sie ebenso auf Englisch und Niederländisch', () => {
		expect(movementTypeLabel('in', tEn)).toBe('Addition');
		expect(movementTypeLabel('move', tNl)).toBe('Verplaatsing');
	});

	it('gibt Unbekanntes unverändert zurück', () => {
		expect(movementTypeLabel('sonstwas', tDe)).toBe('sonstwas');
	});
});

describe('movementSourceLabel', () => {
	it('benennt die Herkunft', () => {
		expect(movementSourceLabel('scan', tDe)).toBe('Scanner');
		expect(movementSourceLabel('lieferung', tDe)).toBe('Lieferung');
		expect(movementSourceLabel('inventur', tEn)).toBe('Stocktake');
	});

	it('verträgt fehlende und unbekannte Werte', () => {
		expect(movementSourceLabel(null, tDe)).toBe('');
		expect(movementSourceLabel('altbestand', tDe)).toBe('altbestand');
	});
});

describe('movementAmountLabel', () => {
	it('zeigt Zu- und Abgänge mit Vorzeichen', () => {
		expect(movementAmountLabel('in', 3, tDe)).toBe('+3');
		expect(movementAmountLabel('out', -2, tDe)).toBe('−2');
		expect(movementAmountLabel('correction', 4, tDe)).toBe('+4');
	});

	it('zeigt Umlagerungen ohne Vorzeichen — der Gesamtbestand bleibt gleich', () => {
		expect(movementAmountLabel('move', 5, tDe)).toBe('5×');
	});

	it('kennzeichnet reine MHD-Korrekturen statt „+0"', () => {
		expect(movementAmountLabel('correction', 0, tDe)).toBe('MHD');
		expect(movementAmountLabel('correction', 0, tEn)).toBe('BBD');
		expect(movementAmountLabel('correction', 0, tNl)).toBe('THT');
	});
});

describe('movementAmountClass', () => {
	it('färbt nach Wirkung auf den Bestand', () => {
		expect(movementAmountClass('in', 2)).toContain('green');
		expect(movementAmountClass('out', -2)).toContain('amber');
		expect(movementAmountClass('move', 2)).toContain('gray');
		expect(movementAmountClass('correction', 0)).toContain('gray');
	});
});
