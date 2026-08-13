import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { hashPassword, verifyPassword } from '$lib/server/password';
import { deleteUserSessions, SESSION_COOKIE, createSession } from '$lib/server/auth';
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

export const load: PageServerLoad = ({ locals }) => {
	// locals.user ist durch den Hook garantiert vorhanden
	return {
		account: locals.user,
		// Herkunft des laufenden Images (im Dockerfile aus Build-Args gesetzt) —
		// zum Abgleich, ob der Server wirklich den erwarteten Stand fährt
		version: { app: appVersion, commit: env.GIT_SHA || null, buildTime: env.BUILD_TIME || null },
		releases
	};
};

export const actions: Actions = {
	changePassword: async ({ request, locals, cookies }) => {
		const username = locals.user!.username;
		const fd = await request.formData();
		const current = String(fd.get('current') ?? '');
		const next = String(fd.get('next') ?? '');
		const confirm = String(fd.get('confirm') ?? '');

		if (next.length < 6) return fail(400, { message: 'Neues Passwort: mindestens 6 Zeichen' });
		if (next !== confirm) return fail(400, { message: 'Die neuen Passwörter stimmen nicht überein' });

		const user = db.select().from(users).where(eq(users.username, username)).get();
		if (!user || !(await verifyPassword(current, user.passwordHash))) {
			return fail(400, { message: 'Aktuelles Passwort ist falsch' });
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
