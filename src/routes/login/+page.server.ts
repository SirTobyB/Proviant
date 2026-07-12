import { authenticate, createSession, SESSION_COOKIE } from '$lib/server/auth';
import { dev } from '$app/environment';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const username = String(formData.get('username') ?? '').trim();
		const password = String(formData.get('password') ?? '');
		if (!username || !password) {
			return fail(400, { username, message: 'Benutzername und Passwort erforderlich' });
		}

		const user = await authenticate(username, password);
		if (!user) {
			return fail(401, { username, message: 'Benutzername oder Passwort falsch' });
		}

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
