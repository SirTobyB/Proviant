/**
 * Serverseitiges Drumherum zur Oberflächensprache.
 *
 * Die Sprachlogik selbst steht in `$lib/i18n` (rein und testbar); hier liegt
 * nur, was Cookies und SvelteKit betrifft.
 */
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { Locale } from '$lib/i18n';

/**
 * Gemerkte Sprachwahl. Nötig zusätzlich zur Spalte am Benutzer, weil die
 * Anmeldeseite noch keinen Benutzer kennt — ohne das Cookie erschiene sie in
 * der Systemsprache statt in der zuletzt gewählten.
 *
 * Bewusst **nicht** httpOnly: der Wert ist keine Zugangsinformation, und so
 * kann ihn später auch clientseitiger Code lesen.
 */
export const LOCALE_COOKIE = 'lmk_locale';

const LOCALE_COOKIE_DAYS = 365;

export function setLocaleCookie(cookies: Cookies, locale: Locale): void {
	cookies.set(LOCALE_COOKIE, locale, {
		path: '/',
		httpOnly: false,
		sameSite: 'lax',
		secure: !dev,
		maxAge: LOCALE_COOKIE_DAYS * 86_400
	});
}

/** Nach „Systemsprache folgen": das Cookie muss weg, sonst überstimmt es sie. */
export function clearLocaleCookie(cookies: Cookies): void {
	cookies.delete(LOCALE_COOKIE, { path: '/' });
}
