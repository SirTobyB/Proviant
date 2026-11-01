import { db } from '#lib/server/db/index.js';
import type { Translate } from '#lib/i18n/index.js';
import { articles, recipes, recipeIngredientArticles, recipeIngredients } from '#lib/server/db/schema.js';
import { describePicnicError, getPicnicRecipe, picnicErrorKind, type PicnicErrorKind } from '#lib/server/picnic/index.js';
import { buildInstructions } from '#lib/server/picnic/recipeImport.js';
import { auditLink, auditNew } from '#lib/server/audit.js';
import { inArray, sql } from 'drizzle-orm';

export type PicnicRecipeImportResult =
	| { ok: true; recipeId: number }
	| { ok: false; status: number; message: string; kind?: PicnicErrorKind };

/** Gibt es schon ein Rezept dieses Namens? Gleiche Regel wie die Markierung „bereits vorhanden". */
export function recipeNameExists(name: string): boolean {
	return (
		db
			.select({ id: recipes.id })
			.from(recipes)
			.where(sql`lower(${recipes.name}) = ${name.toLowerCase()}`)
			.get() !== undefined
	);
}

/**
 * Ein Picnic-Rezept als eigenes Rezept anlegen. Geteilt vom Einzelimport und
 * von „Alle importieren"; der Picnic-Abruf läuft gedrosselt (siehe
 * `picnic/throttle.ts`).
 */
export async function importPicnicRecipe(
	id: string,
	name: string,
	user: string | null,
	t: Translate
): Promise<PicnicRecipeImportResult> {
	let parsed;
	try {
		parsed = await getPicnicRecipe(id);
	} catch (err) {
		return {
			ok: false,
			status: 502,
			message: describePicnicError(err, t, 'Rezept laden'),
			kind: picnicErrorKind(err)
		};
	}
	if (parsed.ingredients.length === 0 && parsed.steps.length === 0) {
		return { ok: false, status: 422, message: t('msg.recipeParseFailed', { name }) };
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

	return { ok: true, recipeId };
}
