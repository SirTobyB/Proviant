/**
 * Ablaufregel der Anmelde-Sitzung — gleitend: Wer die App benutzt, bleibt
 * angemeldet; erst nach SESSION_DAYS Tagen ohne Nutzung ist ein neuer Login
 * fällig. Reines Modul, damit die Regel ohne Datenbank testbar ist.
 */

export const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;
export const SESSION_MS = SESSION_DAYS * DAY_MS;

/**
 * Verlängert wird höchstens einmal je Tag und Sitzung. Bei jedem Request zu
 * schreiben hieße eine DB-Schreibung (plus Set-Cookie) für jedes Bild und
 * jeden Datenabruf — für ein Fenster von 30 Tagen ist ein Tag Unschärfe egal.
 */
export const RENEW_INTERVAL_MS = DAY_MS;

/** Ablaufzeitpunkt einer jetzt angelegten bzw. verlängerten Sitzung. */
export function sessionExpiry(now: Date): Date {
	return new Date(now.getTime() + SESSION_MS);
}

/**
 * Neuer Ablaufzeitpunkt, falls die Sitzung verlängert werden soll — sonst
 * null (noch frisch genug oder bereits abgelaufen; eine abgelaufene Sitzung
 * darf nicht wiederbelebt werden).
 */
export function renewedExpiry(expiresAt: Date, now: Date): Date | null {
	const rest = expiresAt.getTime() - now.getTime();
	if (rest <= 0) return null;
	if (rest > SESSION_MS - RENEW_INTERVAL_MS) return null;
	return sessionExpiry(now);
}
