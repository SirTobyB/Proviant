import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	// locale kommt aus dem Hook und steht damit jeder Seite als data.locale zur
	// Verfügung — Komponenten bilden daraus ihre Übersetzerfunktion.
	return { user: locals.user, locale: locals.locale };
};
