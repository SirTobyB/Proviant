import { db } from '$lib/server/db';
import { translator } from '$lib/i18n';
import { mealPlanEntries, recipes, recipeTags, tags } from '$lib/server/db/schema';
import { getRecipe, getRecipeIngredients, isRecipeCookable } from '$lib/server/recipeData';
import { allTagNames } from '$lib/server/tags';
import { auditEdit, auditNew } from '$lib/server/audit';
import { planWeekShoppingList } from '$lib/server/mealPlan';
import { addToCart, getConnectionState } from '$lib/server/picnic';
import { eligible, pickWeighted, type SuggestCandidate } from '$lib/suggest';
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/** Rollierendes 7-Tage-Fenster, heute eingeschlossen. */
function weekDates(): string[] {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return Array.from({ length: 7 }, (_, i) => {
		const d = new Date(today);
		d.setDate(d.getDate() + i);
		return isoDate(d);
	});
}

function isoDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export const load: PageServerLoad = () => {
	const dates = weekDates();
	const start = dates[0];
	const end = dates[dates.length - 1];

	const rows = db
		.select({
			id: mealPlanEntries.id,
			date: mealPlanEntries.date,
			servings: mealPlanEntries.servings,
			recipeId: recipes.id,
			recipeName: recipes.name,
			category: recipes.category,
			imagePath: recipes.imagePath,
			baseServings: recipes.servings
		})
		.from(mealPlanEntries)
		.innerJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
		.where(and(gte(mealPlanEntries.date, start), lte(mealPlanEntries.date, end)))
		.orderBy(mealPlanEntries.date)
		.all();

	// Anwendungsregel: pro Datum höchstens ein Eintrag gültig (siehe Schema-Kommentar)
	const byDate = new Map<string, (typeof rows)[number]>();
	for (const row of rows) {
		if (!byDate.has(row.date)) byDate.set(row.date, row);
	}

	const days = dates.map((date) => {
		const row = byDate.get(date);
		if (!row) return { date, entry: null };
		const cookable = isRecipeCookable(getRecipeIngredients(row.recipeId), row.baseServings, row.servings);
		return {
			date,
			entry: {
				id: row.id,
				recipeId: row.recipeId,
				recipeName: row.recipeName,
				category: row.category,
				imagePath: row.imagePath,
				servings: row.servings,
				cookable
			}
		};
	});

	const allRecipes = db
		.select({ id: recipes.id, name: recipes.name, category: recipes.category, imagePath: recipes.imagePath })
		.from(recipes)
		.orderBy(sql`${recipes.name} collate nocase`)
		.all();

	return {
		days,
		allTags: allTagNames(),
		allRecipes,
		connection: getConnectionState()
	};
};

