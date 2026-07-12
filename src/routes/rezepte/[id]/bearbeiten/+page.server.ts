import { db } from '$lib/server/db';
import { recipes, recipeIngredients } from '$lib/server/db/schema';
import { getRecipe, getRecipeIngredients } from '$lib/server/recipeData';
import { parseRecipeForm } from '$lib/server/recipeForm';
import { allTagNames, setRecipeTags, tagsForRecipe } from '$lib/server/tags';
import { auditEdit, auditNew } from '$lib/server/audit';
import { deleteImage } from '$lib/server/images';
import { eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function loadRecipeOr404(idParam: string) {
	const id = Number(idParam);
	if (!Number.isInteger(id)) throw error(404, 'Rezept nicht gefunden');
	const recipe = getRecipe(id);
	if (!recipe) throw error(404, 'Rezept nicht gefunden');
	return recipe;
}

export const load: PageServerLoad = ({ params }) => {
	const recipe = loadRecipeOr404(params.id);
	return {
		recipe,
		ingredients: getRecipeIngredients(recipe.id),
		tags: tagsForRecipe(recipe.id),
		allTags: allTagNames()
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const user = locals.user?.username ?? null;
		const recipe = loadRecipeOr404(params.id);
		const { values, ingredients, tags, imagePath, error: message } = await parseRecipeForm(await request.formData());
		if (message) return fail(400, { message });

		db.update(recipes)
			.set({ ...values, ...(imagePath !== undefined ? { imagePath } : {}), ...auditEdit(user) })
			.where(eq(recipes.id, recipe.id))
			.run();

		// Zutaten komplett ersetzen (einfachste konsistente Variante)
		db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipe.id)).run();
		if (ingredients.length > 0) {
			db.insert(recipeIngredients)
				.values(ingredients.map((ing) => ({ ...ing, recipeId: recipe.id, ...auditNew(user) })))
				.run();
		}
		setRecipeTags(recipe.id, tags, user);

		if (imagePath !== undefined && recipe.imagePath) deleteImage(recipe.imagePath);

		redirect(303, `/rezepte/${recipe.id}`);
	}
};
