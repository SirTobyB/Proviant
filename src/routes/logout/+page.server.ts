import { deleteSession, SESSION_COOKIE } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// GET auf /logout einfach zurück zur App
export const load: PageServerLoad = () => {
	redirect(303, '/');
};

export const actions: Actions = {
	default: ({ cookies }) => {
		deleteSession(cookies.get(SESSION_COOKIE));
		cookies.delete(SESSION_COOKIE, { path: '/' });
		redirect(303, '/login');
	}
};
