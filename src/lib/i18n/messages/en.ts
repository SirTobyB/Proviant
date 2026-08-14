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

	'stocktake.title': 'Stocktake',
	'stocktake.description':
		'Everything in stock at a glance — enter the counted amount and save, the difference is booked automatically.',
	'stocktake.search': 'Search items …',
	'stocktake.emptyFiltered': 'No stock matches this filter.',
	'stocktake.empty': 'Nothing in stock.',
	'stocktake.countedLabel': 'Counted amount',
	'stocktake.saveLabel': 'Save counted amount',
	'stocktake.hint':
		'A surplus is booked into the default location without a best-before date, a shortfall is booked out by nearest best-before date first. To correct individual batches, open the storage location.',

	'items.title': 'Items',
	'items.count_one': '{n} item in the catalogue',
	'items.count_other': '{n} items in the catalogue',
	'items.picnicImport': 'Picnic import',
	'items.new': 'New item',
	'items.search': 'Search (name or EAN) …',
	'items.emptyFiltered': 'No items found.',
	'items.empty': 'No items yet — create the first one!',
	'items.bookOut': 'Book out',
	'items.bookIn': 'Book in',
	'items.quantityLabel': 'Booking quantity',
	'items.minStock': 'min. {n}',

	'item.new.title': 'New item',
	'item.new.submit': 'Create item',
	'item.edit.title': 'Edit item',
	'item.edit.submit': 'Save',
	'item.stock.title': 'Stock',
	'item.stock.empty': 'Nothing in stock.',
	'item.stock.moved': 'Moved to “{name}”.',
	'item.delete': 'Delete item',
	'item.deleteConfirm': 'Really delete “{name}”? Its stock will be deleted along with it.',
	'item.deleteYes': 'Yes, delete',

	'form.ean': 'EAN / barcode',
	'form.eanPlaceholder': 'e.g. 4311501043271',
	'form.lookup': 'Look up',
	'form.searching': 'Searching …',
	'form.lookupNotFound': 'Not found in Open Food Facts — please fill in manually.',
	'form.lookupFailed': 'Lookup failed.',
	'form.name': 'Name *',
	'form.packageSize': 'Pack size',
	'form.packageSizePlaceholder': 'e.g. 500',
	'form.unit': 'Unit',
	// Wert bleibt „Stück" in der Datenbank — hier nur die Beschriftung
	'form.unitPiece': 'pcs',
	'form.minStock': 'Minimum stock',
	'form.minStockHint': '0 = never suggested for ordering',
	'form.defaultLocation': 'Default location',
	'form.tags': 'Tags',
	'form.tagsPlaceholder': 'Type a tag (e.g. drinks, frozen) and press Enter',
	'form.picnicLink': 'Picnic link',
	'form.picnicLinked': '✓ Linked (ID {id})',
	'form.picnicRemove': 'Remove',
	'form.picnicSearchPlaceholder': 'Search term',
	'form.picnicSearch': 'Search in Picnic',
	'form.picnicSearchFailed': 'Picnic search failed',
	'form.picnicNoResults': 'No matches.',
	'form.picnicIdPlaceholder': 'Or enter a Picnic ID directly (e.g. s1027848)',
	'form.picnicIdApply': 'Apply',
	'form.image': 'Picture',
	'form.imagePreview': 'Preview',
	'form.imageNone': 'No picture',
	'form.imageChoose': 'Choose photo',
	'form.imageHint': 'Otherwise taken automatically from Open Food Facts or Picnic.',
	'form.saving': 'Saving …',
	'form.cancel': 'Cancel',

	'tags.placeholder': 'Type a tag and press Enter',
	'tags.remove': 'Remove tag',

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
