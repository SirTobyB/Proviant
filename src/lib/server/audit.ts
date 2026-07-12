/**
 * Audit-Felder für Inserts/Updates. Der aktuelle Benutzername wird aus
 * `locals.user` in die jeweilige Aktion gereicht und hier eingesetzt.
 */

/** Felder für einen neuen Datensatz (Anlage + erste Änderung durch denselben User). */
export function auditNew(user: string | null | undefined) {
	const now = new Date();
	return { createdAt: now, createdBy: user ?? null, updatedAt: now, updatedBy: user ?? null };
}

/** Felder für die Aktualisierung eines bestehenden Datensatzes. */
export function auditEdit(user: string | null | undefined) {
	return { updatedAt: new Date(), updatedBy: user ?? null };
}

/** Felder für einen Link-Tabellen-Eintrag (nur Anlage, kein Update). */
export function auditLink(user: string | null | undefined) {
	return { createdBy: user ?? null };
}
