/**
 * App-weite Vorgaben.
 *
 * Bewusst als Funktion und nicht als Konstante: Die Portionsvorgabe soll
 * später von Admins in der App einstellbar sein (eigener Schritt, braucht
 * Tabelle und Oberfläche). Dann ändert sich ausschließlich der Rumpf hier —
 * alle Aufrufer bleiben, wie sie sind.
 */

/** Vorbelegte Portionszahl auf der Rezeptseite. */
export function defaultPortions(): number {
	return 3;
}
