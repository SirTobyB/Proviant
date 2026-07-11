import { db } from '$lib/server/db';
import { recipes } from '$lib/server/db/schema';
import { getRecipeIngredients, isRecipeCookable } from '$lib/server/recipeData';
import { tagsForRecipe } from '$lib/server/tags';
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

	const enriched = rows.map((recipe) => {
		const ingredients = getRecipeIngredients(recipe.id);
		return {
			...recipe,
			tags: tagsForRecipe(recipe.id),
			cookable: isRecipeCookable(ingredients, recipe.servings, recipe.servings)
		};
	});

	// Kochbare zuerst, optional nur kochbare
	const filtered = onlyCookable ? enriched.filter((r) => r.cookable) : enriched;
	filtered.sort((a, b) => (a.cookable === b.cookable ? 0 : a.cookable ? -1 : 1));

	return { recipes: filtered, category, onlyCookable };
};
