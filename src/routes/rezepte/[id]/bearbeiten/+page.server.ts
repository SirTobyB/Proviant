import { db } from '$lib/server/db';
import { recipes, recipeIngredientArticles, recipeIngredients } from '$lib/server/db/schema';
import { getRecipeIngredients, loadRecipeOr404 } from '$lib/server/recipeData';
import { parseRecipeForm } from '$lib/server/recipeForm';
import { allTagNames, setRecipeTags, tagsForRecipe } from '$lib/server/tags';
import { auditEdit, auditLink, auditNew } from '$lib/server/audit';
import { deleteImage } from '$lib/server/images';
import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

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

		// Zutaten komplett ersetzen (einfachste konsistente Variante); die verknüpften
		// Artikel in recipe_ingredient_articles fallen dank onDelete: cascade automatisch mit weg
		db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipe.id)).run();
		if (ingredients.length > 0) {
			const insertedIngredients = db
				.insert(recipeIngredients)
				.values(
					ingredients.map((ing) => ({
						recipeId: recipe.id,
						freeText: ing.freeText,
						amount: ing.amount,
						unit: ing.unit,
						sortOrder: ing.sortOrder,
						...auditNew(user)
					}))
				)
				.returning({ id: recipeIngredients.id })
				.all();

			const links = insertedIngredients.flatMap((row, i) =>
				ingredients[i].articleIds.map((articleId, sortOrder) => ({
					recipeIngredientId: row.id,
					articleId,
					sortOrder,
					...auditLink(user)
				}))
			);
			if (links.length > 0) db.insert(recipeIngredientArticles).values(links).run();
		}
		setRecipeTags(recipe.id, tags, user);

		if (imagePath !== undefined && recipe.imagePath) deleteImage(recipe.imagePath);

		redirect(303, `/rezepte/${recipe.id}`);
	}
};
