import { translator } from '#lib/i18n/index.js';
import { describePicnicError, getConnectionState, getRecentDeliveries } from '#lib/server/picnic/index.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const connection = getConnectionState();
	if (connection !== 'connected') {
		return { connection, deliveries: [], error: null };
	}
	try {
		return { connection, deliveries: await getRecentDeliveries(8), error: null };
	} catch (err) {
		return {
			connection,
			deliveries: [],
			error: describePicnicError(err, translator(locals.locale), 'Lieferungsliste')
		};
	}
};
