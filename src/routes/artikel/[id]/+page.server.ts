import { db } from '$lib/server/db';
import { articles, storageLocations } from '$lib/server/db/schema';
import { parseArticleForm } from '$lib/server/articleForm';
import { deleteImage } from '$lib/server/images';
import { eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function getArticle(id: string) {
	const articleId = Number(id);
	if (!Number.isInteger(articleId)) throw error(404, 'Artikel nicht gefunden');
	const article = db.select().from(articles).where(eq(articles.id, articleId)).get();
	if (!article) throw error(404, 'Artikel nicht gefunden');
	return article;
}

export const load: PageServerLoad = ({ params }) => {
	return {
		article: getArticle(params.id),
		locations: db.select().from(storageLocations).orderBy(storageLocations.sortOrder).all()
	};
};

export const actions: Actions = {
	update: async ({ params, request }) => {
		const article = getArticle(params.id);
		const { values, imagePath, error: message } = await parseArticleForm(await request.formData());
		if (message) return fail(400, { message });

		try {
			db.update(articles)
				.set({
					...values,
					...(imagePath !== undefined ? { imagePath } : {}),
					updatedAt: new Date()
				})
				.where(eq(articles.id, article.id))
				.run();
		} catch (err) {
			if (err instanceof Error && err.message.includes('UNIQUE constraint failed: articles.ean')) {
				return fail(400, { message: `Ein Artikel mit der EAN ${values.ean} existiert bereits` });
			}
			throw err;
		}

		// Altes Bild erst nach erfolgreichem Update entfernen
		if (imagePath !== undefined && article.imagePath) deleteImage(article.imagePath);

		redirect(303, '/artikel');
	},

	delete: ({ params }) => {
		const article = getArticle(params.id);
		db.delete(articles).where(eq(articles.id, article.id)).run();
		deleteImage(article.imagePath);
		redirect(303, '/artikel');
	}
};