export const actions: Actions = {
	// Für angehakte leere Tage automatisch Vorschläge würfeln (keine
	// Wiederholung innerhalb derselben Woche)
	roll: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		const requestedDates = [...new Set(formData.getAll('dates').map(String).filter(Boolean))].sort();
		const selectedTags = formData.getAll('tags').map(String).filter(Boolean);
		const user = locals.user?.username ?? null;

		if (requestedDates.length === 0) return fail(400, { message: t('msg.noDaysSelected') });

		const dates = weekDates();
		const start = dates[0];
		const end = dates[dates.length - 1];

		// Rezepte, die an ANDEREN Tagen im sichtbaren Fenster bereits feststehen,
		// sollen in dieser Woche nicht doppelt vorkommen
		const existing = db
			.select({ date: mealPlanEntries.date, recipeId: mealPlanEntries.recipeId })
			.from(mealPlanEntries)
			.where(and(gte(mealPlanEntries.date, start), lte(mealPlanEntries.date, end)))
			.all();
		const usedIds = new Set(
			existing.filter((e) => !requestedDates.includes(e.date)).map((e) => e.recipeId)
		);

		// Kandidatenpool wie beim Einzelvorschlag (optional tag-gefiltert)
		let idFilter: number[] | null = null;
		if (selectedTags.length > 0) {
			idFilter = db
				.select({ recipeId: recipeTags.recipeId })
				.from(recipeTags)
				.innerJoin(tags, eq(tags.id, recipeTags.tagId))
				.where(inArray(tags.name, selectedTags))
				.groupBy(recipeTags.recipeId)
				.having(sql`count(distinct ${tags.name}) = ${selectedTags.length}`)
				.all()
				.map((r) => r.recipeId);
		}

		const recipeRows = db
			.select({ id: recipes.id, servings: recipes.servings, lastCookedAt: recipes.lastCookedAt })
			.from(recipes)
			.where(idFilter ? inArray(recipes.id, idFilter) : undefined)
			.all();

		if (recipeRows.length === 0) {
			return fail(400, { message: t('msg.noMatchingRecipes'), tags: selectedTags });
		}

		const now = Date.now();
		const allCandidates: SuggestCandidate[] = recipeRows.map((r) => ({
			id: r.id,
			lastCookedAt: r.lastCookedAt ? r.lastCookedAt.getTime() : null,
			cookable: isRecipeCookable(getRecipeIngredients(r.id), r.servings, r.servings)
		}));

		let relaxed = false;
		const pickedByDate = new Map<string, number>();
		const noneLeft: string[] = [];

		for (const date of requestedDates) {
			const pool = allCandidates.filter((c) => !usedIds.has(c.id));
			let pickFrom = eligible(pool, now);
			if (pickFrom.length === 0) {
				pickFrom = pool;
				if (pool.length > 0) relaxed = true;
			}
			const picked = pickWeighted(pickFrom);
			if (!picked) {
				noneLeft.push(date);
				continue;
			}
			usedIds.add(picked.id);
			pickedByDate.set(date, picked.id);
		}

		if (pickedByDate.size === 0) {
			return fail(400, { message: t('msg.noRecipesLeft'), tags: selectedTags });
		}

		db.transaction((tx) => {
			for (const [date, recipeId] of pickedByDate) {
				const recipe = recipeRows.find((r) => r.id === recipeId)!;
				tx.delete(mealPlanEntries).where(eq(mealPlanEntries.date, date)).run();
				tx.insert(mealPlanEntries)
					.values({ date, recipeId, servings: recipe.servings, ...auditNew(user) })
					.run();
			}
		});

		return { rolled: pickedByDate.size, relaxed, noneLeft, tags: selectedTags };
	},

	// Manuelle Zuweisung eines Rezepts zu einem Datum
	setDay: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		const date = String(formData.get('date') ?? '');
		const recipeId = Number(formData.get('recipeId'));
		const user = locals.user?.username ?? null;
		if (!date || !Number.isInteger(recipeId)) return fail(400, { message: t('msg.invalidInput') });
		const recipe = getRecipe(recipeId);
		if (!recipe) return fail(404, { message: t('msg.recipeNotFound') });

		db.delete(mealPlanEntries).where(eq(mealPlanEntries.date, date)).run();
		db.insert(mealPlanEntries)
			.values({ date, recipeId, servings: recipe.servings, ...auditNew(user) })
			.run();

		return { set: true };
	},

	removeDay: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id)) return fail(400, { message: t('msg.invalidInput') });
		db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, id)).run();
		return { removed: true };
	},

	updateServings: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const servings = Math.max(1, Number(formData.get('servings')) || 1);
		const user = locals.user?.username ?? null;
		if (!Number.isInteger(id)) return fail(400, { message: t('msg.invalidInput') });

		db.update(mealPlanEntries)
			.set({ servings, ...auditEdit(user) })
			.where(eq(mealPlanEntries.id, id))
			.run();

		return { updated: true };
	},

	// Fehlende Zutaten der ganzen Woche gebündelt in den Picnic-Warenkorb legen
	buildCart: async ({ locals }) => {
		const t = translator(locals.locale);
		const dates = weekDates();
		const start = dates[0];
		const end = dates[dates.length - 1];

		const entries = db
			.select({ recipeId: mealPlanEntries.recipeId, servings: mealPlanEntries.servings })
			.from(mealPlanEntries)
			.where(and(gte(mealPlanEntries.date, start), lte(mealPlanEntries.date, end)))
			.orderBy(mealPlanEntries.date)
			.all();

		if (entries.length === 0) {
			return fail(400, { message: t('msg.nothingPlanned') });
		}

		const { items, unlinked, incomparable } = planWeekShoppingList(entries);

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

		const recipeIds = [...new Set(entries.map((e) => e.recipeId))];
		db.update(recipes)
			.set({ lastCookedAt: new Date(), ...auditEdit(locals.user?.username) })
			.where(inArray(recipes.id, recipeIds))
			.run();

		return {
			added: items.length,
			totalPackages: items.reduce((sum, i) => sum + i.quantity, 0),
			unlinked,
			incomparable
		};
	}
};
