import { db } from '$lib/server/db';
import { translator } from '$lib/i18n';
import { users } from '$lib/server/db/schema';
import { hashPassword } from '$lib/server/password';
import { auditNew } from '$lib/server/audit';
import { deleteUserSessions } from '$lib/server/auth';
import { eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const load: PageServerLoad = () => {
	return {
		users: db
			.select({
				username: users.username,
				email: users.email,
				role: users.role,
				createdAt: users.createdAt,
				createdBy: users.createdBy
			})
			.from(users)
			.orderBy(sql`${users.username} collate nocase`)
			.all()
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const fd = await request.formData();
		const username = String(fd.get('username') ?? '').trim();
		const email = String(fd.get('email') ?? '').trim();
		const password = String(fd.get('password') ?? '');
		const role = fd.get('role') === 'admin' ? 'admin' : 'user';

		if (!USERNAME_RE.test(username)) {
			return fail(400, { message: t('msg.usernameRules') });
		}
		if (!EMAIL_RE.test(email)) return fail(400, { message: t('msg.invalidEmail') });
		if (password.length < 6) return fail(400, { message: t('msg.passwordShort') });
		if (db.select().from(users).where(eq(users.username, username)).get()) {
			return fail(400, { message: t('msg.userExists', { name: username }) });
		}

		db.insert(users)
			.values({
				username,
				email,
				passwordHash: await hashPassword(password),
				role,
				...auditNew(locals.user?.username)
			})
			.run();
		return { created: username };
	},

	update: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const fd = await request.formData();
		const username = String(fd.get('username') ?? '').trim();
		const email = String(fd.get('email') ?? '').trim();
		const role = fd.get('role') === 'admin' ? 'admin' : 'user';
		const newPassword = String(fd.get('password') ?? '');

		const target = db.select().from(users).where(eq(users.username, username)).get();
		if (!target) return fail(404, { message: t('msg.userNotFound') });
		if (!EMAIL_RE.test(email)) return fail(400, { message: t('msg.invalidEmail') });
		// Sich selbst nicht die Admin-Rolle entziehen (sonst kein Admin mehr erreichbar)
		if (username === locals.user?.username && role !== 'admin') {
			return fail(400, { message: t('msg.cannotRemoveOwnAdmin') });
		}
		if (newPassword && newPassword.length < 6) {
			return fail(400, { message: t('msg.passwordShort') });
		}

		db.update(users)
			.set({
				email,
				role,
				updatedAt: new Date(),
				updatedBy: locals.user?.username ?? null,
				...(newPassword ? { passwordHash: await hashPassword(newPassword) } : {})
			})
			.where(eq(users.username, username))
			.run();
		// Nach Passwort-Reset alle Sessions des Users beenden
		if (newPassword) deleteUserSessions(username);
		return { updated: username };
	},

	delete: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const username = String((await request.formData()).get('username') ?? '').trim();
		if (username === locals.user?.username) {
			return fail(400, { message: t('msg.cannotDeleteSelf') });
		}
		const [count] = db.select({ n: sql<number>`count(*)` }).from(users).all();
		if (count.n <= 1) return fail(400, { message: t('msg.lastUser') });
		db.delete(users).where(eq(users.username, username)).run();
		return { deleted: username };
	}
};
