import { describe, expect, it } from 'vitest';
import { daysUntil, formatDate, mhdLabel, mhdStatus, MHD_CRITICAL_DAYS, MHD_SOON_DAYS } from './mhd';

const HEUTE = new Date(2026, 4, 20); // 20.05.2026, lokal wie in der App

describe('daysUntil', () => {
	it('zählt ganze Tage bis zum MHD', () => {
		expect(daysUntil('2026-05-20', HEUTE)).toBe(0);
		expect(daysUntil('2026-05-25', HEUTE)).toBe(5);
		expect(daysUntil('2026-05-18', HEUTE)).toBe(-2);
	});

	it('verträgt fehlende und kaputte Werte', () => {
		expect(daysUntil(null, HEUTE)).toBeNull();
		expect(daysUntil('kein Datum', HEUTE)).toBeNull();
	});
});

describe('mhdStatus', () => {
	it('trennt die Ampelstufen an den Schwellen', () => {
		expect(mhdStatus(null, HEUTE)).toBe('none');
		expect(mhdStatus('2026-05-19', HEUTE)).toBe('expired');
		expect(mhdStatus('2026-05-20', HEUTE)).toBe('critical');
		expect(mhdStatus(iso(MHD_CRITICAL_DAYS), HEUTE)).toBe('critical');
		expect(mhdStatus(iso(MHD_CRITICAL_DAYS + 1), HEUTE)).toBe('soon');
		expect(mhdStatus(iso(MHD_SOON_DAYS), HEUTE)).toBe('soon');
		expect(mhdStatus(iso(MHD_SOON_DAYS + 1), HEUTE)).toBe('ok');
	});
});

describe('mhdLabel', () => {
	it('formuliert die Restlaufzeit', () => {
		expect(mhdLabel(null, HEUTE)).toBe('kein MHD');
		expect(mhdLabel('2026-05-19', HEUTE)).toBe('seit gestern abgelaufen');
		expect(mhdLabel('2026-05-17', HEUTE)).toBe('abgelaufen (3 Tage)');
		expect(mhdLabel('2026-05-20', HEUTE)).toBe('läuft heute ab');
		expect(mhdLabel('2026-05-21', HEUTE)).toBe('läuft morgen ab');
		expect(mhdLabel('2026-05-25', HEUTE)).toBe('in 5 Tagen');
	});
});

describe('formatDate', () => {
	it('zeigt das deutsche Format', () => {
		expect(formatDate('2026-05-20')).toBe('20.05.2026');
		expect(formatDate(null)).toBe('');
	});
});

/**
 * ISO-Datum, das `tage` Tage nach HEUTE liegt — bewusst aus den lokalen
 * Datumsteilen gebaut: toISOString() rechnet nach UTC um und verschiebt in
 * unserer Zeitzone auf den Vortag.
 */
function iso(tage: number): string {
	const d = new Date(HEUTE);
	d.setDate(d.getDate() + tage);
	const zweistellig = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}`;
}
