import type { Messages } from './en';

/** Deutsche Texte. Schlüssel und Vollständigkeit erzwingt der Typ aus en.ts. */
export const de: Messages = {
	'nav.stock': 'Lager',
	'nav.stocktake': 'Inventur',
	'nav.items': 'Artikel',
	'nav.recipes': 'Rezepte',
	'nav.order': 'Bestellen',
	'nav.scan': 'Scannen',
	'nav.delivery': 'Lieferung prüfen',
	'nav.journal': 'Journal',
	'nav.users': 'Benutzer',
	'nav.locations': 'Lagerorte',
	'nav.account': 'Konto',

	'stock.title': 'Lager',
	'stock.summary': '{packs} im Bestand · {items} im Stamm',
	'stock.items_one': '{n} Artikel',
	'stock.items_other': '{n} Artikel',
	'stock.expiringSoon': 'Läuft bald ab',
	'stock.locations': 'Lagerorte',
	'stock.empty': 'Keine Bestände',
	'stock.deliveryShort': 'Lieferung',
	'stock.journalShort': 'Journal',

	'mhd.none': 'kein MHD',
	'mhd.expired': 'abgelaufen ({n} Tage)',
	'mhd.expiredYesterday': 'seit gestern abgelaufen',
	'mhd.today': 'läuft heute ab',
	'mhd.tomorrow': 'läuft morgen ab',
	'mhd.inDays': 'in {n} Tagen',
	'mhd.label': 'MHD {date}',

	'account.language.title': 'Sprache',
	'account.language.description': 'Gilt für dieses Konto auf allen Geräten.',
	'account.language.system': 'Systemsprache ({name})',
	'account.language.save': 'Speichern',
	'account.language.saved': 'Sprache geändert.',
	'account.language.invalid': 'Unbekannte Sprache.',

	'common.packs_one': '{n} Gebinde',
	'common.packs_other': '{n} Gebinde'
};
