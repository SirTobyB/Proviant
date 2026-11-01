import { describe, expect, it } from 'vitest';
import { PicnicAdapterError, picnicErrorKind } from './errors';

/** Nachbau eines `PicnicApiError` aus picnic-api: Status + Picnics eigener Code. */
function apiError(status: number, code: string | null): Error {
	return Object.assign(new Error(`HTTP ${status}`), { name: 'PicnicApiError', status, code, body: '' });
}

describe('picnicErrorKind', () => {
	it('erkennt eine abgelaufene Anmeldung am 401 ohne Code', () => {
		expect(picnicErrorKind(apiError(401, null))).toBe('sessionExpired');
		expect(picnicErrorKind(apiError(401, 'AUTH_ERROR'))).toBe('sessionExpired');
	});

	it('unterscheidet falsche Zugangsdaten und falschen 2FA-Code', () => {
		expect(picnicErrorKind(apiError(401, 'AUTH_INVALID_CRED'))).toBe('invalidCredentials');
		expect(picnicErrorKind(apiError(400, 'OTP_NOT_VALID'))).toBe('invalidCode');
	});

	it('wertet 403 ohne Code (Edge-Drosselung) und 429 als Bremse', () => {
		expect(picnicErrorKind(apiError(403, null))).toBe('rateLimited');
		expect(picnicErrorKind(apiError(429, null))).toBe('rateLimited');
	});

	it('wertet Serverfehler und Netzfehler als nicht erreichbar', () => {
		expect(picnicErrorKind(apiError(503, null))).toBe('unreachable');
		expect(picnicErrorKind(new TypeError('fetch failed'))).toBe('unreachable');
		expect(picnicErrorKind(Object.assign(new Error('connect'), { code: 'ECONNREFUSED' }))).toBe('unreachable');
		expect(picnicErrorKind(Object.assign(new Error('x'), { cause: { code: 'ENOTFOUND' } }))).toBe('unreachable');
	});

	it('erkennt die Fehlerklassen der Bibliothek am Namen', () => {
		expect(picnicErrorKind(Object.assign(new Error('x'), { name: 'ProductNotFoundError', productId: 's1' }))).toBe(
			'productNotFound'
		);
		expect(picnicErrorKind(Object.assign(new Error('x'), { name: 'UnexpectedPageFormatError' }))).toBe(
			'unexpectedFormat'
		);
	});

	// Live (picnic-api 5.3): unbekannte Produkt-ID beim Hinzufügen zum Warenkorb
	it('wertet 404 NOT_FOUND als nicht mehr erhältliches Produkt', () => {
		expect(picnicErrorKind(apiError(404, 'NOT_FOUND'))).toBe('productNotFound');
	});

	it('übernimmt die Art aus eigenen Adapterfehlern', () => {
		expect(picnicErrorKind(new PicnicAdapterError('needs2FA'))).toBe('needs2FA');
		expect(picnicErrorKind(new PicnicAdapterError('notConfigured'))).toBe('notConfigured');
	});

	it('meldet Unbekanntes als unknown, ohne zu werfen', () => {
		expect(picnicErrorKind(new Error('irgendwas'))).toBe('unknown');
		expect(picnicErrorKind(apiError(400, 'SOMETHING_ELSE'))).toBe('unknown');
		expect(picnicErrorKind('kaputt')).toBe('unknown');
		expect(picnicErrorKind(null)).toBe('unknown');
	});
});
