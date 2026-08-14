import { describe, expect, it } from 'vitest';
import {
	movementAmountClass,
	movementAmountLabel,
	movementSourceLabel,
	movementTypeLabel
} from './journal';

describe('movementTypeLabel', () => {
	it('benennt die Buchungsarten deutsch', () => {
		expect(movementTypeLabel('in')).toBe('Zugang');
		expect(movementTypeLabel('out')).toBe('Abgang');
		expect(movementTypeLabel('move')).toBe('Umlagerung');
		expect(movementTypeLabel('correction')).toBe('Korrektur');
	});

	it('gibt Unbekanntes unverändert zurück', () => {
		expect(movementTypeLabel('sonstwas')).toBe('sonstwas');
	});
});

describe('movementSourceLabel', () => {
	it('benennt die Herkunft', () => {
		expect(movementSourceLabel('scan')).toBe('Scanner');
		expect(movementSourceLabel('lieferung')).toBe('Lieferung');
	});

	it('verträgt fehlende und unbekannte Werte', () => {
		expect(movementSourceLabel(null)).toBe('');
		expect(movementSourceLabel('altbestand')).toBe('altbestand');
	});
});

describe('movementAmountLabel', () => {
	it('zeigt Zu- und Abgänge mit Vorzeichen', () => {
		expect(movementAmountLabel('in', 3)).toBe('+3');
		expect(movementAmountLabel('out', -2)).toBe('−2');
		expect(movementAmountLabel('correction', 4)).toBe('+4');
	});

	it('zeigt Umlagerungen ohne Vorzeichen — der Gesamtbestand bleibt gleich', () => {
		expect(movementAmountLabel('move', 5)).toBe('5×');
	});

	it('kennzeichnet reine MHD-Korrekturen statt „+0"', () => {
		expect(movementAmountLabel('correction', 0)).toBe('MHD');
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
