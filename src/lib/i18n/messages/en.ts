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
	'nav.stock': 'Stock',
	'nav.stocktake': 'Stocktake',
	'nav.items': 'Items',
	'nav.recipes': 'Recipes',
	'nav.order': 'Order',
	'nav.scan': 'Scan',
	'nav.delivery': 'Check delivery',
	'nav.journal': 'Journal',
	'nav.users': 'Users',
	'nav.locations': 'Storage locations',
	'nav.account': 'Account',

	'stock.title': 'Stock',
	'stock.summary': '{packs} in stock · {items} in the catalogue',
	'stock.items_one': '{n} item',
	'stock.items_other': '{n} items',
	'stock.expiringSoon': 'Expiring soon',
	'stock.locations': 'Storage locations',
	'stock.empty': 'Nothing in stock',
	'stock.deliveryShort': 'Delivery',
	'stock.journalShort': 'Journal',

	'mhd.none': 'no best-before date',
	'mhd.expired': 'expired ({n} days ago)',
	'mhd.expiredYesterday': 'expired yesterday',
	'mhd.today': 'expires today',
	'mhd.tomorrow': 'expires tomorrow',
	'mhd.inDays': 'in {n} days',
	'mhd.label': 'best before {date}',

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
