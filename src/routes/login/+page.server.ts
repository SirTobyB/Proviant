import {
	authenticate,
	clearFailedLogins,
	createSession,
	loginLockMs,
	registerFailedLogin,
	SESSION_COOKIE
} from '$lib/server/auth';
import { remainingLockMinutes } from '$lib/loginThrottle';
import { translator } from '$lib/i18n';
import { logWarn } from '$lib/server/log';
import { dev } from '$app/environment';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		const username = String(formData.get('username') ?? '').trim();
		const password = String(formData.get('password') ?? '');
		if (!username || !password) {
			return fail(400, { username, message: t('msg.credentialsRequired') });
		}

		// Vor dem Prüfen: Eine laufende Sperre soll gar nicht erst zum Vergleich
		// kommen — sonst wäre sie nur eine Meldung und keine Bremse.
		const gesperrt = loginLockMs(username);
		if (gesperrt > 0) {
			return fail(429, { username, message: t('msg.loginLocked', { n: remainingLockMinutes(gesperrt) }) });
		}

		const user = await authenticate(username, password);
		if (!user) {
			const dauer = registerFailedLogin(username);
			if (dauer > 0) {
				// Im Container-Log sichtbar machen, dass jemand durchprobiert
				logWarn('Anmeldung gesperrt nach zu vielen Fehlversuchen', {
					user: username,
					minuten: remainingLockMinutes(dauer)
				});
				return fail(429, { username, message: t('msg.loginLocked', { n: remainingLockMinutes(dauer) }) });
			}
			return fail(401, { username, message: t('msg.credentialsWrong') });
		}

		clearFailedLogins(username);
		const { token, expiresAt } = createSession(user.username);
		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			expires: expiresAt
		});

		redirect(303, '/');
	}
};
