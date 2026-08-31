import { db } from '$lib/server/db';
import { recipes } from '$lib/server/db/schema';
import { getRecipeIngredients, isRecipeCookable } from '$lib/server/recipeData';
import { tagsForRecipe } from '$lib/server/tags';
import { recipeCost } from '$lib/recipeCost';
import { pricesFor } from '$lib/server/prices';
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

	const enriched = withIngredients.map(({ recipe, ingredients }) => {
		// Bewusst der all-Block: Kacheln sollen Rezepte vergleichbar machen —
		// ein vorratsabhängiger toOrder-Preis wäre morgen ein anderer, ohne
		// dass sich am Rezept etwas geändert hätte.
		//
		// Und bewusst die **eigene** Portionszahl des Rezepts statt der
		// Vorgabe: Direkt neben der Zahl steht „Für 12 Personen", eine auf 3
		// gerechnete Kachel widerspräche also ihrer eigenen Beschriftung.
		// Dazu rechnet die Kostenrechnung auf ganze Gebinde — ein
		// 12-Portionen-Kuchen auf 3 heruntergerechnet braucht immer noch den
		// ganzen Sack Mehl und sähe dreimal so teuer aus, wie er ist.
		// Vergleichbar bleiben die Kacheln trotzdem: Es ist überall der
		// vorratsunabhängige Preis je Portion.
		const { all } = recipeCost({
			ingredients,
			baseServings: recipe.servings,
			portions: recipe.servings,
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
