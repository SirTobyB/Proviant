/**
 * Mindestanforderung an Passwörter — an einer Stelle, damit Benutzerverwaltung,
 * Konto-Seite und der Admin-Seed beim ersten Start dieselbe Regel anwenden.
 *
 * Die Anmeldung steht im Internet. Die Sperre je Benutzername bremst Raten auf
 * wenige Versuche pro Stunde, aber nur ein ausreichend langes Passwort macht
 * es aussichtslos. Länge zählt mehr als Zeichenklassen, deshalb nur eine
 * Mindestlänge und keine Pflicht zu Ziffern oder Sonderzeichen.
 */
export const MIN_PASSWORD_LENGTH = 12;

/** Ob das Passwort die Mindestlänge unterschreitet (gezählt in Zeichen). */
export function passwordTooShort(password: string): boolean {
	// Spread zählt Codepoints: ein Emoji ist ein Zeichen, nicht zwei
	return [...password].length < MIN_PASSWORD_LENGTH;
}
