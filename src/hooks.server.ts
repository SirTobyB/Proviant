import { redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { LOCALE_COOKIE } from '$lib/server/locale';
import { resolveLocale } from '$lib/i18n';
import { logError, logInfo } from '$lib/server/log';

// Öffentlich erreichbare Pfade (ohne Login)
const PUBLIC_PATHS = ['/login'];

// Einmal beim Start: macht im Container-Log sichtbar, wann die App hochkam und
// welcher Stand läuft — ein stiller Neustart fällt damit sofort auf.
logInfo('Proviant gestartet', {
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

	// Sprache serverseitig bestimmen, nicht im Browser: sonst rendert die Seite
	// erst in der Standardsprache und springt danach um (sichtbares Flackern
	// plus Hydration-Abweichung).
	event.locals.locale = resolveLocale({
		user: event.locals.user?.locale,
		cookie: event.cookies.get(LOCALE_COOKIE),
		acceptLanguage: event.request.headers.get('accept-language')
	});

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
	// lang im HTML mitziehen — Screenreader und die Übersetzungsvorschläge des
	// Browsers richten sich danach; app.html trägt nur den Platzhalterwert.
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('<html lang="en">', `<html lang="${event.locals.locale}">`)
	});

	// Schutzheader für jede Antwort. Die Content-Security-Policy selbst steht
	// nicht hier, sondern in vite.config.ts (`kit.csp`) — nur so bekommen die
	// von SvelteKit erzeugten Inline-Scripte ihren Nonce.
	response.headers.set('X-Content-Type-Options', 'nosniff');
	// Bei Klick auf einen fremden Link nur die Herkunft mitgeben, nie den Pfad:
	// der trägt hier Artikel- und Rezept-IDs.
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	// frame-ancestors in der CSP deckt dasselbe ab; das hier ist für Browser,
	// die es nicht auswerten.
	response.headers.set('X-Frame-Options', 'DENY');
	// Nur wenn die Anfrage wirklich über TLS kam — sonst würde ein Zugriff über
	// http:// im Heimnetz dauerhaft auf https:// festgenagelt.
	if (event.url.protocol === 'https:') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

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
