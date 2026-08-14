import { redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { logError, logInfo } from '$lib/server/log';

// Öffentlich erreichbare Pfade (ohne Login)
const PUBLIC_PATHS = ['/login'];

// Einmal beim Start: macht im Container-Log sichtbar, wann die App hochkam und
// welcher Stand läuft — ein stiller Neustart fällt damit sofort auf.
logInfo('LebensmittelKumpel gestartet', {
	commit: env.GIT_SHA?.slice(0, 7) || 'unbekannt',
	build: env.BUILD_TIME || 'lokal'
});

// Fehler außerhalb eines Requests würden sonst wortlos den Prozess beenden.
// Node beendet in beiden Fällen selbst — wir loggen nur vorher und behalten
// das Verhalten bei (Docker startet den Container danach neu).
process.on('uncaughtException', (error) => {
	logError('Unbehandelte Ausnahme — Prozess wird beendet', error);
	process.exit(1);
});
process.on('unhandledRejection', (reason) => {
	logError('Unbehandelte Promise-Ablehnung — Prozess wird beendet', reason);
	process.exit(1);
});

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = validateSession(token);

	const path = event.url.pathname;
	const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));

	// Nicht eingeloggt → zur Anmeldung (außer auf öffentlichen Pfaden)
	if (!event.locals.user && !isPublic) {
		throw redirect(303, '/login');
	}

	// Stammdaten-Verwaltung (Benutzer, Lagerorte) ist Admins vorbehalten
	const adminOnly = ['/benutzer', '/lagerorte'];
	if (adminOnly.some((p) => path.startsWith(p)) && event.locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	// Bereits eingeloggt und ruft /login auf → weiter zur App
	if (event.locals.user && path === '/login') {
		throw redirect(303, '/');
	}

	const startedAt = Date.now();
	const response = await resolve(event);

	// Am Status statt am Fehlerobjekt hängen: So landet JEDE Fehlerantwort im
	// Log — auch die per error() geworfenen, die handleError nie zu sehen
	// bekommt (SvelteKit behandelt sie als „erwartet").
	if (response.status >= 500) {
		logError(`${event.request.method} ${path} → ${response.status}`, undefined, {
			user: event.locals.user?.username,
			ms: Date.now() - startedAt
		});
	}

	return response;
};

/**
 * Greift nur bei unerwarteten Ausnahmen — dort steckt der Stacktrace, der die
 * Ursache verrät. Die Kennung erscheint auch auf der Fehlerseite, damit sich
 * eine Meldung des Nutzers eindeutig im Log wiederfinden lässt.
 */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const id = Math.random().toString(36).slice(2, 8);
	logError(`${event.request.method} ${event.url.pathname} → ${status} (${id})`, error, {
		user: event.locals.user?.username
	});
	return { message: `${message} (Fehler-ID ${id})` };
};
