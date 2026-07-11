import { db } from '$lib/server/db';
import { recipes, recipeIngredients } from '$lib/server/db/schema';
import { parseRecipeForm } from '$lib/server/recipeForm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const { values, ingredients, imagePath, error } = await parseRecipeForm(await request.formData());
		if (error) return fail(400, { message: error });

		const recipeId = db
			.insert(recipes)
			.values({ ...values, imagePath: imagePath ?? null })
			.returning({ id: recipes.id })
			.get().id;

		if (ingredients.length > 0) {
			db.insert(recipeIngredients)
				.values(ingredients.map((ing) => ({ ...ing, recipeId })))
				.run();
		}

		redirect(303, `/rezepte/${recipeId}`);
	}
};
