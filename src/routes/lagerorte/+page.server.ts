import {
	allLocationsWithStock,
	createLocation,
	moveLocation,
	renameLocation,
	setLocationActive,
	type LocationResult
} from '$lib/server/locations';
import { translator } from '$lib/i18n';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { locations: allLocationsWithStock() };
};

/**
 * Einheitliche Antwort: Fehler als fail(), Erfolg als Meldung für die Seite.
 * Das `ok`-Flag unterscheidet beides in der Oberfläche — bei fail() fehlt es.
 */
function respond(result: LocationResult) {
	return result.ok ? { ok: true, message: result.message } : fail(result.status, { message: result.message });
}

function locationId(formData: FormData): number {
	return Number(formData.get('id'));
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const name = String((await request.formData()).get('name') ?? '').trim();
		return respond(createLocation(name, locals.user?.username ?? null, t));
	},

	rename: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		return respond(renameLocation(locationId(formData), name, locals.user?.username ?? null, t));
	},

	deactivate: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		return respond(setLocationActive(locationId(formData), false, locals.user?.username ?? null, t));
	},

	activate: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		return respond(setLocationActive(locationId(formData), true, locals.user?.username ?? null, t));
	},

	move: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const formData = await request.formData();
		const direction = formData.get('direction') === 'up' ? 'up' : 'down';
		return respond(moveLocation(locationId(formData), direction, locals.user?.username ?? null, t));
	}
};
