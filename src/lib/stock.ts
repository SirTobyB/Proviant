/** Bestandshelfer, die auch im Browser gebraucht werden. */

/** Gesamtmenge einer Chargenliste (Lagerort- und Artikelansicht). */
export function sumQuantity(entries: { quantity: number }[]): number {
	return entries.reduce((sum, entry) => sum + entry.quantity, 0);
}
