import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

function createDb() {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

	const client = new Database(env.DATABASE_URL);
	client.pragma('journal_mode = WAL');
	client.pragma('foreign_keys = ON');

	const db = drizzle(client, { schema });

	// Migrationen beim Start anwenden (Ordner ./drizzle liegt neben dem Build im Container)
	migrate(db, { migrationsFolder: env.MIGRATIONS_DIR ?? './drizzle' });

	// Feste Lagerorte einmalig anlegen
	const locations = ['Küchenschrank', 'Kühlschrank', 'Gefrierschrank', 'Vorratsregal'];
	db.insert(schema.storageLocations)
		.values(locations.map((name, i) => ({ name, sortOrder: i })))
		.onConflictDoNothing()
		.run();

	return db;
}

// Während `vite build` importiert SvelteKits Analyse-Schritt dieses Modul,
// ohne dass eine Datenbank existiert — dann darf keine Verbindung aufgebaut werden.
export const db = building ? (undefined as unknown as ReturnType<typeof createDb>) : createDb();
