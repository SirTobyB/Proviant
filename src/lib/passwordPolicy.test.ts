import { describe, expect, it } from 'vitest';
import { MIN_PASSWORD_LENGTH, passwordTooShort } from './passwordPolicy';

describe('passwordTooShort', () => {
	it('verlangt mindestens 12 Zeichen', () => {
		// Die Anmeldung steht im Internet; 6 Zeichen hielten gezieltem Raten nicht lange stand
		expect(MIN_PASSWORD_LENGTH).toBe(12);
		expect(passwordTooShort('a'.repeat(11))).toBe(true);
		expect(passwordTooShort('a'.repeat(12))).toBe(false);
	});

	it('zählt Zeichen, nicht UTF-16-Einheiten', () => {
		// Ein Emoji sind zwei UTF-16-Einheiten — mit .length käme man mit 6 davon durch
		expect(passwordTooShort('🔑'.repeat(6))).toBe(true);
		expect(passwordTooShort('🔑'.repeat(12))).toBe(false);
	});

	it('lehnt das leere Passwort ab', () => {
		expect(passwordTooShort('')).toBe(true);
	});
});
