/**
 * Lagerorte als Stammsatz: Anlegen, Umbenennen, Reihenfolge und Inaktivsetzen.
 *
 * Gelöscht wird nie — `stock_entries` und `stock_movements` verweisen auf
 * Lagerorte, die Historie muss lesbar bleiben. Stattdessen `active = false`:
 * ein inaktiver Lagerort verhält sich für den Anwender wie gelöscht und
 * erscheint nirgends mehr zur Auswahl. Damit das lückenlos gilt, holt sich
 * **jede** Auswahlliste ihre Lagerorte über `activeLocations()` und jede
 * Buchung ihr Ziel über `activeLocation()` bzw. `bookingLocationId()`.
 */
import { db } from '$lib/server/db';
import { articles, stockEntries, storageLocations } from '$lib/server/db/schema';
import { auditEdit, auditNew } from '$lib/server/audit';
import { and, eq, ne, sql } from 'drizzle-orm';
import type { Translate } from '$lib/i18n';

export type StorageLocation = typeof storageLocations.$inferSelect;

/** Alle auswählbaren Lagerorte in Anzeigereihenfolge. */
export function activeLocations(): StorageLocation[] {
	return db
		.select()
		.from(storageLocations)
		.where(eq(storageLocations.active, true))
		.orderBy(storageLocations.sortOrder)
		.all();
}

/** Wie `activeLocations()`, aber ohne einen bestimmten Ort (Umlagern-Ziele). */
export function activeLocationsExcept(excludeId: number): StorageLocation[] {
	return db
		.select()
		.from(storageLocations)
		.where(and(eq(storageLocations.active, true), ne(storageLocations.id, excludeId)))
		.orderBy(storageLocations.sortOrder)
		.all();
}

/** Lagerort, sofern er existiert **und** aktiv ist — sonst undefined. */
export function activeLocation(id: number): StorageLocation | undefined {
	return db
		.select()
		.from(storageLocations)
		.where(and(eq(storageLocations.id, id), eq(storageLocations.active, true)))
		.get();
}

/**
 * Ziel für eine Buchung ohne explizite Lagerortwahl (Schnellkorrektur,
 * Inventur-Zugang, Lieferungs-Check): der Standard-Lagerort des Artikels,
 * falls er noch aktiv ist, sonst der erste aktive Lagerort.
 */
export function bookingLocationId(defaultLocationId: number | null): number | undefined {
	if (defaultLocationId != null && activeLocation(defaultLocationId)) return defaultLocationId;
	return db
		.select({ id: storageLocations.id })
		.from(storageLocations)
		.where(eq(storageLocations.active, true))
		.orderBy(storageLocations.sortOrder)
		.get()?.id;
}

/** Alle Lagerorte inkl. inaktiver, mit eingelagerter Menge — für die Verwaltung. */
export function allLocationsWithStock(): (StorageLocation & { quantity: number })[] {
	return db
		.select({
			id: storageLocations.id,
			name: storageLocations.name,
			sortOrder: storageLocations.sortOrder,
			active: storageLocations.active,
			createdAt: storageLocations.createdAt,
			createdBy: storageLocations.createdBy,
			updatedAt: storageLocations.updatedAt,
			updatedBy: storageLocations.updatedBy,
			quantity: sql<number>`coalesce(sum(${stockEntries.quantity}), 0)`
		})
		.from(storageLocations)
		.leftJoin(stockEntries, eq(stockEntries.locationId, storageLocations.id))
		.groupBy(storageLocations.id)
		.orderBy(storageLocations.sortOrder)
		.all();
}

export type LocationResult = { ok: true; message: string } | { ok: false; status: number; message: string };

const NAME_MAX = 40;

/** Name prüfen und Dubletten abfangen (der Unique-Index würde sonst 500en). */
function checkName(name: string, t: Translate, exceptId?: number): string | null {
	if (name.length < 2) return t('msg.locationNameShort');
	if (name.length > NAME_MAX) return t('msg.locationNameLong', { n: NAME_MAX });
	const existing = db
		.select({ id: storageLocations.id })
		.from(storageLocations)
		.where(sql`${storageLocations.name} = ${name} collate nocase`)
		.get();
	if (existing && existing.id !== exceptId) return t('msg.locationExists', { name });
	return null;
}

export function createLocation(name: string, user: string | null, t: Translate): LocationResult {
	const problem = checkName(name, t);
	if (problem) return { ok: false, status: 400, message: problem };

	// Ans Ende der Liste; max + 1 statt count, damit Lücken nicht kollidieren
	const [last] = db
		.select({ max: sql<number>`coalesce(max(${storageLocations.sortOrder}), -1)` })
		.from(storageLocations)
		.all();
	db.insert(storageLocations)
		.values({ name, sortOrder: last.max + 1, ...auditNew(user) })
		.run();
	return { ok: true, message: t('msg.locationCreated', { name }) };
}

