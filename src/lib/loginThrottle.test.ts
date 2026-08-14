import { describe, expect, it } from 'vitest';
import {
	LOCK_THRESHOLD,
	MAX_LOCK_MS,
	RESET_AFTER_MS,
	isStale,
	lockoutMs,
	remainingLockMinutes,
	remainingLockMs
} from './loginThrottle';

describe('lockoutMs', () => {
	it('sperrt unterhalb der Schwelle nicht', () => {
		// Vertippen muss folgenlos bleiben, sonst sperrt sich die Familie selbst aus
		for (let n = 0; n < LOCK_THRESHOLD; n++) {
			expect(lockoutMs(n), `${n} Fehlversuche`).toBe(0);
		}
	});

	it('sperrt ab der Schwelle zunächst eine Minute', () => {
		expect(lockoutMs(LOCK_THRESHOLD)).toBe(60_000);
	});

	it('verdoppelt mit jedem weiteren Fehlversuch', () => {
		expect(lockoutMs(LOCK_THRESHOLD + 1)).toBe(2 * 60_000);
		expect(lockoutMs(LOCK_THRESHOLD + 2)).toBe(4 * 60_000);
		expect(lockoutMs(LOCK_THRESHOLD + 3)).toBe(8 * 60_000);
	});

	it('deckelt die Sperre', () => {
		// Ohne Deckel wären es nach 20 Fehlversuchen Jahre — faktisch eine
		// dauerhafte Sperre, mit der sich jeder Benutzer aussperren liesse
		expect(lockoutMs(LOCK_THRESHOLD + 4)).toBe(MAX_LOCK_MS);
		expect(lockoutMs(50)).toBe(MAX_LOCK_MS);
		expect(lockoutMs(500)).toBe(MAX_LOCK_MS);
	});
});

describe('isStale', () => {
	const jetzt = new Date('2026-08-14T12:00:00Z');

	it('hält frische Zählungen', () => {
		expect(isStale(new Date(jetzt.getTime() - 60_000), jetzt)).toBe(false);
		expect(isStale(new Date(jetzt.getTime() - (RESET_AFTER_MS - 1)), jetzt)).toBe(false);
	});

	it('verwirft Zählungen nach Ablauf des Fensters', () => {
		expect(isStale(new Date(jetzt.getTime() - RESET_AFTER_MS), jetzt)).toBe(true);
		expect(isStale(new Date(jetzt.getTime() - 7 * 86_400_000), jetzt)).toBe(true);
	});
});

describe('remainingLockMs', () => {
	const jetzt = new Date('2026-08-14T12:00:00Z');

	it('ist 0 ohne Sperre', () => {
		expect(remainingLockMs(null, jetzt)).toBe(0);
	});

	it('ist 0, wenn die Sperre abgelaufen ist', () => {
		expect(remainingLockMs(new Date(jetzt.getTime() - 1), jetzt)).toBe(0);
	});

	it('liefert die Restzeit', () => {
		expect(remainingLockMs(new Date(jetzt.getTime() + 90_000), jetzt)).toBe(90_000);
	});
});

describe('remainingLockMinutes', () => {
	it('rundet auf und meldet nie 0', () => {
		// „Bitte in 0 Minuten erneut versuchen" wäre keine Auskunft
		expect(remainingLockMinutes(1)).toBe(1);
		expect(remainingLockMinutes(60_000)).toBe(1);
		expect(remainingLockMinutes(60_001)).toBe(2);
		expect(remainingLockMinutes(MAX_LOCK_MS)).toBe(15);
	});
});
