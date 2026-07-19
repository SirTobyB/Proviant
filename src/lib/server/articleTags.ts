/**
 * Verwaltung frei vergebbarer Artikel-Tags (eigener Pool, getrennt von den
 * Rezept-Tags in tags.ts — gleiches Muster, andere Tabellen).
 */
import { db } from '$lib/server/db';
import { articleTagLinks, articleTags } from '$lib/server/db/schema';
import { auditLink, auditNew } from '$lib/server/audit';
import { eq, inArray, sql } from 'drizzle-orm';

/** Alle vorhandenen Artikel-Tag-Namen (für Autocomplete), alphabetisch. */
export function allArticleTagNames(): string[] {
	return db
		.select({ name: articleTags.name })
		.from(articleTags)
		.orderBy(sql`${articleTags.name} collate nocase`)
		.all()
		.map((t) => t.name);
}

/** Tag-Namen eines Artikels. */
export function tagsForArticle(articleId: number): string[] {
	return db
		.select({ name: articleTags.name })
		.from(articleTagLinks)
		.innerJoin(articleTags, eq(articleTags.id, articleTagLinks.tagId))
		.where(eq(articleTagLinks.articleId, articleId))
		.orderBy(sql`${articleTags.name} collate nocase`)
		.all()
		.map((t) => t.name);
}

/**
 * Tag-Namen mehrerer Artikel in einer Query (für Listenseiten — der
 * Artikelkatalog kann hunderte Einträge haben, kein N+1).
 */
export function tagsForArticles(articleIds: number[]): Map<number, string[]> {
	const result = new Map<number, string[]>();
	if (articleIds.length === 0) return result;
	const rows = db
		.select({ articleId: articleTagLinks.articleId, name: articleTags.name })
		.from(articleTagLinks)
		.innerJoin(articleTags, eq(articleTags.id, articleTagLinks.tagId))
		.where(inArray(articleTagLinks.articleId, articleIds))
		.orderBy(sql`${articleTags.name} collate nocase`)
		.all();
	for (const row of rows) {
		const list = result.get(row.articleId) ?? [];
		list.push(row.name);
		result.set(row.articleId, list);
	}
	return result;
}

/** Legt fehlende Tags an und gibt alle Tag-IDs zu den Namen zurück. */
function ensureTagIds(names: string[], user: string | null): number[] {
	const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
	if (clean.length === 0) return [];
	db.insert(articleTags)
		.values(clean.map((name) => ({ name, ...auditNew(user) })))
		.onConflictDoNothing()
		.run();
	return db
		.select({ id: articleTags.id })
		.from(articleTags)
		.where(inArray(articleTags.name, clean))
		.all()
		.map((t) => t.id);
}

/** Ersetzt die Tags eines Artikels vollständig durch die übergebenen Namen. */
export function setArticleTags(articleId: number, names: string[], user: string | null): void {
	db.delete(articleTagLinks).where(eq(articleTagLinks.articleId, articleId)).run();
	const tagIds = ensureTagIds(names, user);
	if (tagIds.length > 0) {
		db.insert(articleTagLinks)
			.values(tagIds.map((tagId) => ({ articleId, tagId, ...auditLink(user) })))
			.onConflictDoNothing()
			.run();
	}
}
