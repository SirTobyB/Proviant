import { describe, expect, it } from 'vitest';
import { deliveryEtaText, nextOpenDelivery, wantsLivePosition } from './deliveryEta';
import { translator } from './i18n';

// Lokale Zeiten wie in der App (Anzeige läuft im Browser des Nutzers)
const JETZT = new Date(2026, 10, 20, 9, 0); // Fr, 20.11.2026, 09:00
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).toISOString();

describe('nextOpenDelivery', () => {
	it('nimmt die offene Lieferung mit dem frühesten Fenster', () => {
		const list = [
			{ id: 'a', status: 'CURRENT', windowStart: at(24, 18) },
			{ id: 'b', status: 'COMPLETED', windowStart: at(18, 18) },
			{ id: 'c', status: 'CURRENT', windowStart: at(22, 18) },
			{ id: 'd', status: 'CANCELLED', windowStart: at(21, 18) }
		];
		expect(nextOpenDelivery(list)?.id).toBe('c');
	});

	it('überspringt Lieferungen ohne Fenster', () => {
		expect(nextOpenDelivery([{ id: 'a', status: 'CURRENT', windowStart: null }])).toBeNull();
		expect(nextOpenDelivery([])).toBeNull();
	});
});

describe('wantsLivePosition', () => {
	it('fragt erst ab 12 Stunden vor Fensterbeginn live ab', () => {
		expect(wantsLivePosition(at(20, 20), JETZT)).toBe(true); // in 11 h
		expect(wantsLivePosition(at(20, 22), JETZT)).toBe(false); // in 13 h
	});

	it('fragt weiter ab, wenn das Fenster schon begonnen hat oder vorbei ist', () => {
		expect(wantsLivePosition(at(20, 8), JETZT)).toBe(true);
	});

	it('verträgt kaputte Zeitstempel', () => {
		expect(wantsLivePosition('kein Datum', JETZT)).toBe(false);
	});
});

describe('deliveryEtaText', () => {
	const de = translator('de');

	it('zeigt vor dem Liefertag Tag und Fenster', () => {
		const text = deliveryEtaText({ windowStart: at(24, 18), windowEnd: at(24, 19), eta: null }, de, 'de', JETZT);
		expect(text.main).toBe('Di., 24.11., 18:00–19:00');
		expect(text.window).toBeNull();
	});

	it('sagt „Heute“ und „Morgen“', () => {
		expect(deliveryEtaText({ windowStart: at(20, 18), windowEnd: at(20, 19), eta: null }, de, 'de', JETZT).main).toBe(
			'Heute, 18:00–19:00'
		);
		expect(deliveryEtaText({ windowStart: at(21, 7), windowEnd: at(21, 8), eta: null }, de, 'de', JETZT).main).toBe(
			'Morgen, 07:00–08:00'
		);
	});

	it('zeigt mit Live-ETA die genaue Zeit und das gebuchte Fenster daneben', () => {
		const text = deliveryEtaText({ windowStart: at(20, 18), windowEnd: at(20, 19), eta: at(20, 18, 24) }, de, 'de', JETZT);
		expect(text.main).toBe('Heute ca. 18:24');
		expect(text.window).toBe('Fenster 18:00–19:00');
	});

	it('kommt ohne Fensterende aus', () => {
		expect(deliveryEtaText({ windowStart: at(20, 18), windowEnd: null, eta: null }, de, 'de', JETZT).main).toBe('Heute, 18:00');
	});

	it('formatiert Englisch im en-GB-Stil', () => {
		const en = translator('en');
		expect(deliveryEtaText({ windowStart: at(24, 18), windowEnd: at(24, 19), eta: null }, en, 'en', JETZT).main).toBe(
			'Tue 24/11, 18:00–19:00'
		);
	});
});
