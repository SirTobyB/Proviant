/**
 * Produkttreffer aus der **Fusion**-Fassung der Picnic-Suchseite.
 * Rein und ohne SvelteKit-Import, damit eigenständig testbar.
 *
 * Picnic DE liefert die Suche (live geprüft, November 2026) weiterhin als
 * Fusion aus — dort stecken die Produkte als `sellingUnit`-Objekte mit den
 * alten snake_case-Feldern, deren `name` die Marke enthält. picnic-api liest
 * Fusion seit 5.3.1 zwar auch, aber nur den kürzeren Kachelnamen; warum der
 * Parser deshalb bleibt, steht an `searchProducts` in `index.ts`.
 */

export type ProductSearchHit = {
	id: string;
	name: string;
	unitQuantity: string;
	/** Aktueller Preis in Cent. */
	price: number;
	imageId: string | null;
};

function toHit(unit: unknown): ProductSearchHit | null {
	if (unit == null || typeof unit !== 'object') return null;
	const record = unit as Record<string, unknown>;
	const id = typeof record.id === 'string' && record.id ? record.id : null;
	const name = typeof record.name === 'string' && record.name ? record.name : null;
	const price = record.display_price;
	if (!id || !name || typeof price !== 'number' || !Number.isFinite(price)) return null;
	return {
		id,
		name,
		unitQuantity: typeof record.unit_quantity === 'string' ? record.unit_quantity : '',
		price,
		imageId: typeof record.image_id === 'string' && record.image_id ? record.image_id : null
	};
}

/**
 * Sammelt alle `sellingUnit`-Objekte der Seite in Dokumentreihenfolge, ohne
 * Dubletten (dasselbe Produkt steht z.B. unter „Schon mal gekauft" und in
 * seiner Produktgruppe). Tiefenbegrenzt und defensiv: unvollständige Einträge
 * fallen weg, lieber weniger Treffer als Datenmüll.
 */
export function extractSearchHits(page: unknown): ProductSearchHit[] {
	const hits = new Map<string, ProductSearchHit>();

	function walk(node: unknown, depth: number): void {
		if (depth > 60 || node == null || typeof node !== 'object') return;
		if (Array.isArray(node)) {
			for (const value of node) walk(value, depth + 1);
			return;
		}
		for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
			if (key === 'sellingUnit') {
				const hit = toHit(value);
				if (hit && !hits.has(hit.id)) hits.set(hit.id, hit);
			}
			walk(value, depth + 1);
		}
	}

	walk(page, 0);
	return [...hits.values()];
}
