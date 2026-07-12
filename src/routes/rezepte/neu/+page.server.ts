import { db } from '$lib/server/db';
import { recipes, recipeIngredients } from '$lib/server/db/schema';
import { parseRecipeForm } from '$lib/server/recipeForm';
import { allTagNames, setRecipeTags } from '$lib/server/tags';
import { auditNew } from '$lib/server/audit';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { allTags: allTagNames() };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = locals.user?.username ?? null;
		const { values, ingredients, tags, imagePath, error } = await parseRecipeForm(await request.formData());
		if (error) return fail(400, { message: error });

		const recipeId = db
			.insert(recipes)
			.values({ ...values, imagePath: imagePath ?? null, ...auditNew(user) })
			.returning({ id: recipes.id })
			.get().id;

		if (ingredients.length > 0) {
			db.insert(recipeIngredients)
				.values(ingredients.map((ing) => ({ ...ing, recipeId, ...auditNew(user) })))
				.run();
		}
		setRecipeTags(recipeId, tags, user);

		redirect(303, `/rezepte/${recipeId}`);
	}
};
