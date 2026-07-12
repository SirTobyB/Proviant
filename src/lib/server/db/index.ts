import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { scryptSync, randomBytes } from 'node:crypto';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

type Db = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Legt beim allerersten Start (keine User vorhanden) einen Admin aus
 * ADMIN_USERNAME/ADMIN_PASSWORD an. Ohne gesetzte Variablen passiert nichts —
 * dann muss der Admin manuell in der DB angelegt werden.
 */
function seedAdmin(db: Db): void {
	const [count] = db.select({ n: sql<number>`count(*)` }).from(schema.users).all();
	if (count.n > 0) return;
	if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
		console.warn(
			'[auth] Keine Benutzer vorhanden und ADMIN_USERNAME/ADMIN_PASSWORD nicht gesetzt — es wurde kein Admin angelegt.'
		);
		return;
	}
	// scrypt synchron beim Start (einmalig) — identisches Format wie password.ts
	const salt = randomBytes(16);
	const hash = scryptSync(env.ADMIN_PASSWORD, salt, 64);
	const passwordHash = `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
	db.insert(schema.users)
		.values({
			username: env.ADMIN_USERNAME,
			email: env.ADMIN_EMAIL ?? '',
			passwordHash,
			role: 'admin',
			createdBy: 'system',
			updatedBy: 'system'
		})
		.run();
	console.info(`[auth] Admin-Benutzer "${env.ADMIN_USERNAME}" angelegt.`);
}

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

	seedAdmin(db);

	return db;
}

// Während `vite build` importiert SvelteKits Analyse-Schritt dieses Modul,
// ohne dass eine Datenbank existiert — dann darf keine Verbindung aufgebaut werden.
export const db = building ? (undefined as unknown as ReturnType<typeof createDb>) : createDb();
