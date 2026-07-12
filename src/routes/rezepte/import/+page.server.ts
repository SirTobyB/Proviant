import { db } from '$lib/server/db';
import { recipes, recipeIngredients } from '$lib/server/db/schema';
import {
	getConnectionState,
	getPicnicRecipeDetail,
	listPicnicRecipes,
	type PicnicRecipeTile
} from '$lib/server/picnic';
import { buildInstructions } from '$lib/server/picnic/recipeImport';
import { auditNew } from '$lib/server/audit';
import { sql } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const connection = getConnectionState();
	if (connection !== 'connected') {
		return {
			connection,
			tiles: [] as PicnicRecipeTile[],
			existingNames: [] as string[],
			error: null
		};
	}

	// Bereits vorhandene Rezeptnamen, um Doppelimporte zu markieren
	const existingNames = db
		.select({ name: recipes.name })
		.from(recipes)
		.all()
		.map((r) => r.name.toLowerCase());

	try {
		const tiles = await listPicnicRecipes();
		tiles.sort((a, b) => a.name.localeCompare(b.name, 'de'));
		return { connection, tiles, existingNames, error: null };
	} catch (err) {
		return {
			connection,
			tiles: [],
			existingNames,
			error: err instanceof Error ? err.message : 'Picnic-Rezepte konnten nicht geladen werden'
		};
	}
};

export const actions: Actions = {
	import: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		const name = String(formData.get('name') ?? '').trim();
		if (!id || !name) return fail(400, { message: 'Ungültiges Rezept' });

		let parsed;
		try {
			parsed = await getPicnicRecipeDetail(id, name);
		} catch (err) {
			return fail(502, {
				message: err instanceof Error ? err.message : 'Rezept konnte nicht geladen werden'
			});
		}
		if (parsed.ingredients.length === 0 && parsed.steps.length === 0) {
			return fail(422, { message: `„${name}" konnte nicht ausgelesen werden (unbekanntes Seitenformat)` });
		}

		const user = locals.user?.username ?? null;
		const recipeId = db
			.insert(recipes)
			.values({
				name,
				category: 'meal',
				servings: parsed.servings ?? 4,
				instructions: buildInstructions(parsed),
				...auditNew(user)
			})
			.returning({ id: recipes.id })
			.get().id;

		if (parsed.ingredients.length > 0) {
			db.insert(recipeIngredients)
				.values(
					parsed.ingredients.map((ing, index) => ({
						recipeId,
						articleId: null,
						freeText: ing.name,
						amount: ing.amount,
						unit: ing.unit,
						sortOrder: index,
						...auditNew(user)
					}))
				)
				.run();
		}

		redirect(303, `/rezepte/${recipeId}`);
	}
};
