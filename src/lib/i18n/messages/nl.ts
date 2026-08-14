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

	'stocktake.title': 'Inventarisatie',
	'stocktake.description':
		'De volledige voorraad in één oogopslag — vul het getelde aantal in en sla op, het verschil wordt automatisch geboekt.',
	'stocktake.search': 'Artikelen zoeken …',
	'stocktake.emptyFiltered': 'Geen voorraad gevonden voor dit filter.',
	'stocktake.empty': 'Geen voorraad aanwezig.',
	'stocktake.countedLabel': 'Geteld aantal',
	'stocktake.saveLabel': 'Geteld aantal opslaan',
	'stocktake.hint':
		'Een overschot wordt zonder THT op de standaardlocatie geboekt, een tekort wordt uitgeboekt op eerst verlopende THT. Open de betreffende voorraadlocatie om afzonderlijke partijen te corrigeren.',

	'items.title': 'Artikelen',
	'items.count_one': '{n} artikel in het bestand',
	'items.count_other': '{n} artikelen in het bestand',
	'items.picnicImport': 'Picnic-import',
	'items.new': 'Nieuw artikel',
	'items.search': 'Zoeken (naam of EAN) …',
	'items.emptyFiltered': 'Geen artikelen gevonden.',
	'items.empty': 'Nog geen artikelen — maak het eerste aan!',
	'items.bookOut': 'Uitboeken',
	'items.bookIn': 'Inboeken',
	'items.quantityLabel': 'Boekingsaantal',
	'items.minStock': 'min. {n}',

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
