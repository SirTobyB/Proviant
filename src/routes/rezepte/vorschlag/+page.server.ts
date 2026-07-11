import { db } from '$lib/server/db';
import { recipes, recipeTags, tags } from '$lib/server/db/schema';
import { getRecipe, getRecipeIngredients, isRecipeCookable } from '$lib/server/recipeData';
import { allTagNames, tagsForRecipe } from '$lib/server/tags';
import { eligible, pickWeighted, type SuggestCandidate } from '$lib/suggest';
import { eq, inArray, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { allTags: allTagNames() };
};

export const actions: Actions = {
	roll: async ({ request }) => {
		const formData = await request.formData();
		const selectedTags = formData.getAll('tags').map(String).filter(Boolean);

		// Rezept-IDs, die alle gewählten Tags tragen (AND-Verknüpfung)
		let idFilter: number[] | null = null;
		if (selectedTags.length > 0) {
			const matching = db
				.select({ recipeId: recipeTags.recipeId })
				.from(recipeTags)
				.innerJoin(tags, eq(tags.id, recipeTags.tagId))
				.where(inArray(tags.name, selectedTags))
				.groupBy(recipeTags.recipeId)
				.having(sql`count(distinct ${tags.name}) = ${selectedTags.length}`)
				.all()
				.map((r) => r.recipeId);
			idFilter = matching;
			if (matching.length === 0) {
				return { none: true, reason: 'Kein Rezept passt zu den gewählten Tags.', tags: selectedTags };
			}
		}

		const recipeRows = db
			.select({ id: recipes.id, servings: recipes.servings, lastCookedAt: recipes.lastCookedAt })
			.from(recipes)
			.where(idFilter ? inArray(recipes.id, idFilter) : undefined)
			.all();

		if (recipeRows.length === 0) {
			return { none: true, reason: 'Es gibt noch keine Rezepte.', tags: selectedTags };
		}

		const candidates: SuggestCandidate[] = recipeRows.map((r) => ({
			id: r.id,
			lastCookedAt: r.lastCookedAt ? r.lastCookedAt.getTime() : null,
			cookable: isRecipeCookable(getRecipeIngredients(r.id), r.servings, r.servings)
		}));

		const now = Date.now();
		let pool = eligible(candidates, now);
		let relaxed = false;
		// Sind alle innerhalb der Sperrfrist, wird die Sperre gelockert
		if (pool.length === 0) {
			pool = candidates;
			relaxed = true;
		}

		const picked = pickWeighted(pool);
		if (!picked) {
			return { none: true, reason: 'Kein passendes Rezept gefunden.', tags: selectedTags };
		}

		const recipe = getRecipe(picked.id)!;
		return {
			suggestion: {
				id: recipe.id,
				name: recipe.name,
				category: recipe.category,
				servings: recipe.servings,
				imagePath: recipe.imagePath,
				tags: tagsForRecipe(recipe.id),
				cookable: picked.cookable,
				lastCookedAt: recipe.lastCookedAt ? recipe.lastCookedAt.toISOString() : null
			},
			poolSize: pool.length,
			relaxed,
			tags: selectedTags
		};
	},

	markCooked: async ({ request }) => {
		const id = Number((await request.formData()).get('recipeId'));
		if (!Number.isInteger(id) || !getRecipe(id)) return fail(400, { message: 'Rezept nicht gefunden' });
		db.update(recipes).set({ lastCookedAt: new Date() }).where(eq(recipes.id, id)).run();
		return { cooked: true };
	}
};
