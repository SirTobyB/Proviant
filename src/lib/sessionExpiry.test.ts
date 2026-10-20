import { describe, expect, it } from 'vitest';
import { RENEW_INTERVAL_MS, SESSION_MS, renewedExpiry, sessionExpiry } from './sessionExpiry';

const JETZT = new Date('2026-10-20T12:00:00Z');
const vor = (ms: number) => new Date(JETZT.getTime() - ms);
const nach = (ms: number) => new Date(JETZT.getTime() + ms);

describe('sessionExpiry', () => {
	it('liegt SESSION_DAYS Tage in der Zukunft', () => {
		expect(sessionExpiry(JETZT)).toEqual(nach(SESSION_MS));
	});
});

describe('renewedExpiry', () => {
	it('verlängert eine frisch angelegte Sitzung nicht', () => {
		// Sonst schriebe jeder Request in die Datenbank
		expect(renewedExpiry(sessionExpiry(JETZT), JETZT)).toBeNull();
		expect(renewedExpiry(sessionExpiry(vor(RENEW_INTERVAL_MS - 1)), JETZT)).toBeNull();
	});

	it('verlängert, sobald die Sitzung einen Tag alt ist', () => {
		expect(renewedExpiry(sessionExpiry(vor(RENEW_INTERVAL_MS)), JETZT)).toEqual(sessionExpiry(JETZT));
	});

	it('verlängert kurz vor Ablauf auf volle Laufzeit', () => {
		expect(renewedExpiry(nach(60_000), JETZT)).toEqual(sessionExpiry(JETZT));
	});

	it('belebt eine abgelaufene Sitzung nicht wieder', () => {
		expect(renewedExpiry(JETZT, JETZT)).toBeNull();
		expect(renewedExpiry(vor(1), JETZT)).toBeNull();
	});
});
