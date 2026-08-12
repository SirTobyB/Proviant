/**
 * Lädt ein Rezept samt Zutaten und – für verknüpfte Artikel (inkl. akzeptierter
 * Alternativartikel) – Gebindegröße, Picnic-ID und aktuellem Gesamtbestand.
 */
import { db } from '$lib/server/db';
import { articles, recipeIngredientArticles, recipeIngredients, recipes, stockEntries } from '$lib/server/db/schema';
import { coverageMulti, scaleAmount } from '$lib/units';
import { eq, inArray, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export type IngredientArticleOption = {
	id: number;
	name: string;
	packageAmount: number | null;
	packageUnit: string | null;
	picnicId: string | null;
	imagePath: string | null;
	stockPackages: number;
};

export type RecipeIngredientDetail = {
	id: number;
	freeText: string | null;
	amount: number | null;
	unit: string | null;
	/** Akzeptierte Artikel (Hauptartikel + Alternativen), in erfasster Reihenfolge. */
	articles: IngredientArticleOption[];
};

export function getRecipe(id: number) {
	return db.select().from(recipes).where(eq(recipes.id, id)).get();
}

/** Rezept aus einem Routen-Parameter laden oder mit 404 abbrechen. */
export function loadRecipeOr404(idParam: string) {
	const id = Number(idParam);
	if (!Number.isInteger(id)) throw error(404, 'Rezept nicht gefunden');
	const recipe = getRecipe(id);
	if (!recipe) throw error(404, 'Rezept nicht gefunden');
	return recipe;
}

/**
 * Kochbar = für jede Zutat mit verknüpften Artikeln und vergleichbarer Einheit
 * deckt der zusammengezählte Vorrat aller akzeptierten Artikel den Bedarf.
 * Freitext- und nicht vergleichbare Zutaten blockieren nicht.
 */
export function isRecipeCookable(ingredients: RecipeIngredientDetail[], baseServings: number, servings: number): boolean {
	for (const ing of ingredients) {
		if (ing.articles.length === 0 || ing.amount == null) continue;
		const scaled = scaleAmount(ing.amount, baseServings, servings) ?? 0;
		const cov = coverageMulti(scaled, ing.unit, ing.articles);
		if (cov.comparable && !cov.covered) return false;
	}
	return true;
}

export function getRecipeIngredients(recipeId: number): RecipeIngredientDetail[] {
	const rows = db
		.select({
			id: recipeIngredients.id,
			freeText: recipeIngredients.freeText,
			amount: recipeIngredients.amount,
			unit: recipeIngredients.unit
		})
		.from(recipeIngredients)
		.where(eq(recipeIngredients.recipeId, recipeId))
		.orderBy(recipeIngredients.sortOrder)
		.all();

	if (rows.length === 0) return [];

	const articleRows = db
		.select({
			recipeIngredientId: recipeIngredientArticles.recipeIngredientId,
			id: articles.id,
			name: articles.name,
			packageAmount: articles.amount,
			packageUnit: articles.unit,
			picnicId: articles.picnicId,
			imagePath: articles.imagePath,
			stockPackages: sql<number>`coalesce((select sum(${stockEntries.quantity}) from ${stockEntries} where ${stockEntries.articleId} = ${articles.id}), 0)`
		})
		.from(recipeIngredientArticles)
		.innerJoin(articles, eq(articles.id, recipeIngredientArticles.articleId))
		.where(
			inArray(
				recipeIngredientArticles.recipeIngredientId,
				rows.map((r) => r.id)
			)
		)
		.orderBy(recipeIngredientArticles.sortOrder)
		.all();

	const byIngredient = new Map<number, IngredientArticleOption[]>();
	for (const { recipeIngredientId, ...option } of articleRows) {
		const list = byIngredient.get(recipeIngredientId) ?? [];
		list.push(option);
		byIngredient.set(recipeIngredientId, list);
	}

	return rows.map((r) => ({ ...r, articles: byIngredient.get(r.id) ?? [] }));
}
