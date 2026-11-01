/**
 * Picnic-Rezept aus `recipe.getRecipe()` → unser Importformat.
 * Rein und ohne SvelteKit-Import, damit eigenständig testbar.
 *
 * Die strukturierten Daten ersetzen den alten Parser der Rezeptseite. Der las
 * die Portionen aus dem Zubereitungstext, die Mengen aber aus den
 * Zutatenkacheln — und die zeigt Picnic für die Portionenzahl, die zuletzt in
 * der App gewählt war. So wurden Mengen für 3 Portionen als 4-Portionen-Rezept
 * gespeichert. Hier stammen Portionen und Mengen aus demselben Abruf.
 *
 * Live geprüft (Picnic DE, November 2026):
 * - `neededText` ist die tatsächlich benötigte Menge, z.B. „(0.75 EL
 *   benötigt)“ — `quantity` dagegen die Zahl der **Gebinde** zum Kaufen.
 * - `VARIATION` sowie Zutaten ohne `neededText` (außer Vorrat) gehören zu
 *   Abwandlungen des Rezepts (z.B. vegan) und nicht ins Grundrezept.
 * - `CUPBOARD` und `CORE_STOCKABLE` sind Vorrat; Salz und Pfeffer kommen
 *   ganz ohne Mengenangabe.
 */
import { cleanText, type ParsedPicnicIngredient, type ParsedPicnicRecipe } from './recipeImport';

const PANTRY_TYPES = new Set(['CUPBOARD', 'CORE_STOCKABLE']);

/** Liest „(188 g benötigt)“ / „(150 g nodig)“; alles andere ergibt keine Menge. */
export function parseNeededText(text: string | null | undefined): { amount: number | null; unit: string | null } {
	const none = { amount: null, unit: null };
	if (typeof text !== 'string') return none;
	const match = text.match(/^\(?\s*(\d+(?:[.,]\d+)?)\s+(.+?)\s+(?:benötigt|nodig|needed)\s*\)?$/i);
	if (!match) return none;
	const amount = Number(match[1].replace(',', '.'));
	if (!Number.isFinite(amount) || amount <= 0) return none;
	let unit = match[2].trim();
	if (/^(stk\.?|stück|stuks?|pieces?|pcs\.?)$/i.test(unit)) unit = 'Stück';
	return { amount, unit };
}

function text(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> {
	return value != null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** HTML der Notiz eigener Rezepte als schlichter Text — kein Markup in die App. */
function stripHtml(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.trim();
}

function mapIngredient(raw: unknown): ParsedPicnicIngredient | null {
	const ing = record(raw);
	const name = text(ing.name);
	if (!name) return null;
	const pantry = PANTRY_TYPES.has(String(ing.type));
	const { amount, unit } = parseNeededText(text(ing.neededText));
	// Ohne Mengenangabe gehört eine Zutat nur als Vorrat ins Grundrezept,
	// sonst ist sie Teil einer Abwandlung
	if (ing.type === 'VARIATION' || (amount === null && !pantry)) return null;
	return { name: cleanText(name), amount, unit, picnicId: text(ing.sellingUnitId), pantry };
}

export function mapPicnicRecipe(recipe: unknown): ParsedPicnicRecipe {
	const r = record(recipe);
	const portions = r.portions;
	const steps = Array.isArray(r.steps)
		? r.steps.map((step) => (typeof step === 'string' ? cleanText(step) : '')).filter(Boolean)
		: [];
	const note = text(r.note);
	if (steps.length === 0 && note) {
		const plain = stripHtml(note);
		if (plain) steps.push(plain);
	}
	const ingredients = Array.isArray(r.ingredients)
		? r.ingredients.map(mapIngredient).filter((ing): ing is ParsedPicnicIngredient => ing !== null)
		: [];
	// Wie „Eigene Zutaten: …“ auf der alten Rezeptseite: Der Zubereitungstext
	// nennt, was aus dem eigenen Vorrat kommt
	const pantry = ingredients.filter((ing) => ing.pantry).map((ing) => ing.name);
	return {
		description: text(r.description),
		servings: typeof portions === 'number' && Number.isInteger(portions) && portions > 0 ? portions : null,
		ingredients,
		extraLines: pantry.length > 0 ? [`Aus dem Vorrat: ${pantry.join(', ')}`] : [],
		steps,
		tip: null
	};
}