export function renameLocation(
	id: number,
	name: string,
	user: string | null,
	t: Translate
): LocationResult {
	const location = db.select().from(storageLocations).where(eq(storageLocations.id, id)).get();
	if (!location) return { ok: false, status: 404, message: t('msg.locationNotFound') };
	const problem = checkName(name, t, id);
	if (problem) return { ok: false, status: 400, message: problem };
	if (name === location.name) return { ok: true, message: t('msg.unchanged') };

	db.update(storageLocations)
		.set({ name, ...auditEdit(user) })
		.where(eq(storageLocations.id, id))
		.run();
	return { ok: true, message: t('msg.locationRenamed', { old: location.name, name }) };
}

/**
 * Inaktiv setzen ist nur bei leerem Lagerort erlaubt — sonst verschwände der
 * Bestand aus allen Auswahllisten, während er in den Summen weiterzählt.
 * Der letzte aktive Lagerort bleibt aktiv, sonst ließe sich nichts mehr buchen.
 */
export function setLocationActive(
	id: number,
	active: boolean,
	user: string | null,
	t: Translate
): LocationResult {
	const location = db.select().from(storageLocations).where(eq(storageLocations.id, id)).get();
	if (!location) return { ok: false, status: 404, message: t('msg.locationNotFound') };
	if (location.active === active) return { ok: true, message: t('msg.unchanged') };

	let betroffeneArtikel = 0;
	if (!active) {
		const [stock] = db
			.select({ total: sql<number>`coalesce(sum(${stockEntries.quantity}), 0)` })
			.from(stockEntries)
			.where(eq(stockEntries.locationId, id))
			.all();
		if (stock.total > 0) {
			return {
				ok: false,
				status: 400,
				message: t('msg.locationHasStock', {
					packs: t('common.packs', { n: stock.total }),
					name: location.name
				})
			};
		}
		const [remaining] = db
			.select({ n: sql<number>`count(*)` })
			.from(storageLocations)
			.where(and(eq(storageLocations.active, true), ne(storageLocations.id, id)))
			.all();
		if (remaining.n === 0) {
			return { ok: false, status: 400, message: t('msg.lastActiveLocation') };
		}

		// Artikel, die auf diesen Ort zeigen, würden sonst auf etwas verweisen,
		// das niemand mehr sehen oder auswählen kann.
		const affected = db
			.update(articles)
			.set({ defaultLocationId: null, ...auditEdit(user) })
			.where(eq(articles.defaultLocationId, id))
			.run().changes;
		betroffeneArtikel = affected;
	}

	db.update(storageLocations)
		.set({ active, ...auditEdit(user) })
		.where(eq(storageLocations.id, id))
		.run();
	return {
		ok: true,
		message: active
			? t('msg.locationActivated', { name: location.name })
			: betroffeneArtikel > 0
				? t('msg.locationRetiredWithArticles', { name: location.name, n: betroffeneArtikel })
				: t('msg.locationRetired', { name: location.name })
	};
}

/**
 * Lagerort in der Anzeigereihenfolge verschieben. Getauscht wird mit dem
 * direkten Nachbarn — auch inaktive zählen als Nachbar, damit ein
 * Reaktivierter dort wieder auftaucht, wo er einsortiert war.
 */
export function moveLocation(
	id: number,
	direction: 'up' | 'down',
	user: string | null,
	t: Translate
): LocationResult {
	const ordered = db.select().from(storageLocations).orderBy(storageLocations.sortOrder, storageLocations.id).all();
	const index = ordered.findIndex((l) => l.id === id);
	if (index === -1) return { ok: false, status: 404, message: t('msg.locationNotFound') };

	const targetIndex = direction === 'up' ? index - 1 : index + 1;
	if (targetIndex < 0 || targetIndex >= ordered.length) return { ok: true, message: t('msg.unchanged') };

	// Positionen neu durchnummerieren: die gespeicherten sort_order-Werte
	// dürfen doppelt vorkommen (Default 0), ein reiner Tausch wäre dann wirkungslos.
	const reordered = [...ordered];
	[reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
	const audit = auditEdit(user);
	for (const [position, location] of reordered.entries()) {
		if (location.sortOrder === position) continue;
		db.update(storageLocations)
			.set({ sortOrder: position, ...audit })
			.where(eq(storageLocations.id, location.id))
			.run();
	}
	return { ok: true, message: t('msg.locationMoved', { name: ordered[index].name }) };
}
