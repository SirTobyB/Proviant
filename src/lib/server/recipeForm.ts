/**
 * Auswertung des Rezeptformulars (Neuanlage und Bearbeitung).
 * Zutaten werden als JSON-Array im Feld `ingredients` übergeben.
 */
import { saveImageFromUpload } from '$lib/server/images';

export type ParsedIngredient = {
	articleId: number | null;
	freeText: string | null;
	amount: number | null;
	unit: string | null;
	sortOrder: number;
};

export type RecipeFormResult = {
	values: {
		name: string;
		category: 'meal' | 'cake';
		servings: number;
		instructions: string | null;
	};
	ingredients: ParsedIngredient[];
	/** Neuer Bild-Dateiname; undefined = Bild unverändert lassen */
	imagePath: string | undefined;
	error: string | null;
};

export async function parseRecipeForm(formData: FormData): Promise<RecipeFormResult> {
	const text = (key: string) => {
		const value = formData.get(key);
		return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
	};

	const name = text('name');
	const empty = { name: '', category: 'meal' as const, servings: 4, instructions: null };
	if (!name) return { values: empty, ingredients: [], imagePath: undefined, error: 'Name ist erforderlich' };

	const category = text('category') === 'cake' ? 'cake' : 'meal';
	const servings = Math.max(1, parseInt(text('servings') ?? '4', 10) || 4);

	// Zutaten aus JSON parsen
	let ingredients: ParsedIngredient[] = [];
	try {
		const raw = JSON.parse((formData.get('ingredients') as string) || '[]');
		if (Array.isArray(raw)) {
			ingredients = raw
				.map((row: Record<string, unknown>, index: number) => {
					const articleId =
						row.articleId != null && row.articleId !== '' ? Number(row.articleId) : null;
					const freeText =
						typeof row.freeText === 'string' && row.freeText.trim() !== ''
							? row.freeText.trim()
							: null;
					const amount =
						row.amount != null && row.amount !== '' && !Number.isNaN(Number(row.amount))
							? Number(row.amount)
							: null;
					const unit = typeof row.unit === 'string' && row.unit.trim() !== '' ? row.unit.trim() : null;
					return { articleId, freeText, amount, unit, sortOrder: index };
				})
				// Zeilen ohne jegliche Angabe verwerfen
				.filter((row) => row.articleId != null || row.freeText != null);
		}
	} catch {
		return {
			values: { name, category, servings, instructions: text('instructions') },
			ingredients: [],
			imagePath: undefined,
			error: 'Zutatenliste konnte nicht gelesen werden'
		};
	}

	let imagePath: string | undefined;
	const upload = formData.get('image');
	if (upload instanceof File && upload.size > 0) {
		try {
			imagePath = await saveImageFromUpload(upload);
		} catch (err) {
			return {
				values: { name, category, servings, instructions: text('instructions') },
				ingredients,
				imagePath: undefined,
				error: `Bild: ${err instanceof Error ? err.message : 'Fehler'}`
			};
		}
	}

	return {
		values: { name, category, servings, instructions: text('instructions') },
		ingredients,
		imagePath,
		error: null
	};
}
