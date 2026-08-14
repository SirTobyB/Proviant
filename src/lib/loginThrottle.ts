/**
 * Regeln für die Sperre nach fehlgeschlagenen Anmeldeversuchen.
 *
 * Reines Modul ohne DB- oder SvelteKit-Bezug: Hier steckt die Rechnerei, die
 * man leicht falsch macht (Schwelle, Verdopplung, Deckel, Rundung auf Minuten),
 * und genau die lässt sich so einzeln prüfen.
 *
 * Der Zuschnitt ist auf eine Familien-App gemünzt, deren Anmeldung im Internet
 * steht: Gesperrt wird **je Benutzername** und nur **auf Zeit**. Eine dauerhafte
 * Sperre wäre hier das größere Übel — wer den Namen kennt, könnte sonst jedes
 * Familienmitglied beliebig aussperren.
 */

/** Ab dem wievielten Fehlversuch überhaupt gesperrt wird. */
export const LOCK_THRESHOLD = 5;

/** Obergrenze einer einzelnen Sperre. */
export const MAX_LOCK_MS = 15 * 60_000;

/**
 * Nach dieser Zeit ohne weiteren Fehlversuch beginnt die Zählung von vorn.
 * Ohne das käme jemand, der vor Wochen viermal danebengetippt hat, beim
 * nächsten Tippfehler sofort in die Sperre.
 */
export const RESET_AFTER_MS = 60 * 60_000;

/**
 * Dauer der Sperre nach `failedCount` Fehlversuchen.
 *
 * Unterhalb der Schwelle 0 (keine Sperre), danach 1, 2, 4, 8 Minuten und ab
 * dann gedeckelt. Die Verdopplung macht gezieltes Durchprobieren schnell
 * sinnlos, während ein normaler Vertipper folgenlos bleibt.
 */
export function lockoutMs(failedCount: number): number {
	if (failedCount < LOCK_THRESHOLD) return 0;
	return Math.min(60_000 * 2 ** (failedCount - LOCK_THRESHOLD), MAX_LOCK_MS);
}

/** Ob die bisherige Zählung verfallen ist (zu lange her). */
export function isStale(lastFailedAt: Date, now: Date): boolean {
	return now.getTime() - lastFailedAt.getTime() >= RESET_AFTER_MS;
}

/** Verbleibende Sperrzeit in Millisekunden; 0, wenn nicht (mehr) gesperrt. */
export function remainingLockMs(lockedUntil: Date | null, now: Date): number {
	if (!lockedUntil) return 0;
	return Math.max(0, lockedUntil.getTime() - now.getTime());
}

/**
 * Verbleibende Sperrzeit als Minuten für die Meldung an den Anwender.
 *
 * Aufgerundet und mindestens 1: „noch 0 Minuten" wäre keine Auskunft, und
 * abgerundet ließe die Meldung es zu früh erscheinen.
 */
export function remainingLockMinutes(remainingMs: number): number {
	return Math.max(1, Math.ceil(remainingMs / 60_000));
}
