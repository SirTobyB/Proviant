// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionUser } from '$lib/server/auth';
import type { Locale } from '$lib/i18n';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: SessionUser | null;
			/** Sprache dieser Anfrage — vom Hook gesetzt, nie global gehalten. */
			locale: Locale;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
