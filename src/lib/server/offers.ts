/**
 * Aktuelle Picnic-Angebote für die **eigenen** Artikel.
 *
 * Die Angebotsseite samt Aktionsgruppen kostet gut drei Dutzend Anfragen; sie
 * wird deshalb höchstens einmal je Stunde geholt, danach im Hintergrund
 * aufgefrischt, während noch der alte Stand gilt — längstens einen Tag
 * (Regel in `offerCache.ts`). Der Zwischenspeicher liegt bewusst
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
import { pricesFor, storePrices } from '#lib/server/prices.js';
import { logWarn } from '#lib/server/log.js';
import { mergeOffers, offerCacheState } from '#lib/server/offerCache.js';
import { isNotNull } from 'drizzle-orm';

let cache: { at: number; data: Map<string, CatalogPrice> } | null = null;
let inflight: Promise<Map<string, CatalogPrice>> | null = null;

/** Picnic-IDs, die als Artikel geführt werden. */
function ownPicnicIds(): string[] {
	return db
		.select({ picnicId: articles.picnicId })
		.from(articles)
		.where(isNotNull(articles.picnicId))
		.all()
		.map((row) => row.picnicId)
		.filter((id): id is string => Boolean(id));
}

function ownOffers(promoted: Map<string, CatalogPrice>): Map<string, CatalogPrice> {
	const offers = new Map<string, CatalogPrice>();
	for (const picnicId of ownPicnicIds()) {
		const price = promoted.get(picnicId);
		if (price) offers.set(picnicId, price);
	}
	return offers;
}

/**
 * Holt die Angebote neu. Nur hier landen sie im Preis-Cache — mit dem
 * Zeitpunkt des Abrufs, damit ein alter Stand nie als frisch gilt.
 * Gleichzeitige Aufrufe teilen sich einen Abruf.
 */
function refresh(): Promise<Map<string, CatalogPrice>> {
	return (inflight ??= getPromotedProducts()
		.then((data) => {
			cache = { at: Date.now(), data };
			storePrices(ownOffers(data), new Date(cache.at));
			return data;
		})
		.finally(() => {
			inflight = null;
		}));
}

async function promotedProducts(): Promise<Map<string, CatalogPrice>> {
	const state = offerCacheState(cache?.at ?? null, Date.now());
	// Ohne oder mit abgelaufenem Stand muss gewartet werden; scheitert das,
	// gibt es eben keine Angebote statt veralteter
	if (state === 'missing' || state === 'expired' || !cache) return refresh();
	// Veraltet: sofort den alten Stand zeigen und im Hintergrund auffrischen.
	// Ein Abruf dauert live über zehn Sekunden (jede Aktionsgruppe einzeln) —
	// darauf soll höchstens der erste Seitenaufruf warten.
	if (state === 'stale') {
		refresh().catch((err) =>
			logWarn('Picnic-Angebote nicht auffrischbar', { fehler: err instanceof Error ? err.message : String(err) })
		);
	}
	return cache.data;
}

/**
 * Angebote je Picnic-ID, beschränkt auf eigene Artikel. `unavailable`, wenn
 * Picnic verbunden ist, die Angebote aber nicht abrufbar waren — die Seiten
 * sagen das dann, statt „nichts im Angebot“ zu behaupten.
 */
export async function currentOffers(): Promise<{ offers: Map<string, CatalogPrice>; unavailable: boolean }> {
	if (getConnectionState() !== 'connected') return { offers: new Map(), unavailable: false };
	try {
		const promoted = ownOffers(await promotedProducts());
		return { offers: mergeOffers(promoted, pricesFor(ownPicnicIds()), Date.now()), unavailable: false };
	} catch (err) {
		logWarn('Picnic-Angebote nicht abrufbar', { fehler: err instanceof Error ? err.message : String(err) });
		return { offers: new Map(), unavailable: true };
	}
}
