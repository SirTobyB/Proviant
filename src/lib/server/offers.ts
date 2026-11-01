/**
 * Aktuelle Picnic-Angebote für die **eigenen** Artikel.
 *
 * Die Angebotsseite samt Aktionsgruppen kostet gut drei Dutzend Anfragen; sie
 * wird deshalb höchstens einmal je Stunde geholt, danach im Hintergrund
 * aufgefrischt, während noch der alte Stand gilt. Der Zwischenspeicher liegt bewusst
 * auf Modulebene: Er enthält nur sprachunabhängige Picnic-Daten und gilt für
 * alle Anfragen gleichermaßen — **niemals** etwas Anfrage- oder
 * Sprachbezogenes hier ablegen (siehe CLAUDE.md, Mehrsprachigkeit).
 *
 * Was über eigene Artikel bekannt wird, landet zusätzlich im Preis-Cache
 * (`picnic_prices`), damit Bestell- und Rezeptseiten dieselben Preise zeigen.
 */
import { db } from '#lib/server/db/index.js';
import { articles } from '#lib/server/db/schema.js';
import { getConnectionState, getPromotedProducts, type CatalogPrice } from '#lib/server/picnic/index.js';
import { storePrices } from '#lib/server/prices.js';
import { logWarn } from '#lib/server/log.js';
import { isNotNull } from 'drizzle-orm';

const MAX_AGE_MS = 60 * 60 * 1000;

let cache: { at: number; data: Map<string, CatalogPrice> } | null = null;
let inflight: Promise<Map<string, CatalogPrice>> | null = null;

async function promotedProducts(): Promise<Map<string, CatalogPrice>> {
	// Gleichzeitige Aufrufe teilen sich einen Abruf, statt Picnic doppelt zu fragen
	const refresh = () =>
		(inflight ??= getPromotedProducts()
			.then((data) => {
				cache = { at: Date.now(), data };
				return data;
			})
			.finally(() => {
				inflight = null;
			}));

	if (!cache) return refresh();
	// Veraltet: sofort den alten Stand zeigen und im Hintergrund auffrischen.
	// Ein Abruf dauert live über zehn Sekunden (jede Aktionsgruppe einzeln) —
	// darauf soll höchstens der allererste Seitenaufruf warten.
	if (Date.now() - cache.at >= MAX_AGE_MS) {
		refresh().catch((err) =>
			logWarn('Picnic-Angebote nicht auffrischbar', { fehler: err instanceof Error ? err.message : String(err) })
		);
	}
	return cache.data;
}

/**
 * Angebote je Picnic-ID, beschränkt auf eigene Artikel. Ohne Verbindung oder
 * bei einem Fehler leer — die Seiten zeigen dann eben keine Angebote.
 */
export async function currentOffers(): Promise<Map<string, CatalogPrice>> {
	if (getConnectionState() !== 'connected') return new Map();
	let promoted: Map<string, CatalogPrice>;
	try {
		promoted = await promotedProducts();
	} catch (err) {
		logWarn('Picnic-Angebote nicht abrufbar', { fehler: err instanceof Error ? err.message : String(err) });
		return new Map();
	}

	const own = db
		.select({ picnicId: articles.picnicId })
		.from(articles)
		.where(isNotNull(articles.picnicId))
		.all();
	const offers = new Map<string, CatalogPrice>();
	for (const { picnicId } of own) {
		const price = picnicId ? promoted.get(picnicId) : undefined;
		if (picnicId && price) offers.set(picnicId, price);
	}
	storePrices(offers);
	return offers;
}
