/**
 * Schlichtes Logging nach stdout/stderr — Docker sammelt beides ein, in
 * Portainer ist es direkt lesbar. Bewusst ohne Abhängigkeit: eine Zeile je
 * Ereignis, immer mit Zeitstempel, damit sich ein Vorfall („heute um 7:34")
 * eindeutig zuordnen lässt.
 */

type Details = Record<string, string | number | null | undefined>;

/** Zusatzangaben als `key=wert` anhängen; leere Werte werden weggelassen. */
function format(level: string, message: string, details?: Details): string {
	const parts = Object.entries(details ?? {})
		.filter(([, value]) => value !== undefined && value !== null && value !== '')
		.map(([key, value]) => `${key}=${value}`);
	return `${new Date().toISOString()} [${level}] ${message}${parts.length ? ' ' + parts.join(' ') : ''}`;
}

export function logInfo(message: string, details?: Details): void {
	console.log(format('info', message, details));
}

export function logWarn(message: string, details?: Details): void {
	console.warn(format('warn', message, details));
}

/** Fehler samt Stacktrace; der Stack landet bewusst in derselben Ausgabe. */
export function logError(message: string, error?: unknown, details?: Details): void {
	const stack = error instanceof Error ? error.stack : error != null ? String(error) : '';
	console.error(format('error', message, details) + (stack ? '\n' + stack : ''));
}
