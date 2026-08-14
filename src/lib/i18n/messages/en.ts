/**
 * Englische Texte — **Quelle der Wahrheit** für alle Sprachen.
 *
 * Die anderen Wörterbücher sind gegen die Schlüssel dieser Datei typisiert:
 * fehlt dort einer, schlägt `npm run check` fehl. Vergessene Übersetzungen
 * können deshalb gar nicht erst ins Deployment.
 *
 * Konventionen:
 * - Schlüssel sind englisch und nach Bereich gruppiert (`account.language`).
 * - Platzhalter in geschweiften Klammern: `{name}`.
 * - Zählbares als Paar `…_one` / `…_other`; aufgerufen wird der Schlüssel ohne
 *   Suffix, die Auswahl trifft `Intl.PluralRules` (siehe translate.ts).
 */
export const en = {
	'account.language.title': 'Language',
	'account.language.description': 'Applies to this account on every device.',
	'account.language.system': 'System language ({name})',
	'account.language.save': 'Save',
	'account.language.saved': 'Language updated.',
	'account.language.invalid': 'Unknown language.',

	'common.packs_one': '{n} pack',
	'common.packs_other': '{n} packs'
} as const;

/** Vollständiges Wörterbuch — die anderen Sprachen erfüllen genau diesen Typ. */
export type Messages = Record<keyof typeof en, string>;
