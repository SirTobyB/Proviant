/**
 * Verwaltung frei vergebbarer Rezept-Tags.
 */
import { db } from '$lib/server/db';
import { recipeTags, tags } from '$lib/server/db/schema';
import { auditLink, auditNew } from '$lib/server/audit';
import { eq, inArray, sql } from 'drizzle-orm';

/** Alle vorhandenen Tag-Namen (für Autocomplete), alphabetisch. */
export function allTagNames(): string[] {
	return db
		.select({ name: tags.name })
		.from(tags)
		.orderBy(sql`${tags.name} collate nocase`)
		.all()
		.map((t) => t.name);
}

/** Tag-Namen eines Rezepts. */
export function tagsForRecipe(recipeId: number): string[] {
	return db
		.select({ name: tags.name })
		.from(recipeTags)
		.innerJoin(tags, eq(tags.id, recipeTags.tagId))
		.where(eq(recipeTags.recipeId, recipeId))
		.orderBy(sql`${tags.name} collate nocase`)
		.all()
		.map((t) => t.name);
}

/** Legt fehlende Tags an und gibt alle Tag-IDs zu den Namen zurück. */
function ensureTagIds(names: string[], user: string | null): number[] {
	const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
	if (clean.length === 0) return [];
	db.insert(tags)
		.values(clean.map((name) => ({ name, ...auditNew(user) })))
		.onConflictDoNothing()
		.run();
	return db
		.select({ id: tags.id })
		.from(tags)
		.where(inArray(tags.name, clean))
		.all()
		.map((t) => t.id);
}

/** Ersetzt die Tags eines Rezepts vollständig durch die übergebenen Namen. */
export function setRecipeTags(recipeId: number, names: string[], user: string | null): void {
	db.delete(recipeTags).where(eq(recipeTags.recipeId, recipeId)).run();
	const tagIds = ensureTagIds(names, user);
	if (tagIds.length > 0) {
		db.insert(recipeTags)
			.values(tagIds.map((tagId) => ({ recipeId, tagId, ...auditLink(user) })))
			.onConflictDoNothing()
			.run();
	}
}
