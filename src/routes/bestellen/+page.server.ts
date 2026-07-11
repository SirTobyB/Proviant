import { db } from '$lib/server/db';
import { articles, stockEntries } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import {
	getConnectionState,
	login,
	request2FACode,
	verify2FA,
	addToCart
} from '$lib/server/picnic';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/** Artikel unter Mindestbestand mit Fehlmenge (minStock - Bestand). */
function loadSuggestions() {
	const rows = db
		.select({
			id: articles.id,
			name: articles.name,
			imagePath: articles.imagePath,
			amount: articles.amount,
			unit: articles.unit,
			picnicId: articles.picnicId,
			minStock: articles.minStock,
			stock: sql<number>`coalesce(sum(${stockEntries.quantity}), 0)`
		})
		.from(articles)
		.leftJoin(stockEntries, eq(stockEntries.articleId, articles.id))
		.where(sql`${articles.minStock} > 0`)
		.groupBy(articles.id)
		.orderBy(articles.name)
		.all();

	return rows
		.filter((row) => row.stock < row.minStock)
		.map((row) => ({ ...row, needed: row.minStock - row.stock }));
}

export const load: PageServerLoad = () => {
	return {
		suggestions: loadSuggestions(),
		connection: getConnectionState()
	};
};

export const actions: Actions = {
	// Picnic-Verbindung herstellen (env-Credentials)
	connect: async () => {
		try {
			const { needs2FA } = await login();
			return { connection: getConnectionState(), needs2FA };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Login fehlgeschlagen' });
		}
	},

	send2FACode: async () => {
		try {
			await request2FACode();
			return { codeSent: true };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'SMS-Versand fehlgeschlagen' });
		}
	},

	verify2FA: async ({ request }) => {
		const code = String((await request.formData()).get('code') ?? '').trim();
		if (!code) return fail(400, { message: 'Bitte den Code eingeben' });
		try {
			await verify2FA(code);
			return { connection: getConnectionState() };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : '2FA-Prüfung fehlgeschlagen' });
		}
	},

	// Ausgewählte Vorschläge in den Picnic-Warenkorb legen
	addToCart: async ({ request }) => {
		const formData = await request.formData();
		const suggestions = loadSuggestions();
		const byId = new Map(suggestions.map((s) => [String(s.id), s]));

		const items: { productId: string; quantity: number }[] = [];
		const skipped: string[] = [];
		for (const id of formData.getAll('selected')) {
			const suggestion = byId.get(String(id));
			if (!suggestion) continue;
			const quantity = Number(formData.get(`quantity_${id}`));
			if (!Number.isInteger(quantity) || quantity < 1) continue;
			if (!suggestion.picnicId) {
				skipped.push(suggestion.name);
				continue;
			}
			items.push({ productId: suggestion.picnicId, quantity });
		}

		if (items.length === 0) {
			return fail(400, {
				message:
					skipped.length > 0
						? `Keine Picnic-Verknüpfung bei: ${skipped.join(', ')}`
						: 'Nichts ausgewählt'
			});
		}

		try {
			await addToCart(items);
		} catch (err) {
			return fail(502, { message: err instanceof Error ? err.message : 'Warenkorb-Übergabe fehlgeschlagen' });
		}

		return {
			added: items.length,
			totalUnits: items.reduce((sum, item) => sum + item.quantity, 0),
			skipped
		};
	}
};
