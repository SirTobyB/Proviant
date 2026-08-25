/**
 * Regeln rund um die Artikel-Neuanlage beim Lieferungs-Check.
 *
 * Bewusst ein reines Modul: Oberfläche (Knopf freischalten) und Server
 * (Ablehnung) müssen nach derselben Regel entscheiden, welche Position beim
 * Buchen neu entsteht und deshalb vorher einen Standard-Lagerort braucht.
 * Zweimal formuliert würde die Bedingung früher oder später auseinanderlaufen.
 */

/** Das Wenige, was für die Entscheidung nötig ist — Lieferzeile oder Bulk-Position. */
export type DeliveryLine = {
	productId: string;
	name: string;
	quantity: number;
	/** Artikel im Stamm; null = die Position würde beim Buchen neu angelegt */
	articleId: number | null;
};

/** Lagerortwahl je Produkt, wie sie aus einem `<select>` kommt (String) oder vom Server (Zahl). */
export type LocationAssignments = Record<string, string | number | null | undefined>;

/**
 * Noch nicht abgearbeitete Menge einer Position. Kaputte Mengen (kein Zahlwert,
 * negativ) gelten als nichts Offenes — sie werden auch beim Buchen übersprungen.
 */
export function openQuantity(line: DeliveryLine, checked: Record<string, number> = {}): number {
	if (!Number.isInteger(line.quantity)) return 0;
	const done = checked[line.productId] ?? 0;
	return Math.max(0, line.quantity - (Number.isFinite(done) ? done : 0));
}

/**
 * Offene Positionen ohne Artikel im Stamm — genau diese entstehen beim Buchen
 * neu und brauchen vorher einen Standard-Lagerort.
 */
export function newItemsNeedingLocation<T extends DeliveryLine>(
	lines: T[],
	checked: Record<string, number> = {}
): T[] {
	return lines.filter((line) => line.articleId == null && openQuantity(line, checked) > 0);
}

/**
 * Gewählter Lagerort einer Position, sonst null. Leerstring, 0 und Unsinn
 * zählen als „nicht gewählt" — ob der Lagerort auch aktiv ist, kann nur der
 * Server sagen und prüft er dort zusätzlich.
 */
export function assignedLocationId(
	assignments: LocationAssignments,
	productId: string
): number | null {
	const raw = assignments[productId];
	if (raw == null || raw === '') return null;
	const id = Number(raw);
	return Number.isInteger(id) && id > 0 ? id : null;
}

/** Namen der neuen Artikel, die noch keinen Lagerort haben — leer heißt: buchbereit. */
export function missingLocationNames(
	newItems: DeliveryLine[],
	assignments: LocationAssignments
): string[] {
	return newItems
		.filter((item) => assignedLocationId(assignments, item.productId) === null)
		.map((item) => item.name);
}
