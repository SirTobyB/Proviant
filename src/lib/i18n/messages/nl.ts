import type { Messages } from './en';

/** Niederländische Texte. Schlüssel und Vollständigkeit erzwingt der Typ aus en.ts. */
export const nl: Messages = {
	'nav.stock': 'Voorraad',
	'nav.stocktake': 'Inventarisatie',
	'nav.items': 'Artikelen',
	'nav.recipes': 'Recepten',
	'nav.order': 'Bestellen',
	'nav.scan': 'Scannen',
	'nav.delivery': 'Levering controleren',
	'nav.journal': 'Journaal',
	'nav.users': 'Gebruikers',
	'nav.locations': 'Voorraadlocaties',
	'nav.account': 'Account',

	'stock.title': 'Voorraad',
	'stock.summary': '{packs} op voorraad · {items} in het bestand',
	'stock.items_one': '{n} artikel',
	'stock.items_other': '{n} artikelen',
	'stock.expiringSoon': 'Verloopt binnenkort',
	'stock.locations': 'Voorraadlocaties',
	'stock.empty': 'Geen voorraad',
	'stock.deliveryShort': 'Levering',
	'stock.journalShort': 'Journaal',

	'mhd.none': 'geen THT',
	'mhd.expired': 'verlopen ({n} dagen geleden)',
	'mhd.expiredYesterday': 'sinds gisteren verlopen',
	'mhd.today': 'verloopt vandaag',
	'mhd.tomorrow': 'verloopt morgen',
	'mhd.inDays': 'over {n} dagen',
	'mhd.label': 'THT {date}',

	'account.language.title': 'Taal',
	'account.language.description': 'Geldt voor dit account op elk apparaat.',
	'account.language.system': 'Systeemtaal ({name})',
	'account.language.save': 'Opslaan',
	'account.language.saved': 'Taal gewijzigd.',
	'account.language.invalid': 'Onbekende taal.',

	'common.packs_one': '{n} verpakking',
	'common.packs_other': '{n} verpakkingen'
};
