import { getConnectionState, getRecentDeliveries } from '$lib/server/picnic';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
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
			error: err instanceof Error ? err.message : 'Lieferungen konnten nicht geladen werden'
		};
	}
};
