/**
 * Lädt ein Rezept samt Zutaten und – für verknüpfte Artikel – Gebindegröße,
 * Picnic-ID und aktuellem Gesamtbestand.
 */
import { db } from '$lib/server/db';
import { articles, recipeIngredients, recipes, stockEntries } from '$lib/server/db/schema';
import { coverage, scaleAmount } from '$lib/units';
import { eq, sql } from 'drizzle-orm';

export type RecipeIngredientDetail = {
	id: number;
	articleId: number | null;
	articleName: string | null;
	freeText: string | null;
	amount: number | null;
	unit: string | null;
	packageAmount: number | null;
	packageUnit: string | null;
	picnicId: string | null;
	imagePath: string | null;
	stockPackages: number;
};

export function getRecipe(id: number) {
	return db.select().from(recipes).where(eq(recipes.id, id)).get();
}

/**
 * Kochbar = alle verknüpften Zutaten mit vergleichbarer Einheit sind durch den
 * Vorrat gedeckt. Freitext- und nicht vergleichbare Zutaten blockieren nicht.
 */
export function isRecipeCookable(ingredients: RecipeIngredientDetail[], baseServings: number, servings: number): boolean {
	for (const ing of ingredients) {
		if (!ing.articleId || ing.amount == null) continue;
		const scaled = scaleAmount(ing.amount, baseServings, servings) ?? 0;
		const cov = coverage(scaled, ing.unit, ing.packageAmount, ing.packageUnit, ing.stockPackages);
		if (cov.comparable && !cov.covered) return false;
	}
	return true;
}

export function getRecipeIngredients(recipeId: number): RecipeIngredientDetail[] {
	return db
		.select({
			id: recipeIngredients.id,
			articleId: recipeIngredients.articleId,
			articleName: articles.name,
			freeText: recipeIngredients.freeText,
			amount: recipeIngredients.amount,
			unit: recipeIngredients.unit,
			packageAmount: articles.amount,
			packageUnit: articles.unit,
			picnicId: articles.picnicId,
			imagePath: articles.imagePath,
			stockPackages: sql<number>`coalesce((select sum(${stockEntries.quantity}) from ${stockEntries} where ${stockEntries.articleId} = ${recipeIngredients.articleId}), 0)`
		})
		.from(recipeIngredients)
		.leftJoin(articles, eq(articles.id, recipeIngredients.articleId))
		.where(eq(recipeIngredients.recipeId, recipeId))
		.orderBy(recipeIngredients.sortOrder)
		.all();
}
