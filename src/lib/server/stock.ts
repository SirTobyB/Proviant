/**
 * Lagerbuchungen auf Chargen-Basis.
 */
import { db } from '$lib/server/db';
import { stockEntries } from '$lib/server/db/schema';
import { auditEdit, auditNew } from '$lib/server/audit';
import { and, eq, sql } from 'drizzle-orm';

/** Bucht Gebinde ein; gleiche Kombination aus Lagerort und MHD wird zusammengefasst. */
export function bookIn(
	articleId: number,
	locationId: number,
	quantity: number,
	bestBefore: string | null,
	user: string | null
): void {
	if (quantity < 1) return;

	const existing = db
		.select()
		.from(stockEntries)
		.where(
			and(
				eq(stockEntries.articleId, articleId),
				eq(stockEntries.locationId, locationId),
				bestBefore === null
					? sql`${stockEntries.bestBefore} is null`
					: eq(stockEntries.bestBefore, bestBefore)
			)
		)
		.get();

	if (existing) {
		db.update(stockEntries)
			.set({ quantity: existing.quantity + quantity, ...auditEdit(user) })
			.where(eq(stockEntries.id, existing.id))
			.run();
	} else {
		db.insert(stockEntries)
			.values({ articleId, locationId, quantity, bestBefore, ...auditNew(user) })
			.run();
	}
}

/**
 * Bucht Gebinde aus: Chargen mit dem nächsten MHD zuerst (FEFO),
 * Chargen ohne MHD zuletzt. Liefert die tatsächlich ausgebuchte Anzahl.
 */
export function bookOut(articleId: number, quantity: number, user: string | null): number {
	if (quantity < 1) return 0;

	const entries = db
		.select()
		.from(stockEntries)
		.where(eq(stockEntries.articleId, articleId))
		.orderBy(
			sql`${stockEntries.bestBefore} is null`,
			stockEntries.bestBefore,
			stockEntries.createdAt
		)
		.all();

	let remaining = quantity;
	for (const entry of entries) {
		if (remaining === 0) break;
		const take = Math.min(entry.quantity, remaining);
		if (take === entry.quantity) {
			db.delete(stockEntries).where(eq(stockEntries.id, entry.id)).run();
		} else {
			db.update(stockEntries)
				.set({ quantity: entry.quantity - take, ...auditEdit(user) })
				.where(eq(stockEntries.id, entry.id))
				.run();
		}
		remaining -= take;
	}
	return quantity - remaining;
}

/**
 * Lagert eine einzelne Charge komplett in einen anderen Lagerort um (z.B.
 * versehentlich falsch gebucht). MHD bleibt erhalten; existiert im Ziel
 * bereits eine Charge mit gleichem Artikel und MHD, werden die Mengen
 * zusammengeführt statt einer zweiten Charge.
 */
export function moveStockEntry(entryId: number, targetLocationId: number, user: string | null): boolean {
	const entry = db.select().from(stockEntries).where(eq(stockEntries.id, entryId)).get();
	if (!entry) return false;
	if (entry.locationId === targetLocationId) return true;

	const existing = db
		.select()
		.from(stockEntries)
		.where(
			and(
				eq(stockEntries.articleId, entry.articleId),
				eq(stockEntries.locationId, targetLocationId),
				entry.bestBefore === null
					? sql`${stockEntries.bestBefore} is null`
					: eq(stockEntries.bestBefore, entry.bestBefore)
			)
		)
		.get();

	if (existing) {
		db.update(stockEntries)
			.set({ quantity: existing.quantity + entry.quantity, ...auditEdit(user) })
			.where(eq(stockEntries.id, existing.id))
			.run();
		db.delete(stockEntries).where(eq(stockEntries.id, entry.id)).run();
	} else {
		db.update(stockEntries)
			.set({ locationId: targetLocationId, ...auditEdit(user) })
			.where(eq(stockEntries.id, entry.id))
			.run();
	}
	return true;
}
