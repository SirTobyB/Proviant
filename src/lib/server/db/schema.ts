import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/** Lagerorte (Küchenschrank, Kühlschrank, Gefrierschrank, Vorratsregal) */
export const storageLocations = sqliteTable('storage_locations', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	sortOrder: integer('sort_order').notNull().default(0)
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
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
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
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
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
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

/**
 * Zutaten: bevorzugt Verknüpfung auf den Artikelstamm (articleId),
 * Freitext (freeText) als Fallback für Frisches ohne Stammdaten.
 */
export const recipeIngredients = sqliteTable('recipe_ingredients', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	recipeId: integer('recipe_id')
		.notNull()
		.references(() => recipes.id, { onDelete: 'cascade' }),
	articleId: integer('article_id').references(() => articles.id, { onDelete: 'set null' }),
	freeText: text('free_text'),
	/** Benötigte Menge in der Einheit `unit` (nicht Gebinde!) */
	amount: real('amount'),
	unit: text('unit'),
	sortOrder: integer('sort_order').notNull().default(0)
});
