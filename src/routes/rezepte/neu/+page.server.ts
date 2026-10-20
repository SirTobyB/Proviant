import { db } from '#lib/server/db/index.js';
import { translator } from '#lib/i18n/index.js';
import { recipes, recipeIngredientArticles, recipeIngredients } from '#lib/server/db/schema.js';
import { parseRecipeForm } from '#lib/server/recipeForm.js';
import { allTagNames, setRecipeTags } from '#lib/server/tags.js';
import { auditLink, auditNew } from '#lib/server/audit.js';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { allTags: allTagNames() };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const user = locals.user?.username ?? null;
		const { values, ingredients, tags, imagePath, error } = await parseRecipeForm(await request.formData(), t);
		if (error) return fail(400, { message: error });

		const recipeId = db
			.insert(recipes)
			.values({ ...values, imagePath: imagePath ?? null, ...auditNew(user) })
			.returning({ id: recipes.id })
			.get().id;

		if (ingredients.length > 0) {
			const insertedIngredients = db
				.insert(recipeIngredients)
				.values(
					ingredients.map((ing) => ({
						recipeId,
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
		setRecipeTags(recipeId, tags, user);

		redirect(303, `/rezepte/${recipeId}`);
	}
};
