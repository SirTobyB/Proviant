import { db } from '$lib/server/db';
import { recipes } from '$lib/server/db/schema';
import { getRecipeIngredients, isRecipeCookable } from '$lib/server/recipeData';
import { tagsForRecipe } from '$lib/server/tags';
import { recipeCost } from '$lib/recipeCost';
import { pricesFor } from '$lib/server/prices';
import { defaultPortions } from '$lib/server/settings';
import { sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const category = url.searchParams.get('kategorie');
	const onlyCookable = url.searchParams.get('kochbar') === '1';

	const rows = db
		.select({
			id: recipes.id,
			name: recipes.name,
			category: recipes.category,
			servings: recipes.servings,
			imagePath: recipes.imagePath
		})
		.from(recipes)
		.where(category === 'meal' || category === 'cake' ? sql`${recipes.category} = ${category}` : undefined)
		.orderBy(sql`${recipes.name} collate nocase`)
		.all();

	const withIngredients = rows.map((recipe) => ({
		recipe,
		ingredients: getRecipeIngredients(recipe.id)
	}));

	// Preise gebündelt für alle Rezepte zusammen lesen — je Rezept einzeln
	// wäre ein N+1 über die halbe Artikeltabelle. Bewusst nur der Cache
	// (kein refreshPrices): die Seite berührt die Artikel aller Rezepte auf
	// einmal, ein Auto-Refresh würde hier dutzende Picnic-Aufrufe auslösen.
	const allPicnicIds = withIngredients
		.flatMap((entry) => entry.ingredients.flatMap((ing) => ing.articles.map((a) => a.picnicId)))
		.filter((id): id is string => Boolean(id));
	const prices = pricesFor(allPicnicIds);
	const portions = defaultPortions();

	const enriched = withIngredients.map(({ recipe, ingredients }) => {
		// Bewusst der all-Block: Kacheln sollen Rezepte vergleichbar machen —
		// ein vorratsabhängiger toOrder-Preis wäre morgen ein anderer, ohne
		// dass sich am Rezept etwas geändert hätte.
		const { all } = recipeCost({
			ingredients,
			baseServings: recipe.servings,
			portions,
			prices
		});
		return {
			...recipe,
			tags: tagsForRecipe(recipe.id),
			cookable: isRecipeCookable(ingredients, recipe.servings, recipe.servings),
			perPortion: all.total > 0 ? Math.round(all.perPortion) : null,
			pricesComplete: all.complete
		};
	});

	// Kochbare zuerst, optional nur kochbare
	const filtered = onlyCookable ? enriched.filter((r) => r.cookable) : enriched;
	filtered.sort((a, b) => (a.cookable === b.cookable ? 0 : a.cookable ? -1 : 1));

	return { recipes: filtered, category, onlyCookable };
};
