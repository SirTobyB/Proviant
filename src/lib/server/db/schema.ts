import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Wiederverwendbare Audit-Spalten. created_by/updated_by halten den Benutzernamen
// des anlegenden bzw. zuletzt ändernden Users (kein FK, damit gelöschte User
// die Historie nicht kaputtmachen).
const createdAtCol = () =>
	integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`);
const updatedAtCol = () =>
	integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`);
const auditFull = () => ({
	createdAt: createdAtCol(),
	createdBy: text('created_by'),
	updatedAt: updatedAtCol(),
	updatedBy: text('updated_by')
});

/** Benutzer für die Authentifizierung; Benutzername ist der Primärschlüssel. */
export const users = sqliteTable('users', {
	username: text('username').primaryKey(),
	email: text('email').notNull(),
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: ['user', 'admin'] })
		.notNull()
		.default('user'),
	...auditFull()
});

/** Angemeldete Sitzungen (technisch, ohne Audit). */
export const sessions = sqliteTable('sessions', {
	token: text('token').primaryKey(),
	username: text('username')
		.notNull()
		.references(() => users.username, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

/** Lagerorte (Küchenschrank, Kühlschrank, Gefrierschrank, Vorratsregal) */
export const storageLocations = sqliteTable('storage_locations', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	sortOrder: integer('sort_order').notNull().default(0),
	...auditFull()
});

/** Artikelstamm */
export const articles = sqliteTable('articles', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	/** Pfad zum lokal gespeicherten Bild (unter DATA_DIR/images) */
	imagePath: text('image_path'),
	/** Gewicht/Größe des Gebindes, z.B. 500 */
	amount: real('amount'),
	/** Maßeinheit zu amount: g, kg, ml, l, Stück */
	unit: text('unit'),
	ean: text('ean').unique(),
	/** Artikel-ID in Picnic, falls vorhanden */
	picnicId: text('picnic_id'),
	/** Mindestbestand (Anzahl Gebinde); 0 = kein Bestellvorschlag */
	minStock: integer('min_stock').notNull().default(0),
	defaultLocationId: integer('default_location_id').references(() => storageLocations.id),
	...auditFull()
});

/**
 * Bestand als Chargen: gleiche Artikel mit unterschiedlichem MHD oder Lagerort
 * liegen in getrennten Einträgen. Ausbuchen reduziert die älteste Charge (FIFO).
 */
export const stockEntries = sqliteTable('stock_entries', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	articleId: integer('article_id')
		.notNull()
		.references(() => articles.id, { onDelete: 'cascade' }),
	locationId: integer('location_id')
		.notNull()
		.references(() => storageLocations.id),
	/** Anzahl Gebinde in dieser Charge */
	quantity: integer('quantity').notNull().default(1),
	/** MHD als ISO-Datum (YYYY-MM-DD), null = kein MHD erfasst */
	bestBefore: text('best_before'),
	...auditFull()
});

/** Rezepte (warme Mahlzeiten und Kuchen) */
export const recipes = sqliteTable('recipes', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	category: text('category', { enum: ['meal', 'cake'] })
		.notNull()
		.default('meal'),
	servings: integer('servings').notNull().default(4),
	imagePath: text('image_path'),
	instructions: text('instructions'),
	/** Wann zuletzt gekocht/bestellt; steuert die 2-Wochen-Sperre beim Vorschlag */
	lastCookedAt: integer('last_cooked_at', { mode: 'timestamp' }),
	...auditFull()
});

/**
 * Zutaten: bevorzugt Verknüpfung auf den Artikelstamm (siehe recipeIngredientArticles),
 * Freitext (freeText) als Fallback für Frisches ohne Stammdaten.
 */
export const recipeIngredients = sqliteTable('recipe_ingredients', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	recipeId: integer('recipe_id')
		.notNull()
		.references(() => recipes.id, { onDelete: 'cascade' }),
	freeText: text('free_text'),
	/** Benötigte Menge in der Einheit `unit` (nicht Gebinde!) */
	amount: real('amount'),
	unit: text('unit'),
	sortOrder: integer('sort_order').notNull().default(0),
	...auditFull()
});

/**
 * Akzeptierte Alternativartikel je Zutat (z.B. mehrere Eier-Sorten für eine
 * "Eier"-Zutat) — bei der Kochbarkeits-Prüfung wird der Bestand aller
 * verknüpften Artikel zusammengezählt. Link-Tabelle, nur Anlage-Audit.
 */
export const recipeIngredientArticles = sqliteTable(
	'recipe_ingredient_articles',
	{
		recipeIngredientId: integer('recipe_ingredient_id')
			.notNull()
			.references(() => recipeIngredients.id, { onDelete: 'cascade' }),
		articleId: integer('article_id')
			.notNull()
			.references(() => articles.id, { onDelete: 'cascade' }),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: createdAtCol(),
		createdBy: text('created_by')
	},
	(table) => [primaryKey({ columns: [table.recipeIngredientId, table.articleId] })]
);

/** Frei vergebbare Rezept-Tags (z.B. „vegetarisch", „schnell", „deftig"). */
export const tags = sqliteTable('tags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	...auditFull()
});

/** Zuordnung Rezept ↔ Tag (Link-Tabelle, nur Anlage-Audit). */
export const recipeTags = sqliteTable(
	'recipe_tags',
	{
		recipeId: integer('recipe_id')
			.notNull()
			.references(() => recipes.id, { onDelete: 'cascade' }),
		tagId: integer('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' }),
		createdAt: createdAtCol(),
		createdBy: text('created_by')
	},
	(table) => [primaryKey({ columns: [table.recipeId, table.tagId] })]
);

/**
 * Wochenplan: ein Eintrag = ein geplantes Gericht an einem Tag. Künstlicher
 * id-Primärschlüssel statt date als Naturkey, damit später (ohne PK-Umbau)
 * auch mehr als ein Gericht pro Tag möglich wäre. `date` ist bewusst NICHT
 * eindeutig — die Anwendungslogik behandelt aktuell maximal einen Eintrag
 * pro Datum als gültig (siehe mealPlan.ts).
 */
export const mealPlanEntries = sqliteTable('meal_plan_entries', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	/** ISO-Datum (YYYY-MM-DD), wie stockEntries.bestBefore */
	date: text('date').notNull(),
	recipeId: integer('recipe_id')
		.notNull()
		.references(() => recipes.id, { onDelete: 'cascade' }),
	servings: integer('servings').notNull(),
	...auditFull()
});
