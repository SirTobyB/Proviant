/**
 * Produktdaten für den Artikel: Marke, Herkunft, Bio-Siegel, Nährwerte.
 * Rein und ohne SvelteKit-Import, damit eigenständig testbar.
 *
 * Quelle ist `catalog.getProduct()`. Live geprüft (Picnic DE, November 2026):
 * - Marke steht in `brand`, bei Obst, Gemüse und Eigenmarken oft `null`.
 * - Bio steht als Siegel in `labels` („Bio“); im Namen („Bio Salatgurke“) oder
 *   in der Zutatenliste („Biologischen Ursprungs“) zählt es bewusst nicht.
 * - Die Herkunft hat kein eigenes Feld, sondern steht in den
 *   Zusatzinformationen als Abschnitt „**Ursprungsland**\nFrankreich“ — bei
 *   frischer Ware zuverlässig, bei verarbeiteten Produkten meist gar nicht.
 *
 * Im Zweifel nichts: ein falsches Bio-Häkchen oder ein erfundenes Herkunftsland
 * wäre schlimmer als ein leeres Feld.
 */

export type NutritionRow = { label: string; value: string | null; isCategory: boolean };

export type ProductFacts = {
	brand: string | null;
	origin: string | null;
	organic: boolean;
	nutrition: NutritionRow[] | null;
};

const ORGANIC_WORDS = ['bio', 'biologisch', 'biologique', 'organic', 'öko', 'demeter', 'bioland', 'naturland'];

/** Ganzes Wort (Bindestriche trennen: „EU-Bio“), Groß-/Kleinschreibung egal. */
export function isOrganicLabel(text: string): boolean {
	return text
		.toLowerCase()
		.split(/[^\p{L}]+/u)
		.some((word) => ORGANIC_WORDS.includes(word));
}

const ORIGIN_HEADINGS = /^(ursprungsland|herkunftsland|herkunft|ursprung|land van herkomst|herkomst|country of origin|origin)$/i;

function record(value: unknown): Record<string, unknown> {
	return value != null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * Das Land unter einer Überschrift wie „**Ursprungsland**“. Nur eine kurze
 * Angabe ohne Satzzeichen gilt als Land — ein ganzer Satz („Siehe Etikett …“)
 * ist kein Herkunftsland.
 */
export function findOrigin(product: unknown): string | null {
	const sections = record(product).infoSections;
	if (!Array.isArray(sections)) return null;
	for (const section of sections) {
		const content = record(section).content;
		if (typeof content !== 'string') continue;
		const lines = content.split(/\r?\n/).map((line) => line.trim());
		for (let i = 0; i < lines.length; i++) {
			const heading = lines[i].match(/^\*\*(.+?)\.?\*\*$/);
			if (!heading || !ORIGIN_HEADINGS.test(heading[1].trim())) continue;
			const value = lines.slice(i + 1).find((line) => line !== '');
			if (value && !value.startsWith('**') && value.length <= 40 && !/[.:;!?]/.test(value)) return value;
			return null;
		}
	}
	return null;
}

function nutritionRows(raw: unknown): NutritionRow[] | null {
	if (!Array.isArray(raw)) return null;
	const rows = raw
		.map(record)
		.filter((row) => typeof row.label === 'string' && row.label.trim() !== '')
		.map((row) => ({
			label: String(row.label).trim(),
			value: typeof row.value === 'string' && row.value.trim() !== '' ? row.value.trim() : null,
			isCategory: row.isCategory === true
		}));
	// Nur Überschriften ohne einen einzigen Wert sind keine Nährwerttabelle
	return rows.some((row) => row.value !== null) ? rows : null;
}

export function extractProductFacts(product: unknown): ProductFacts {
	const p = record(product);
	const labels = Array.isArray(p.labels)
		? p.labels.map((label) => record(label).text).filter((text): text is string => typeof text === 'string')
		: [];
	return {
		brand: typeof p.brand === 'string' && p.brand.trim() !== '' ? p.brand.trim() : null,
		origin: findOrigin(product),
		organic: labels.some(isOrganicLabel),
		nutrition: nutritionRows(p.nutritionRows)
	};
}
