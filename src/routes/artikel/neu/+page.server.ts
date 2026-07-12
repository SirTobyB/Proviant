import { db } from '$lib/server/db';
import { articles, storageLocations } from '$lib/server/db/schema';
import { parseArticleForm } from '$lib/server/articleForm';
import { auditNew } from '$lib/server/audit';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	return {
		locations: db.select().from(storageLocations).orderBy(storageLocations.sortOrder).all(),
		// Vorbefüllte EAN, z.B. vom Barcode-Scanner
		ean: url.searchParams.get('ean') ?? ''
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const { values, imagePath, error } = await parseArticleForm(await request.formData());
		if (error) return fail(400, { message: error });

		try {
			db.insert(articles)
				.values({ ...values, imagePath: imagePath ?? null, ...auditNew(locals.user?.username) })
				.run();
		} catch (err) {
			if (err instanceof Error && err.message.includes('UNIQUE constraint failed: articles.ean')) {
				return fail(400, { message: `Ein Artikel mit der EAN ${values.ean} existiert bereits` });
			}
			throw err;
		}

		redirect(303, '/artikel');
	}
};
