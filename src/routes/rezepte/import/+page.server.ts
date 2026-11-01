import { db } from '#lib/server/db/index.js';
import { translator } from '#lib/i18n/index.js';
import { articles, recipes, recipeIngredientArticles, recipeIngredients } from '#lib/server/db/schema.js';
import {
	describePicnicError,
	getConnectionState,
	getPicnicRecipe,
	listOwnPicnicRecipes,
	listPicnicRecipes,
	listSavedPicnicRecipes,
	type PicnicRecipeTile
} from '#lib/server/picnic/index.js';
import { buildInstructions } from '#lib/server/picnic/recipeImport.js';
import { auditLink, auditNew } from '#lib/server/audit.js';
import { inArray } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/** Die drei Quellen als Reiter: Picnics Rezeptseite, in der App gespeicherte, eigene. */
const SOURCES = {
	katalog: listPicnicRecipes,
	gespeichert: listSavedPicnicRecipes,
	eigene: listOwnPicnicRecipes
} as const;
type Source = keyof typeof SOURCES;

function sourceFrom(url: URL): Source {
	const value = url.searchParams.get('quelle');
	return value === 'gespeichert' || value === 'eigene' ? value : 'katalog';
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const source = sourceFrom(url);
	const connection = getConnectionState();
	if (connection !== 'connected') {
		return {
			connection,
			source,
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
		const tiles = await SOURCES[source]();
		tiles.sort((a, b) => a.name.localeCompare(b.name, 'de'));
		return { connection, source, tiles, existingNames, error: null };
	} catch (err) {
		return {
			connection,
			source,
			tiles: [],
			existingNames,
			error: describePicnicError(err, translator(locals.locale), 'Rezeptliste laden')
		};
	}
};

export const actions: Actions = {
	import: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		const name = String(formData.get('name') ?? '').trim();
		if (!id || !name) return fail(400, { message: t('msg.invalidRecipe') });

		let parsed;
		try {
			parsed = await getPicnicRecipe(id);
		} catch (err) {
			return fail(502, { message: describePicnicError(err, t, 'Rezept laden') });
		}
		if (parsed.ingredients.length === 0 && parsed.steps.length === 0) {
			return fail(422, { message: t('msg.recipeParseFailed', { name }) });
		}

		// Zutaten, deren Picnic-Produkt schon als Artikel geführt wird, gleich
		// verknüpfen — dann zählt der Bestand sofort bei „Kochbar?“ mit
		const picnicIds = parsed.ingredients.map((ing) => ing.picnicId).filter((pid): pid is string => Boolean(pid));
		const articleByPicnicId = new Map(
			picnicIds.length > 0
				? db
						.select({ id: articles.id, picnicId: articles.picnicId })
						.from(articles)
						.where(inArray(articles.picnicId, picnicIds))
						.all()
						.map((a) => [a.picnicId!, a.id] as const)
				: []
		);

		const user = locals.user?.username ?? null;
		const recipeId = db.transaction((tx) => {
			const newId = tx
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

			parsed.ingredients.forEach((ing, index) => {
				const ingredientId = tx
					.insert(recipeIngredients)
					.values({
						recipeId: newId,
						freeText: ing.name,
						amount: ing.amount,
						unit: ing.unit,
						sortOrder: index,
						...auditNew(user)
					})
					.returning({ id: recipeIngredients.id })
					.get().id;
				const articleId = ing.picnicId ? articleByPicnicId.get(ing.picnicId) : undefined;
				if (articleId !== undefined) {
					tx.insert(recipeIngredientArticles)
						.values({ recipeIngredientId: ingredientId, articleId, ...auditLink(user) })
						.run();
				}
			});
			return newId;
		});

		redirect(303, `/rezepte/${recipeId}`);
	}
};
