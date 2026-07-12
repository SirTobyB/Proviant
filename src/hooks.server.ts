import { redirect, type Handle } from '@sveltejs/kit';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';

// Öffentlich erreichbare Pfade (ohne Login)
const PUBLIC_PATHS = ['/login'];

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = validateSession(token);

	const path = event.url.pathname;
	const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));

	// Nicht eingeloggt → zur Anmeldung (außer auf öffentlichen Pfaden)
	if (!event.locals.user && !isPublic) {
		throw redirect(303, '/login');
	}

	// Userverwaltung ist Admins vorbehalten
	if (path.startsWith('/benutzer') && event.locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	// Bereits eingeloggt und ruft /login auf → weiter zur App
	if (event.locals.user && path === '/login') {
		throw redirect(303, '/');
	}

	return resolve(event);
};
