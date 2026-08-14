/**
 * Sprachen der Oberfläche und ihre Aushandlung.
 *
 * Reines Modul ohne DB- oder SvelteKit-Bezug, damit die Auswahllogik testbar
 * bleibt — dort steckt der Teil, den man leicht falsch macht (Header-Parsing).
 */

export const LOCALES = ['en', 'de', 'nl'] as const;
export type Locale = (typeof LOCALES)[number];

/** Sprache, wenn weder Benutzer noch Browser etwas Passendes hergeben. */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * BCP-47-Kennung fürs Formatieren von Datum und Zahlen.
 * Englisch bewusst als en-GB: metrische Einheiten und Tag/Monat/Jahr passen
 * zum Rest der App, en-US würde 08/14/2026 schreiben.
 */
export const BCP47: Record<Locale, string> = {
	en: 'en-GB',
	de: 'de-DE',
	nl: 'nl-NL'
};

/** Eigenbezeichnung — eine Sprachauswahl zeigt jede Sprache in sich selbst. */
export const LOCALE_LABEL: Record<Locale, string> = {
	en: 'English',
	de: 'Deutsch',
	nl: 'Nederlands'
};

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Wertet einen `Accept-Language`-Header aus und liefert die erste unterstützte
 * Sprache. Regionen werden dabei abgeschnitten (`de-AT` zählt als `de`), und
 * die q-Gewichte entscheiden die Reihenfolge — ohne q gilt 1.
 *
 * Beispiel: "nl-NL,nl;q=0.9,en;q=0.8" → 'nl'
 */
export function localeFromHeader(header: string | null | undefined): Locale | null {
	if (!header) return null;
	const candidates = header
		.split(',')
		.map((teil) => {
			const [tag, ...parameter] = teil.trim().split(';');
			const q = parameter
				.map((p) => /^\s*q=([0-9.]+)\s*$/.exec(p))
				.find(Boolean)?.[1];
			return { tag: tag.trim().toLowerCase(), q: q === undefined ? 1 : Number(q) };
		})
		// Ungültige q-Werte fliegen raus, sonst sortiert NaN unvorhersehbar
		.filter((k) => k.tag && Number.isFinite(k.q) && k.q > 0)
		.sort((a, b) => b.q - a.q);

	for (const { tag } of candidates) {
		const basis = tag.split('-')[0];
		if (isLocale(basis)) return basis;
	}
	return null;
}

/**
 * Die geltende Sprache einer Anfrage, in dieser Reihenfolge:
 * 1. ausdrückliche Wahl des angemeldeten Benutzers
 * 2. gemerkte Wahl im Cookie (gilt auch auf der Anmeldeseite, wo es noch
 *    keinen Benutzer gibt)
 * 3. Systemsprache des Browsers
 * 4. DEFAULT_LOCALE
 *
 * Der Benutzer schlägt das Cookie, damit die Einstellung auch auf einem
 * fremden Gerät sofort greift.
 */
export function resolveLocale(quellen: {
	user?: string | null;
	cookie?: string | null;
	acceptLanguage?: string | null;
}): Locale {
	if (isLocale(quellen.user)) return quellen.user;
	if (isLocale(quellen.cookie)) return quellen.cookie;
	return localeFromHeader(quellen.acceptLanguage) ?? DEFAULT_LOCALE;
}
