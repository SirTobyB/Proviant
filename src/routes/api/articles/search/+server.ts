import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { articles } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/** Sucht im eigenen Artikelstamm (zur Verknüpfung von Rezeptzutaten). */
export const GET: RequestHandler = ({ url }) => {
	const query = url.searchParams.get('q')?.trim() ?? '';
	if (!query) return json({ results: [] });

	const results = db
		.select({
			id: articles.id,
			name: articles.name,
			amount: articles.amount,
			unit: articles.unit,
			picnicId: articles.picnicId,
			imagePath: articles.imagePath
		})
		.from(articles)
		.where(sql`lower(${articles.name}) like ${'%' + query.toLowerCase() + '%'}`)
		.orderBy(sql`${articles.name} collate nocase`)
		.limit(10)
		.all();

	return json({ results });
};
