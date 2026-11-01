import { db } from '#lib/server/db/index.js';
import { translator } from '#lib/i18n/index.js';
import { recipes } from '#lib/server/db/schema.js';
import {
	describePicnicError,
	getConnectionState,
	listOwnPicnicRecipes,
	listPicnicRecipes,
	listSavedPicnicRecipes,
	type PicnicRecipeTile
} from '#lib/server/picnic/index.js';
import { importPicnicRecipe, recipeNameExists } from '#lib/server/picnicRecipeImport.js';
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

		const result = await importPicnicRecipe(id, name, locals.user?.username ?? null, t);
		if (!result.ok) return fail(result.status, { message: result.message });
		redirect(303, `/rezepte/${result.recipeId}`);
	},

	// Ein Rezept aus „Alle importieren": Die Seite ruft die Action Rezept für
	// Rezept nacheinander auf (kurze Anfragen, Fortschritt, abbrechbar) statt
	// einer Anfrage, die minutenlang offen bliebe. Bereits vorhandene Namen
	// werden hier noch einmal übersprungen — die Liste im Browser kann veraltet
	// sein, etwa wenn ein anderes Familienmitglied gerade importiert.
	importBulk: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		const name = String(formData.get('name') ?? '').trim();
		if (!id || !name) return fail(400, { message: t('msg.invalidRecipe') });
		if (recipeNameExists(name)) return { skipped: true };

		const result = await importPicnicRecipe(id, name, locals.user?.username ?? null, t);
		if (!result.ok) return fail(result.status, { message: result.message, kind: result.kind ?? null });
		return { imported: true };
	}
};
