/**
 * Anzeigename einer Picnic-Produktkachel (Favoriten, Ersatzvorschläge, Suche).
 * Rein und ohne SvelteKit-Import, damit eigenständig testbar.
 *
 * Seit picnic-api 5.3.1 steht ein farbig hervorgehobener Namensanfang
 * („Bio") getrennt in `namePrefix`, `name` ist nur noch der Rest — live
 * geprüft (Picnic DE, November 2026): „Bio" + „Zitronen". Vorher las die
 * Bibliothek nur das erste Stück, und der Artikel hieß schlicht „Bio".
 * Picnic trennt dabei auch mitten im Wort („Bio" + „land Frische Milch"):
 * beginnt der Rest klein, gehört er ohne Leerzeichen an das Präfix.
 */
export function tileName(tile: { name: string; namePrefix?: string | null }): string {
	const prefix = tile.namePrefix?.trim();
	const name = tile.name.trim();
	if (!prefix) return name;
	if (!name) return prefix;
	const glued = /^\p{Ll}/u.test(name);
	return glued ? `${prefix}${name}` : `${prefix} ${name}`;
}
