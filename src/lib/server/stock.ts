/**
 * Lagerbuchungen auf Chargen-Basis.
 *
 * Hier laufen **alle** Schreibzugriffe auf `stock_entries` zusammen — deshalb
 * schreibt auch das Buchungsjournal (`stock_movements`) ausschließlich von
 * hier aus. Wer eine neue Buchungsart ergänzt, muss `recordMovement` mitrufen,
 * sonst hat das Journal eine Lücke.
 */
import { db } from '$lib/server/db';
import { articles, stockEntries, stockMovements, storageLocations } from '$lib/server/db/schema';
import { auditEdit, auditNew } from '$lib/server/audit';
import { and, eq, sql } from 'drizzle-orm';

/** Woher eine Buchung ausgelöst wurde — im Journal sichtbar. */
export type MovementSource = 'scan' | 'inventur' | 'lieferung' | 'artikelliste' | 'charge';

/**
 * Schreibt eine Journalzeile. Der Artikelname wird als Schnappschuss abgelegt,
 * damit die Zeile lesbar bleibt, wenn der Artikel später gelöscht wird.
 */
function recordMovement(movement: {
	type: 'in' | 'out' | 'move' | 'correction';
	source: MovementSource;
	articleId: number;
	/** Wirkung auf den Gesamtbestand (+/−); bei Umlagerung die umgelagerte Menge */
	quantity: number;
	locationId: number | null;
	fromLocationId?: number | null;
	bestBefore: string | null;
	user: string | null;
}): void {
	const article = db
		.select({ name: articles.name })
		.from(articles)
		.where(eq(articles.id, movement.articleId))
		.get();

	db.insert(stockMovements)
		.values({
			bookedBy: movement.user,
			type: movement.type,
			source: movement.source,
			articleId: movement.articleId,
			articleName: article?.name ?? `Artikel ${movement.articleId}`,
			quantity: movement.quantity,
			locationId: movement.locationId,
			fromLocationId: movement.fromLocationId ?? null,
			bestBefore: movement.bestBefore
		})
		.run();
}

/** Bucht Gebinde ein; gleiche Kombination aus Lagerort und MHD wird zusammengefasst. */
export function bookIn(
	articleId: number,
	locationId: number,
	quantity: number,
	bestBefore: string | null,
	user: string | null,
	source: MovementSource
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

	recordMovement({ type: 'in', source, articleId, quantity, locationId, bestBefore, user });
}

/**
 * Bucht Gebinde aus: Chargen mit dem nächsten MHD zuerst (FEFO),
 * Chargen ohne MHD zuletzt. Liefert die tatsächlich ausgebuchte Anzahl.
 */
export function bookOut(
	articleId: number,
	quantity: number,
	user: string | null,
	source: MovementSource
): number {
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
		// Je betroffener Charge eine Zeile: FEFO kann über mehrere Lagerorte
		// laufen, nur so bleibt „welcher Lagerplatz?" beantwortbar
		recordMovement({
			type: 'out',
			source,
			articleId,
			quantity: -take,
			locationId: entry.locationId,
			bestBefore: entry.bestBefore,
			user
		});
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
export function moveStockEntry(
	entryId: number,
	targetLocationId: number,
	user: string | null,
	source: MovementSource
): boolean {
	const entry = db.select().from(stockEntries).where(eq(stockEntries.id, entryId)).get();
	if (!entry) return false;
	// Kein Ortswechsel = keine Buchung, also auch keine Journalzeile
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

	recordMovement({
		type: 'move',
		source,
		articleId: entry.articleId,
		quantity: entry.quantity,
		locationId: targetLocationId,
		fromLocationId: entry.locationId,
		bestBefore: entry.bestBefore,
		user
	});
	return true;
}

/**
 * Chargen bearbeiten die Lagerort- und die Artikelseite gleichermaßen — nur der
 * Rahmen unterscheidet sich. Die folgenden Helfer kapseln die gemeinsame Logik;
 * die Routen mappen das Ergebnis auf ihr jeweiliges `fail()`-Feld.
 */
export type StockEntryScope = { articleId: number } | { locationId: number };
type EntryResult<T> = ({ ok: true } & T) | { ok: false; status: number; message: string };

/** Lädt eine Charge und stellt sicher, dass sie zum erwarteten Rahmen gehört. */
function findScopedEntry(entryId: unknown, scope: StockEntryScope) {
	const id = Number(entryId);
	if (!Number.isInteger(id)) return undefined;
	const belongsTo =
		'articleId' in scope
			? eq(stockEntries.articleId, scope.articleId)
			: eq(stockEntries.locationId, scope.locationId);
	return db
		.select()
		.from(stockEntries)
		.where(and(eq(stockEntries.id, id), belongsTo))
		.get();
}

/** Anzahl und MHD einer Charge übernehmen; Anzahl 0 löscht die Charge. */
export function updateStockEntryFromForm(
	formData: FormData,
	scope: StockEntryScope,
	user: string | null
): EntryResult<object> {
	const entry = findScopedEntry(formData.get('entryId'), scope);
	if (!entry) return { ok: false, status: 404, message: 'Charge nicht gefunden' };

	const quantity = Number(formData.get('quantity'));
	if (!Number.isInteger(quantity) || quantity < 0) {
		return { ok: false, status: 400, message: 'Anzahl ist ungültig' };
	}
	const bestBeforeRaw = formData.get('bestBefore');
	const bestBefore =
		typeof bestBeforeRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bestBeforeRaw)
			? bestBeforeRaw
			: null;

	if (quantity === 0) {
		db.delete(stockEntries).where(eq(stockEntries.id, entry.id)).run();
	} else {
		db.update(stockEntries)
			.set({ quantity, bestBefore, ...auditEdit(user) })
			.where(eq(stockEntries.id, entry.id))
			.run();
	}

	// Reine Bestätigung ohne Änderung erzeugt keine Journalzeile
	const delta = quantity - entry.quantity;
	if (delta !== 0 || bestBefore !== entry.bestBefore) {
		recordMovement({
			type: 'correction',
			source: 'charge',
			articleId: entry.articleId,
			quantity: delta,
			locationId: entry.locationId,
			bestBefore,
			user
		});
	}
	return { ok: true };
}

/** Charge in einen anderen Lagerort umlagern. */
export function moveStockEntryFromForm(
	formData: FormData,
	scope: StockEntryScope,
	user: string | null
): EntryResult<{ targetName: string }> {
	const entry = findScopedEntry(formData.get('entryId'), scope);
	if (!entry) return { ok: false, status: 404, message: 'Charge nicht gefunden' };

	const targetLocationId = Number(formData.get('targetLocationId'));
	if (!Number.isInteger(targetLocationId) || targetLocationId === entry.locationId) {
		return { ok: false, status: 400, message: 'Bitte einen anderen Ziel-Lagerort wählen' };
	}
	const target = db
		.select()
		.from(storageLocations)
		.where(eq(storageLocations.id, targetLocationId))
		.get();
	if (!target) return { ok: false, status: 400, message: 'Ziel-Lagerort nicht gefunden' };

	moveStockEntry(entry.id, targetLocationId, user, 'charge');
	return { ok: true, targetName: target.name };
}
