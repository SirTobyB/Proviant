/**
 * Gebündelte Bedarfsermittlung für den Wochenplan: mehrere Rezepte teilen
 * sich denselben Lagerbestand, eine Einzelrezept-für-Einzelrezept-Prüfung
 * würde denselben Vorrat für mehrere Tage doppelt als "vorhanden" werten.
 */
import { getRecipe, getRecipeIngredients } from '$lib/server/recipeData';
import { pickOrderArticle, scaleAmount, toBase, unitFamily, type IngredientArticleStock } from '$lib/units';

export type WeekShoppingList = {
	items: { productId: string; quantity: number }[];
	unlinked: string[];
	incomparable: string[];
};

/**
 * Läuft chronologisch durch die geplanten Tage und pflegt einen gemeinsamen
 * Vorrats-Pool je Artikel (in Basiseinheiten), der beim ersten Antreffen
 * eines Artikels aus dem echten Bestand befüllt wird. Reicht der Pool für
 * eine Zutat nicht, wird auf Gebinde des ersten Picnic-verknüpften
 * Alternativartikels aufgerundet und der Rundungs-Überschuss zurück in den
 * Pool gebucht, damit ein späterer Tag denselben Artikel korrekt als
 * (teilweise) aufgefüllt sieht — ohne das würde für denselben Artikel an
 * mehreren Tagen unnötig mehrfach je ein ganzes Gebinde bestellt.
 *
 * Erwartet `entries` bereits chronologisch (nach Datum) sortiert.
 */
export function planWeekShoppingList(entries: { recipeId: number; servings: number }[]): WeekShoppingList {
	const pool = new Map<number, number>(); // articleId -> Restbestand in Basiseinheiten
	const cart = new Map<string, number>(); // picnicId -> Anzahl Gebinde
	const unlinked = new Set<string>();
	const incomparable = new Set<string>();

	for (const entry of entries) {
		const recipe = getRecipe(entry.recipeId);
		if (!recipe) continue;
		const ingredients = getRecipeIngredients(entry.recipeId);

		for (const ing of ingredients) {
			if (ing.articles.length === 0 || ing.amount == null) continue;
			const scaled = scaleAmount(ing.amount, recipe.servings, entry.servings) ?? 0;
			const requiredBase = toBase(scaled, ing.unit);
			const requiredFamily = unitFamily(ing.unit);
			const label = ing.articles.map((a) => a.name).join(' / ') || ing.freeText || 'Zutat';

			if (requiredBase == null || requiredFamily == null) {
				incomparable.add(label);
				continue;
			}

			// Phase 1: Bedarf aus dem gemeinsamen Pool decken, in der für die
			// Zutat gespeicherten Artikel-Reihenfolge.
			let remaining = requiredBase;
			let sawCompatible = false;
			for (const art of ing.articles) {
				if (unitFamily(art.packageUnit) !== requiredFamily) continue;
				const packageBase = art.packageAmount != null ? toBase(art.packageAmount, art.packageUnit) : null;
				if (packageBase == null || packageBase <= 0) continue;
				sawCompatible = true;
				if (!pool.has(art.id)) pool.set(art.id, packageBase * art.stockPackages);
				const available = pool.get(art.id)!;
				const used = Math.min(available, remaining);
				if (used > 0) {
					pool.set(art.id, available - used);
					remaining -= used;
				}
				if (remaining <= 0) break;
			}

			if (remaining <= 0) continue; // vollständig aus dem Pool gedeckt
			if (!sawCompatible) {
				incomparable.add(label);
				continue;
			}

			// Phase 2: weiterhin offen -> Bestell-Artikel über denselben Helfer
			// bestimmen, den auch coverageMulti für die Einzeltag-Ansicht nutzt.
			// Bestand ist hier bewusst 0, da Phase 1 den Pool bereits berücksichtigt hat.
			const candidateArticles: IngredientArticleStock[] = ing.articles.map((a) => ({
				id: a.id,
				packageAmount: a.packageAmount,
				packageUnit: a.packageUnit,
				picnicId: a.picnicId,
				stockPackages: 0
			}));
			const { orderArticle } = pickOrderArticle(candidateArticles, requiredFamily);
			if (!orderArticle) {
				unlinked.add(label);
				continue;
			}

			const orderPackageBase = toBase(orderArticle.packageAmount!, orderArticle.packageUnit)!;
			const neededPackages = Math.ceil(remaining / orderPackageBase);
			cart.set(orderArticle.picnicId!, (cart.get(orderArticle.picnicId!) ?? 0) + neededPackages);
			// Rundungs-Überschuss zurück in den Pool buchen.
			const boughtBase = neededPackages * orderPackageBase;
			pool.set(orderArticle.id, (pool.get(orderArticle.id) ?? 0) + (boughtBase - remaining));
		}
	}

	return {
		items: [...cart.entries()].map(([productId, quantity]) => ({ productId, quantity })),
		unlinked: [...unlinked],
		incomparable: [...incomparable]
	};
}
