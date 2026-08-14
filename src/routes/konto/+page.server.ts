import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { hashPassword, verifyPassword } from '$lib/server/password';
import { deleteUserSessions, SESSION_COOKIE, createSession } from '$lib/server/auth';
import { clearLocaleCookie, setLocaleCookie } from '$lib/server/locale';
import { isLocale, localeFromHeader, translator, DEFAULT_LOCALE } from '$lib/i18n';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { parseChangelog } from '$lib/changelog';
// Als Text ins Bundle: Das Docker-Image enthält nur build/, die Datei selbst
// liegt dort nicht — ein Lesen zur Laufzeit würde im Betrieb scheitern.
import changelogText from '../../../CHANGELOG.md?raw';
import { version as appVersion } from '../../../package.json';
import type { Actions, PageServerLoad } from './$types';

const releases = parseChangelog(changelogText);

export const load: PageServerLoad = ({ locals, request }) => {
	// locals.user ist durch den Hook garantiert vorhanden
	return {
		account: locals.user,
		// Für die Auswahl „Systemsprache (…)": zeigt, worauf der Browser
		// derzeit hinausliefe — sonst wählt man blind
		systemLocale: localeFromHeader(request.headers.get('accept-language')) ?? DEFAULT_LOCALE,
		// Herkunft des laufenden Images (im Dockerfile aus Build-Args gesetzt) —
		// zum Abgleich, ob der Server wirklich den erwarteten Stand fährt
		version: { app: appVersion, commit: env.GIT_SHA || null, buildTime: env.BUILD_TIME || null },
		releases
	};
};

export const actions: Actions = {
	/**
	 * Sprache umstellen. Leerer Wert = „Systemsprache folgen": dann muss auch
	 * das Cookie weg, sonst überstimmt es die Systemsprache weiterhin.
	 */
	setLanguage: async ({ request, locals, cookies }) => {
		const username = locals.user!.username;
		const gewaehlt = String((await request.formData()).get('locale') ?? '');
		// Meldung in der Sprache, die *danach* gilt — bei „Systemsprache" ist das
		// nicht die bisherige, sondern die des Browsers (Benutzerwahl und Cookie
		// fallen gleich weg)
		const zielsprache = isLocale(gewaehlt)
			? gewaehlt
			: (localeFromHeader(request.headers.get('accept-language')) ?? DEFAULT_LOCALE);
		const t = translator(zielsprache);

		// Eigener Schlüssel statt `message`: die Passwort-Karte zeigt `message`
		// als Fehler an, hier wäre eine Erfolgsmeldung sonst rot und am
		// falschen Platz
		if (gewaehlt !== '' && !isLocale(gewaehlt)) {
			return fail(400, { languageMessage: t('account.language.invalid'), languageOk: false });
		}

		db.update(users)
			.set({
				locale: isLocale(gewaehlt) ? gewaehlt : null,
				updatedAt: new Date(),
				updatedBy: username
			})
			.where(eq(users.username, username))
			.run();

		if (isLocale(gewaehlt)) setLocaleCookie(cookies, gewaehlt);
		else clearLocaleCookie(cookies);

		return { languageMessage: t('account.language.saved'), languageOk: true };
	},

	changePassword: async ({ request, locals, cookies }) => {
		const t = translator(locals.locale);
		const username = locals.user!.username;
		const fd = await request.formData();
		const current = String(fd.get('current') ?? '');
		const next = String(fd.get('next') ?? '');
		const confirm = String(fd.get('confirm') ?? '');

		if (next.length < 6) return fail(400, { message: t('msg.newPasswordShort') });
		if (next !== confirm) return fail(400, { message: t('msg.passwordsDiffer') });

		const user = db.select().from(users).where(eq(users.username, username)).get();
		if (!user || !(await verifyPassword(current, user.passwordHash))) {
			return fail(400, { message: t('msg.currentPasswordWrong') });
		}

		db.update(users)
			.set({ passwordHash: await hashPassword(next), updatedAt: new Date(), updatedBy: username })
			.where(eq(users.username, username))
			.run();

		// Andere Sessions beenden, aktuelle Sitzung erneuern
		deleteUserSessions(username);
		const { token, expiresAt } = createSession(username);
		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			expires: expiresAt
		});
		return { changed: true };
	}
};
