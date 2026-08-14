/**
 * Sessions und Benutzer-Nachschlagen für die Authentifizierung.
 */
import { randomBytes } from 'node:crypto';
import { db } from '$lib/server/db';
import { loginAttempts, sessions, users } from '$lib/server/db/schema';
import { hashPassword, verifyPassword } from '$lib/server/password';
import { RESET_AFTER_MS, isStale, lockoutMs, remainingLockMs } from '$lib/loginThrottle';
import { and, eq, gt, lt } from 'drizzle-orm';

export const SESSION_COOKIE = 'lmk_session';
const SESSION_DAYS = 30;

export type SessionUser = {
	username: string;
	email: string;
	role: 'user' | 'admin';
	/** Gewählte Oberflächensprache; null = der Systemsprache folgen. */
	locale: 'en' | 'de' | 'nl' | null;
};

/**
 * Vergleichs-Hash für nicht existierende Benutzer. Ohne ihn käme die Antwort
 * bei unbekanntem Namen sofort, bei bekanntem erst nach dem scrypt-Durchlauf —
 * an diesem Unterschied ließe sich ablesen, welche Benutzer es gibt. Einmal
 * beim Start erzeugt, der Inhalt spielt keine Rolle.
 */
const dummyHashPromise = hashPassword(randomBytes(32).toString('hex'));

/** Prüft Zugangsdaten und liefert den User bei Erfolg. */
export async function authenticate(username: string, password: string): Promise<SessionUser | null> {
	const user = db.select().from(users).where(eq(users.username, username)).get();
	if (!user) {
		await verifyPassword(password, await dummyHashPromise);
		return null;
	}
	if (!(await verifyPassword(password, user.passwordHash))) return null;
	return { username: user.username, email: user.email, role: user.role, locale: user.locale };
}

/**
 * Verbleibende Sperrzeit für einen Benutzernamen in Millisekunden (0 = frei).
 *
 * Gilt für **jeden** eingegebenen Namen, auch einen unbekannten — siehe die
 * Begründung am Schema von `login_attempts`.
 */
export function loginLockMs(username: string, now = new Date()): number {
	const row = db.select().from(loginAttempts).where(eq(loginAttempts.username, username)).get();
	if (!row) return 0;
	// Eine abgelaufene Zählung sperrt nicht mehr, auch wenn die Zeile noch steht
	if (isStale(row.lastFailedAt, now)) return 0;
	return remainingLockMs(row.lockedUntil, now);
}

/**
 * Vermerkt einen Fehlversuch und sperrt, sobald die Schwelle erreicht ist.
 * Gibt die neue Sperrdauer zurück (0, solange nicht gesperrt).
 */
export function registerFailedLogin(username: string, now = new Date()): number {
	const row = db.select().from(loginAttempts).where(eq(loginAttempts.username, username)).get();
	// Nach langer Ruhe von vorn zählen, statt an eine alte Serie anzuknüpfen
	const bisher = row && !isStale(row.lastFailedAt, now) ? row.failedCount : 0;
	const failedCount = bisher + 1;
	const dauer = lockoutMs(failedCount);
	const lockedUntil = dauer > 0 ? new Date(now.getTime() + dauer) : null;

	db.insert(loginAttempts)
		.values({ username, failedCount, lockedUntil, lastFailedAt: now })
		.onConflictDoUpdate({
			target: loginAttempts.username,
			set: { failedCount, lockedUntil, lastFailedAt: now }
		})
		.run();

	// Bei jedem Fehlversuch die verfallenen Zeilen mitnehmen: Sonst wüchse die
	// Tabelle mit jedem erfundenen Benutzernamen, den jemand durchprobiert.
	db.delete(loginAttempts)
		.where(lt(loginAttempts.lastFailedAt, new Date(now.getTime() - RESET_AFTER_MS)))
		.run();

	return dauer;
}

/** Nach erfolgreicher Anmeldung: Zählung verwerfen. */
export function clearFailedLogins(username: string): void {
	db.delete(loginAttempts).where(eq(loginAttempts.username, username)).run();
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
