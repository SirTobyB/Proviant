/**
 * Extraktion von Picnic-Rezepten aus den dynamischen PML-/Fusion-Seiten.
 * Rein und ohne SvelteKit-Abhängigkeiten, damit eigenständig testbar.
 *
 * Die Seiten sind nicht offiziell dokumentiert — die Parser arbeiten deshalb
 * heuristisch über die Markdown-Textknoten in Dokumentreihenfolge und sind
 * bewusst defensiv (liefern lieber weniger als falsche Daten).
 */

export type PicnicRecipeTile = { id: string; name: string };

export type ParsedPicnicIngredient = {
	name: string;
	amount: number | null;
	/** Einheit wie geliefert (g, ml, Stk., TL, EL, Bund …) */
	unit: string | null;
};

export type ParsedPicnicRecipe = {
	description: string | null;
	servings: number | null;
	ingredients: ParsedPicnicIngredient[];
	/** Zusatzzeilen wie „Eigene Zutaten: …" und „Du benötigst: …" */
	extraLines: string[];
	steps: string[];
	tip: string | null;
};

/** Entfernt PML-Farbcodes (#(#333333)) und Fett-Marker. */
function cleanText(text: string): string {
	return text
		.replace(/#\(#[0-9a-f]{6}\)/gi, '')
		.replace(/\*\*/g, '')
		.trim();
}

/** Sammelt alle markdown-Texte der Seite in Dokumentreihenfolge. */
export function collectMarkdown(node: unknown, out: string[] = []): string[] {
	if (node == null || typeof node !== 'object') return out;
	const record = node as Record<string, unknown>;
	if (typeof record.markdown === 'string') out.push(record.markdown);
	for (const value of Array.isArray(node) ? node : Object.values(record)) {
		collectMarkdown(value, out);
	}
	return out;
}

/**
 * Findet Rezept-Kacheln (selling_group_id + Name) auf einer Übersichtsseite.
 * Kachel = kleinster Teilbaum, der genau eine ID und einen Namenstext enthält.
 */
export function extractRecipeTiles(page: unknown): PicnicRecipeTile[] {
	const tiles: PicnicRecipeTile[] = [];
	type Agg = { ids: Set<string>; texts: string[] };

	function walk(node: unknown): Agg {
		const agg: Agg = { ids: new Set(), texts: [] };
		if (node == null) return agg;
		if (typeof node === 'string') {
			const match = node.match(/selling_group_id=([a-z0-9]+)/i);
			if (match) agg.ids.add(match[1]);
			return agg;
		}
		if (typeof node !== 'object') return agg;
		const record = node as Record<string, unknown>;
		if (typeof record.markdown === 'string') agg.texts.push(record.markdown);

		const childAggs: Agg[] = [];
		for (const value of Array.isArray(node) ? node : Object.values(record)) {
			const child = walk(value);
			childAggs.push(child);
			for (const id of child.ids) agg.ids.add(id);
			agg.texts.push(...child.texts);
		}

		if (agg.ids.size === 1 && agg.texts.length > 0) {
			const childIsTile = childAggs.some((c) => c.ids.size === 1 && c.texts.length > 0);
			if (!childIsTile) {
				const [id] = agg.ids;
				const name = agg.texts
					.map(cleanText)
					.find((t) => t.length > 3 && !/^(Nicht alles|Hinzufügen|Ansehen|Ersetzen|\d+ Min)/i.test(t));
				if (name) tiles.push({ id, name });
			}
		}
		return agg;
	}

	walk(page);
	// Duplikate (dieselbe ID taucht mehrfach auf der Seite auf) entfernen
	const byId = new Map<string, PicnicRecipeTile>();
	for (const tile of tiles) if (!byId.has(tile.id)) byId.set(tile.id, tile);
	return [...byId.values()];
}

/** Zerlegt eine Zutatenzeile wie „**Pitas** 6 Stk." oder „**Feta** 113 g". */
function parseIngredientLine(line: string): ParsedPicnicIngredient | null {
	const match = line.match(/^\*\*(.+?)\*\*\s*(.*)$/);
	if (!match) return null;
	const name = cleanText(match[1]);
	const rest = cleanText(match[2]);
	if (!name) return null;
	const qty = rest.match(/^([\d.,]+)\s*(.+)?$/);
	if (!qty) return { name, amount: null, unit: rest || null };
	const amount = parseFloat(qty[1].replace(',', '.'));
	let unit = qty[2]?.trim() ?? null;
	if (unit && /^stk\.?$|^stück$/i.test(unit)) unit = 'Stück';
	return { name, amount: Number.isNaN(amount) ? null : amount, unit };
}

/** Parst die Detailseite eines Rezepts (Zutaten, Portionen, Schritte, Tipp). */
export function parseRecipeDetail(page: unknown, recipeName?: string): ParsedPicnicRecipe {
	const md = collectMarkdown(page);

	// Beschreibung: der Text direkt nach dem ersten Auftreten des Rezeptnamens
	let description: string | null = null;
	if (recipeName) {
		const nameIndex = md.findIndex((t) => cleanText(t) === cleanText(recipeName));
		const candidate = nameIndex >= 0 ? cleanText(md[nameIndex + 1] ?? '') : '';
		if (candidate.length > 20 && !candidate.includes('min')) description = candidate;
	}

	// Portionen: „3 Portionen"
	let servings: number | null = null;
	for (const text of md) {
		const match = cleanText(text).match(/^(\d+)\s+Portionen?$/);
		if (match) {
			servings = Number(match[1]);
			break;
		}
	}

	// Zutatenblock: nach der Überschrift „Zutaten" bis „So wird's gemacht"
	const ingredients: ParsedPicnicIngredient[] = [];
	const extraLines: string[] = [];
	const start = md.findIndex((t) => cleanText(t) === 'Zutaten');
	if (start >= 0) {
		for (let i = start + 1; i < md.length; i++) {
			const raw = md[i];
			const clean = cleanText(raw);
			if (/^So wird/i.test(clean)) break;
			if (/^(Eigene Zutaten|Du benötigst)/i.test(clean)) {
				extraLines.push(clean);
				continue;
			}
			const ingredient = parseIngredientLine(raw);
			if (ingredient) ingredients.push(ingredient);
		}
	}

	// Schritte: Paare „Schritt N" → Folgetext; danach optional „Tipp" → Folgetext
	const steps: string[] = [];
	let tip: string | null = null;
	for (let i = 0; i < md.length; i++) {
		const clean = cleanText(md[i]);
		if (/^Schritt \d+$/.test(clean) && md[i + 1]) {
			steps.push(cleanText(md[i + 1]));
			i++;
		} else if (clean === 'Tipp' && md[i + 1] && tip === null && steps.length > 0) {
			tip = cleanText(md[i + 1]);
			i++;
		}
	}

	return { description, servings, ingredients, extraLines, steps, tip };
}

/** Baut aus dem geparsten Rezept den Zubereitungstext für unsere DB. */
export function buildInstructions(parsed: ParsedPicnicRecipe): string {
	const parts: string[] = [];
	if (parsed.description) parts.push(parsed.description, '');
	parsed.steps.forEach((step, index) => {
		parts.push(`Schritt ${index + 1}: ${step}`, '');
	});
	if (parsed.extraLines.length > 0) parts.push(...parsed.extraLines, '');
	if (parsed.tip) parts.push(`Tipp: ${parsed.tip}`);
	return parts.join('\n').trim();
}
