/**
 * Picnic-Fehler → verständliche Fehlerart für die Oberfläche.
 * Rein und ohne SvelteKit-Import, damit eigenständig testbar.
 *
 * Erkannt wird bewusst per Duck-Typing (Name, `status`, `code`) statt per
 * `instanceof`: die Fehlerklassen stammen aus picnic-api, und ein zweites
 * Exemplar der Bibliothek im Bundle ließe `instanceof` still scheitern. Picnic
 * unterscheidet seine Fehler am eigenen `code`, nicht am Text — deshalb ist
 * der Text nie Entscheidungsgrundlage.
 *
 * Die Oberfläche zeigt `t(\`picnic.error.${kind}\`)`; der Rohfehler gehört
 * ins Log, nicht vor den Anwender.
 */
export type PicnicErrorKind =
	| 'sessionExpired'
	| 'invalidCredentials'
	| 'invalidCode'
	| 'notConfigured'
	| 'needs2FA'
	| 'productNotFound'
	| 'unreachable'
	| 'unexpectedFormat'
	| 'rateLimited'
	| 'unknown';

/** Eigene Fehler des Adapters, deren Art schon beim Werfen feststeht. */
export class PicnicAdapterError extends Error {
	readonly kind: PicnicErrorKind;
	constructor(kind: PicnicErrorKind, message: string = kind) {
		super(message);
		this.name = 'PicnicAdapterError';
		this.kind = kind;
	}
}

const NETWORK_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT']);

function field(value: unknown, key: string): unknown {
	return value != null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

export function picnicErrorKind(err: unknown): PicnicErrorKind {
	if (err == null || typeof err !== 'object') return 'unknown';

	if (err instanceof PicnicAdapterError) return err.kind;

	const name = field(err, 'name');
	if (name === 'ProductNotFoundError') return 'productNotFound';
	if (name === 'UnexpectedPageFormatError') return 'unexpectedFormat';

	const status = field(err, 'status');
	if (typeof status === 'number') {
		const code = field(err, 'code');
		if (code === 'AUTH_INVALID_CRED') return 'invalidCredentials';
		if (code === 'OTP_NOT_VALID') return 'invalidCode';
		if (status === 401) return 'sessionExpired';
		if (status === 429 || (status === 403 && code == null)) return 'rateLimited';
		if (status >= 500) return 'unreachable';
		return 'unknown';
	}

	// Netzfehler: Node-fetch wirft `TypeError: fetch failed`, der eigentliche
	// Code steckt dann in `cause`
	const code = field(err, 'code') ?? field(field(err, 'cause'), 'code');
	if (typeof code === 'string' && NETWORK_CODES.has(code)) return 'unreachable';
	if (err instanceof TypeError && /fetch/i.test(err.message)) return 'unreachable';

	return 'unknown';
}
