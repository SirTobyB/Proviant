import { db } from '$lib/server/db';
import { articles } from '$lib/server/db/schema';
import { activeLocations } from '$lib/server/locations';
import { parseArticleForm } from '$lib/server/articleForm';
import { allArticleTagNames, setArticleTags } from '$lib/server/articleTags';
import { auditNew } from '$lib/server/audit';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	return {
		locations: activeLocations(),
		allTags: allArticleTagNames(),
		// Vorbefüllte EAN, z.B. vom Barcode-Scanner
		ean: url.searchParams.get('ean') ?? ''
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = locals.user?.username ?? null;
		const { values, imagePath, tags, error } = await parseArticleForm(await request.formData());
		if (error) return fail(400, { message: error });

		let articleId: number;
		try {
			articleId = db
				.insert(articles)
				.values({ ...values, imagePath: imagePath ?? null, ...auditNew(user) })
				.returning({ id: articles.id })
				.get().id;
		} catch (err) {
			if (err instanceof Error && err.message.includes('UNIQUE constraint failed: articles.ean')) {
				return fail(400, { message: `Ein Artikel mit der EAN ${values.ean} existiert bereits` });
			}
			throw err;
		}
		setArticleTags(articleId, tags, user);

		redirect(303, '/artikel');
	}
};
