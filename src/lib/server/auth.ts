/**
 * Sessions und Benutzer-Nachschlagen für die Authentifizierung.
 */
import { randomBytes } from 'node:crypto';
import { db } from '$lib/server/db';
import { sessions, users } from '$lib/server/db/schema';
import { verifyPassword } from '$lib/server/password';
import { and, eq, gt } from 'drizzle-orm';

export const SESSION_COOKIE = 'lmk_session';
const SESSION_DAYS = 30;

export type SessionUser = {
	username: string;
	email: string;
	role: 'user' | 'admin';
	/** Gewählte Oberflächensprache; null = der Systemsprache folgen. */
	locale: 'en' | 'de' | 'nl' | null;
};

/** Prüft Zugangsdaten und liefert den User bei Erfolg. */
export async function authenticate(username: string, password: string): Promise<SessionUser | null> {
	const user = db.select().from(users).where(eq(users.username, username)).get();
	if (!user) return null;
	if (!(await verifyPassword(password, user.passwordHash))) return null;
	return { username: user.username, email: user.email, role: user.role, locale: user.locale };
}

/** Legt eine Session an und gibt das Cookie-Token samt Ablauf zurück. */
export function createSession(username: string): { token: string; expiresAt: Date } {
	const token = randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
	db.insert(sessions).values({ token, username, expiresAt }).run();
	return { token, expiresAt };
}

/** Löst ein Session-Token zum aktuellen User auf (null wenn ungültig/abgelaufen). */
export function validateSession(token: string | undefined): SessionUser | null {
	if (!token) return null;
	const row = db
		.select({
			username: users.username,
			email: users.email,
			role: users.role,
			locale: users.locale
		})
		.from(sessions)
		.innerJoin(users, eq(users.username, sessions.username))
		.where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
		.get();
	return row ?? null;
}

export function deleteSession(token: string | undefined): void {
	if (token) db.delete(sessions).where(eq(sessions.token, token)).run();
}

/** Entfernt alle Sessions eines Users (z.B. nach Passwortänderung). */
export function deleteUserSessions(username: string): void {
	db.delete(sessions).where(eq(sessions.username, username)).run();
}
