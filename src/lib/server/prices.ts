/**
 * Preis-Cache: lesen und bedarfsgesteuert auffrischen.
 *
 * Picnic kennt keinen Bulk-Lookup (ein Call pro Produkt), ein Live-Abruf beim
 * Rendern scheidet damit aus. Der Cache ist deshalb keine Optimierung,
 * sondern Voraussetzung.
 */
import { db } from '#lib/server/db/index.js';
import { picnicPrices } from '#lib/server/db/schema.js';
import { getConnectionState, getProductPrices, type CatalogPrice } from '#lib/server/picnic/index.js';
import type { PriceTier } from '#lib/offers.js';
import { logWarn } from '#lib/server/log.js';
import { inArray } from 'drizzle-orm';

export type CachedPrice = CatalogPrice & { fetchedAt: Date };

/** Staffeln aus der JSON-Spalte; Unlesbares zählt als „keine Staffel“. */
function parseTiers(raw: string | null): PriceTier[] | null {
	if (!raw) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return null;
		const result = parsed.filter(
			(t): t is PriceTier =>
				typeof t?.fromQuantity === 'number' && typeof t?.unitPrice === 'number' && t.unitPrice > 0
		);
		return result.length > 0 ? result : null;
	} catch {
		return null;
	}
}

/** Preise gelten einen Tag als frisch — Picnic-Aktionen laufen tageweise. */
export const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/**
 * Obergrenze je Auffrischung. Ohne Deckel zöge eine Rezeptseite mit vielen
 * Alternativartikeln dutzende Calls und die Seite stünde spürbar.
 */
export const DEFAULT_REFRESH_LIMIT = 20;

// Die reine Rechnung liegt in `#lib/prices` — auch Komponenten brauchen sie,
// und `#lib/server/*` ist für die nicht importierbar. Hier nur durchgereicht,
// damit die Server-Seiten ihre gewohnte Bezugsquelle behalten.
export { effectivePrice, savingsFor, savingsOf, totalFor } from '#lib/prices.js';

/** Gecachte Preise zu den gefragten IDs. Fehlende fehlen einfach in der Map. */
export function pricesFor(picnicIds: string[]): Map<string, CachedPrice> {
	const ids = [...new Set(picnicIds.filter(Boolean))];
	if (ids.length === 0) return new Map();

	const rows = db.select().from(picnicPrices).where(inArray(picnicPrices.picnicId, ids)).all();
	return new Map(
		rows.map((row) => [
			row.picnicId,
			{
				regularPrice: row.regularPrice,
				promoPrice: row.promoPrice,
				promoLabel: row.promoLabel,
				promoMinQuantity: row.promoMinQuantity,
				priceRanges: parseTiers(row.priceRanges),
				fetchedAt: row.fetchedAt
			}
		])
	);
}

/**
 * Ältester Abrufzeitpunkt der übergebenen Preise als ISO-Zeichenkette; `null`,
 * wenn keiner dabei ist.
 *
 * Gedacht für die beiden Flächen, die **nur** aus dem Cache lesen (Rezeptliste
 * und Wochenplan): Dort frischt nichts nach, und die Auffrischung anderswo ist
 * auf 20 IDs je Aufruf gedeckelt — der Preis eines selten geöffneten Rezepts
 * kann also wochenalt sein. Ohne diesen Hinweis sähe er aus wie der von heute.
 *
 * Bewusst der **älteste**: Ein Hinweis darf die Frische nie überschätzen.
 */
export function oldestFetchedAt(prices: Map<string, CachedPrice>): string | null {
	let oldest: Date | null = null;
	for (const price of prices.values()) {
		if (oldest == null || price.fetchedAt < oldest) oldest = price.fetchedAt;
	}
	return oldest ? oldest.toISOString() : null;
}

/**
 * Frischt veraltete und fehlende Preise auf. Älteste zuerst, gedeckelt — über
 * mehrere Seitenaufrufe wird so alles nachgezogen, ohne dass ein einzelner
 * spürbar hängt.
 *
 * Ohne Picnic-Verbindung passiert stillschweigend nichts: Die Seite zeigt dann
 * die vorhandenen Cache-Werte, was allemal besser ist als ein Fehler.
 */
export async function refreshPrices(
	picnicIds: string[],
	options: { maxAgeMs?: number; limit?: number } = {}
): Promise<{ updated: number; failed: number }> {
	if (getConnectionState() !== 'connected') return { updated: 0, failed: 0 };

	const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
	const limit = options.limit ?? DEFAULT_REFRESH_LIMIT;
	const ids = [...new Set(picnicIds.filter(Boolean))];
	if (ids.length === 0) return { updated: 0, failed: 0 };

	const cached = pricesFor(ids);
	const threshold = Date.now() - maxAgeMs;
	const stale = ids
		.map((id) => ({ id, fetchedAt: cached.get(id)?.fetchedAt?.getTime() ?? 0 }))
		.filter((entry) => entry.fetchedAt < threshold)
		.sort((a, b) => a.fetchedAt - b.fetchedAt) // nie abgerufene (0) zuerst
		.slice(0, limit)
		.map((entry) => entry.id);

	if (stale.length === 0) return { updated: 0, failed: 0 };

	let fetched: Map<string, CatalogPrice>;
	try {
		fetched = await getProductPrices(stale);
	} catch {
		// Verbindung weggebrochen o.ä. — Cache bleibt, wie er ist
		return { updated: 0, failed: stale.length };
	}

	const updated = storePrices(fetched);
	return { updated, failed: stale.length - updated };
}

/**
 * Legt Preise im Cache ab (Upsert, Zeitstempel jetzt) und gibt zurück, wie
 * viele es geschafft haben. Genutzt von der Auffrischung, dem Angebotsabgleich
 * und dem Live-Abruf der Artikelseite — so zeigen alle Seiten denselben Stand.
 *
 * Schreibfehler (SQLITE_BUSY bei Backup, Volume-Snapshot, zweitem Container
 * auf derselben Datei) dürfen nicht als Ausnahme nach oben durchschlagen: Die
 * Aufrufer laufen im `load`, die Seite wäre sonst ein 500er — ein veralteter
 * Preis schlägt eine Fehlerseite. Stumm bleibt es trotzdem nicht, sonst bliebe
 * ein echtes Datenbankproblem unbemerkt.
 */
export function storePrices(prices: Map<string, CatalogPrice>): number {
	const now = new Date();
	let stored = 0;
	for (const [picnicId, price] of prices) {
		const values = {
			regularPrice: price.regularPrice,
			promoPrice: price.promoPrice,
			promoLabel: price.promoLabel,
			promoMinQuantity: price.promoMinQuantity,
			priceRanges: price.priceRanges ? JSON.stringify(price.priceRanges) : null,
			fetchedAt: now
		};
		try {
			db.insert(picnicPrices)
				.values({ picnicId, ...values })
				.onConflictDoUpdate({ target: picnicPrices.picnicId, set: values })
				.run();
			stored += 1;
		} catch (err) {
			logWarn('Preis konnte nicht zwischengespeichert werden', {
				picnicId,
				fehler: err instanceof Error ? err.message : String(err)
			});
		}
	}
	return stored;
}
