import { db } from '$lib/server/db';
import { recipes } from '$lib/server/db/schema';
import { getRecipe, getRecipeIngredients } from '$lib/server/recipeData';
import { tagsForRecipe } from '$lib/server/tags';
import { deleteImage } from '$lib/server/images';
import { addToCart, getConnectionState } from '$lib/server/picnic';
import { coverage, scaleAmount } from '$lib/units';
import { eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function loadRecipeOr404(idParam: string) {
	const id = Number(idParam);
	if (!Number.isInteger(id)) throw error(404, 'Rezept nicht gefunden');
	const recipe = getRecipe(id);
	if (!recipe) throw error(404, 'Rezept nicht gefunden');
	return recipe;
}

export const load: PageServerLoad = ({ params }) => {
	const recipe = loadRecipeOr404(params.id);
	return {
		recipe,
		ingredients: getRecipeIngredients(recipe.id),
		tags: tagsForRecipe(recipe.id),
		connection: getConnectionState()
	};
};

export const actions: Actions = {
	// Fehlende Zutaten (aufgerundet auf Gebinde) in den Picnic-Warenkorb legen
	addToCart: async ({ params, request }) => {
		const recipe = loadRecipeOr404(params.id);
		const portions = Math.max(1, Number((await request.formData()).get('portions')) || recipe.servings);
		const ingredients = getRecipeIngredients(recipe.id);

		const items: { productId: string; quantity: number }[] = [];
		const unlinked: string[] = [];
		const incomparable: string[] = [];

		for (const ing of ingredients) {
			if (!ing.articleId || ing.amount == null) continue;
			if (!ing.picnicId) {
				unlinked.push(ing.articleName ?? ing.freeText ?? 'Zutat');
				continue;
			}
			const scaled = scaleAmount(ing.amount, recipe.servings, portions) ?? 0;
			const result = coverage(scaled, ing.unit, ing.packageAmount, ing.packageUnit, ing.stockPackages);
			if (!result.comparable) {
				incomparable.push(ing.articleName ?? 'Zutat');
				continue;
			}
			if (result.neededPackages > 0) {
				const existing = items.find((i) => i.productId === ing.picnicId);
				if (existing) existing.quantity += result.neededPackages;
				else items.push({ productId: ing.picnicId, quantity: result.neededPackages });
			}
		}

		if (items.length === 0) {
			return fail(400, {
				message:
					incomparable.length > 0
						? `Einheiten nicht vergleichbar bei: ${incomparable.join(', ')}`
						: 'Nichts zu bestellen — Vorrat reicht oder keine Picnic-Verknüpfung'
			});
		}

		try {
			await addToCart(items);
		} catch (err) {
			return fail(502, { message: err instanceof Error ? err.message : 'Warenkorb-Übergabe fehlgeschlagen' });
		}

		// Bestellt = gekocht: Zeitpunkt für die 2-Wochen-Sperre merken
		db.update(recipes).set({ lastCookedAt: new Date() }).where(eq(recipes.id, recipe.id)).run();

		return {
			added: items.length,
			totalPackages: items.reduce((sum, i) => sum + i.quantity, 0),
			unlinked,
			incomparable
		};
	},

	// Manuell als heute gekocht markieren (Vorrat gereicht, keine Bestellung nötig)
	markCooked: ({ params }) => {
		const recipe = loadRecipeOr404(params.id);
		db.update(recipes).set({ lastCookedAt: new Date() }).where(eq(recipes.id, recipe.id)).run();
		return { cooked: true };
	},

	delete: ({ params }) => {
		const recipe = loadRecipeOr404(params.id);
		db.delete(recipes).where(eq(recipes.id, recipe.id)).run();
		deleteImage(recipe.imagePath);
		redirect(303, '/rezepte');
	}
};
