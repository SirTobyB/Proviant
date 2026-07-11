import { db } from '$lib/server/db';
import { recipes } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const category = url.searchParams.get('kategorie');
	const rows = db
		.select({
			id: recipes.id,
			name: recipes.name,
			category: recipes.category,
			servings: recipes.servings,
			imagePath: recipes.imagePath
		})
		.from(recipes)
		.where(category === 'meal' || category === 'cake' ? sql`${recipes.category} = ${category}` : undefined)
		.orderBy(sql`${recipes.name} collate nocase`)
		.all();

	return { recipes: rows, category };
};
