import { db } from '$lib/server/db';
import { recipes } from '$lib/server/db/schema';
import { getRecipe, getRecipeIngredients } from '$lib/server/recipeData';
import { tagsForRecipe } from '$lib/server/tags';
import { auditEdit } from '$lib/server/audit';
import { deleteImage } from '$lib/server/images';
import { addToCart, getConnectionState } from '$lib/server/picnic';
import { coverageMulti, scaleAmount } from '$lib/units';
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
	addToCart: async ({ params, request, locals }) => {
		const recipe = loadRecipeOr404(params.id);
		const portions = Math.max(1, Number((await request.formData()).get('portions')) || recipe.servings);
		const ingredients = getRecipeIngredients(recipe.id);

		const items: { productId: string; quantity: number }[] = [];
		const unlinked: string[] = [];
		const incomparable: string[] = [];

		for (const ing of ingredients) {
			if (ing.articles.length === 0 || ing.amount == null) continue;
			const label = ing.articles.map((a) => a.name).join(' / ') || ing.freeText || 'Zutat';
			if (!ing.articles.some((a) => a.picnicId)) {
				unlinked.push(label);
				continue;
			}
			const scaled = scaleAmount(ing.amount, recipe.servings, portions) ?? 0;
			const result = coverageMulti(scaled, ing.unit, ing.articles);
			if (!result.comparable) {
				incomparable.push(label);
				continue;
			}
			if (result.neededPackages > 0 && result.orderPicnicId) {
				const existing = items.find((i) => i.productId === result.orderPicnicId);
				if (existing) existing.quantity += result.neededPackages;
				else items.push({ productId: result.orderPicnicId, quantity: result.neededPackages });
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
		db.update(recipes)
			.set({ lastCookedAt: new Date(), ...auditEdit(locals.user?.username) })
			.where(eq(recipes.id, recipe.id))
			.run();

		return {
			added: items.length,
			totalPackages: items.reduce((sum, i) => sum + i.quantity, 0),
			unlinked,
			incomparable
		};
	},

	// Manuell als heute gekocht markieren (Vorrat gereicht, keine Bestellung nötig)
	markCooked: ({ params, locals }) => {
		const recipe = loadRecipeOr404(params.id);
		db.update(recipes)
			.set({ lastCookedAt: new Date(), ...auditEdit(locals.user?.username) })
			.where(eq(recipes.id, recipe.id))
			.run();
		return { cooked: true };
	},

	delete: ({ params }) => {
		const recipe = loadRecipeOr404(params.id);
		db.delete(recipes).where(eq(recipes.id, recipe.id)).run();
		deleteImage(recipe.imagePath);
		redirect(303, '/rezepte');
	}
};
