import { db } from '$lib/server/db';
import { articles, stockMovements, storageLocations } from '$lib/server/db/schema';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { PageServerLoad } from './$types';

const DEFAULT_LIMIT = 100;

export const load: PageServerLoad = ({ url }) => {
	const articleFilter = Number(url.searchParams.get('artikel')) || null;
	const locationFilter = Number(url.searchParams.get('ort')) || null;
	const userFilter = url.searchParams.get('benutzer')?.trim() || null;
	const typeFilter = url.searchParams.get('typ')?.trim() || null;
	const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || DEFAULT_LIMIT, 1), 1000);

	// Zwei Aliasse: eine Umlagerung nennt Ziel- UND Herkunftsort
	const target = alias(storageLocations, 'target_location');
	const from = alias(storageLocations, 'from_location');

	const conditions: SQL[] = [];
	if (articleFilter) conditions.push(eq(stockMovements.articleId, articleFilter));
	if (userFilter) conditions.push(eq(stockMovements.bookedBy, userFilter));
	if (typeFilter) conditions.push(eq(stockMovements.type, typeFilter as 'in'));
	// Beim Lagerort zählt auch die Herkunft einer Umlagerung
	if (locationFilter) {
		conditions.push(
			sql`(${stockMovements.locationId} = ${locationFilter} or ${stockMovements.fromLocationId} = ${locationFilter})`
		);
	}

	const rows = db
		.select({
			id: stockMovements.id,
			bookedAt: stockMovements.bookedAt,
			bookedBy: stockMovements.bookedBy,
			type: stockMovements.type,
			source: stockMovements.source,
			articleId: stockMovements.articleId,
			articleName: stockMovements.articleName,
			quantity: stockMovements.quantity,
			locationName: target.name,
			fromLocationName: from.name,
			bestBefore: stockMovements.bestBefore
		})
		.from(stockMovements)
		.leftJoin(target, eq(target.id, stockMovements.locationId))
		.leftJoin(from, eq(from.id, stockMovements.fromLocationId))
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		// bookedAt hat Sekundenauflösung — die id entscheidet bei Gleichstand
		.orderBy(desc(stockMovements.bookedAt), desc(stockMovements.id))
		.limit(limit + 1)
		.all();

	// Eine Zeile über das Limit hinaus verrät, ob es noch mehr gibt
	const hasMore = rows.length > limit;

	return {
		movements: rows.slice(0, limit),
		hasMore,
		limit,
		filters: { article: articleFilter, location: locationFilter, user: userFilter, type: typeFilter },
		// Auswahllisten: nur Werte, die im Journal auch vorkommen
		articleOptions: db
			.selectDistinct({ id: stockMovements.articleId, name: stockMovements.articleName })
			.from(stockMovements)
			.orderBy(sql`${stockMovements.articleName} collate nocase`)
			.all()
			.filter((a): a is { id: number; name: string } => a.id != null),
		locationOptions: db
			.select({ id: storageLocations.id, name: storageLocations.name })
			.from(storageLocations)
			.orderBy(storageLocations.sortOrder)
			.all(),
		userOptions: db
			.selectDistinct({ name: stockMovements.bookedBy })
			.from(stockMovements)
			.orderBy(sql`${stockMovements.bookedBy} collate nocase`)
			.all()
			.map((u) => u.name)
			.filter((name): name is string => Boolean(name))
	};
};
