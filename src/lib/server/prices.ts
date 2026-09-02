/**
 * Preis-Cache: lesen und bedarfsgesteuert auffrischen.
 *
 * Picnic kennt keinen Bulk-Lookup (ein Call pro Produkt), ein Live-Abruf beim
 * Rendern scheidet damit aus. Der Cache ist deshalb keine Optimierung,
 * sondern Voraussetzung.
 */
import { db } from '$lib/server/db';
import { picnicPrices } from '$lib/server/db/schema';
import { getConnectionState, getProductPrices } from '$lib/server/picnic';
import { logWarn } from '$lib/server/log';
import { inArray } from 'drizzle-orm';

export type CachedPrice = {
	regularPrice: number;
	promoPrice: number | null;
	promoLabel: string | null;
	fetchedAt: Date;
};

/** Preise gelten einen Tag als frisch — Picnic-Aktionen laufen tageweise. */
export const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/**
 * Obergrenze je Auffrischung. Ohne Deckel zöge eine Rezeptseite mit vielen
 * Alternativartikeln dutzende Calls und die Seite stünde spürbar.
 */
export const DEFAULT_REFRESH_LIMIT = 20;

// Die reine Rechnung liegt in `$lib/prices` — auch Komponenten brauchen sie,
// und `$lib/server/*` ist für die nicht importierbar. Hier nur durchgereicht,
// damit die Server-Seiten ihre gewohnte Bezugsquelle behalten.
export { effectivePrice, savingsOf } from '$lib/prices';

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

	let fetched: Map<string, { regularPrice: number; promoPrice: number | null; promoLabel: string | null }>;
	try {
		fetched = await getProductPrices(stale);
	} catch {
		// Verbindung weggebrochen o.ä. — Cache bleibt, wie er ist
		return { updated: 0, failed: stale.length };
	}

	const now = new Date();
	let updated = 0;
	for (const [picnicId, price] of fetched) {
		// Schreibfehler (SQLITE_BUSY bei Backup, Volume-Snapshot, zweitem
		// Container auf derselben Datei) dürfen nicht als Ausnahme nach oben
		// durchschlagen: `refreshPrices` wird im `load` abgewartet, die Seite
		// wäre sonst ein 500er. Genau davor soll dieses Modul schützen — ein
		// veralteter Preis schlägt eine Fehlerseite. Stumm bleibt es trotzdem
		// nicht, sonst bliebe ein echtes Datenbankproblem unbemerkt.
		try {
			db.insert(picnicPrices)
				.values({ picnicId, ...price, fetchedAt: now })
				.onConflictDoUpdate({
					target: picnicPrices.picnicId,
					set: { ...price, fetchedAt: now }
				})
				.run();
			updated += 1;
		} catch (err) {
			logWarn('Preis konnte nicht zwischengespeichert werden', {
				picnicId,
				fehler: err instanceof Error ? err.message : String(err)
			});
		}
	}

	return { updated, failed: stale.length - updated };
}
