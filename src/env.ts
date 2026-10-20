import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Umgebungsvariablen der App (SvelteKit 3: `$app/env/private` statt
 * `$env/dynamic/private`). Alle werden beim Start gelesen, nicht beim Build
 * eingebacken — das Docker-Image setzt sie erst zur Laufzeit.
 *
 * Bewusst alle optional und unverändert durchgereicht (`undefined`, wenn nicht
 * gesetzt): Der Code fällt an mehreren Stellen per `??` auf einen Standard
 * zurück (`DATA_DIR ?? '.'`, `MIGRATIONS_DIR ?? './drizzle'`). Ein leerer
 * String als Ersatzwert ließe diese Rückfälle ins Leere laufen.
 */
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	DATABASE_URL: { schema: optional, description: 'Pfad zur SQLite-Datei' },
	MIGRATIONS_DIR: { schema: optional, description: 'Ordner der Drizzle-Migrationen (Standard ./drizzle)' },
	DATA_DIR: { schema: optional, description: 'Datenordner für Bilder und den Picnic-Auth-Key (Standard .)' },
	ADMIN_USERNAME: { schema: optional, description: 'Erster Admin, solange kein Benutzer existiert' },
	ADMIN_PASSWORD: { schema: optional, description: 'Passwort des ersten Admins' },
	ADMIN_EMAIL: { schema: optional, description: 'E-Mail des ersten Admins' },
	PICNIC_USERNAME: { schema: optional, description: 'Picnic-Zugang' },
	PICNIC_PASSWORD: { schema: optional, description: 'Picnic-Passwort' },
	GIT_SHA: { schema: optional, description: 'Commit des Images (Build-Arg)' },
	BUILD_TIME: { schema: optional, description: 'Bauzeitpunkt des Images (Build-Arg)' }
});
