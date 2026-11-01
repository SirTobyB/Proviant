import { db } from '#lib/server/db/index.js';
import { translator } from '#lib/i18n/index.js';
import { articles, stockEntries } from '#lib/server/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import {
	getConnectionState,
	getCartQuantities,
	getCartView,
	getDeliveryEta,
	getOpenOrderQuantities,
	getReplacements,
	type CartReplacement,
	type CartView,
	login,
	request2FACode,
	verify2FA,
	addToCart,
	describePicnicError
} from '#lib/server/picnic/index.js';
import { pricesFor, refreshPrices } from '#lib/server/prices.js';
import { changeCartQuantity, removeCartLine, swapCartLine, type CartActionResult } from '#lib/server/cartActions.js';
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

/** Höchstens so viele nicht lieferbare Zeilen bekommen Ersatzvorschläge. */
const MAX_REPLACEMENT_LOOKUPS = 5;

export const load: PageServerLoad = async () => {
	const connection = getConnectionState();
	let cart: CartView | null = null;
	let eta: Awaited<ReturnType<typeof getDeliveryEta>> = null;
	const replacements: Record<string, CartReplacement[]> = {};
	let suggestions = loadSuggestions().map((s) => ({ ...s, inCartQty: 0, onOrderQty: 0 }));
	const covered: string[] = [];
	// Nicht lesbare Quellen: Der Abgleich fällt aus — das muss sichtbar sein,
	// sonst wirkt es wie „Picnic ignoriert meine Bestellung"
	let cartUnavailable = false;
	let openOrdersUnavailable = false;

	// Abgleich mit Warenkorb UND noch nicht gelieferten Bestellungen: Was schon
	// unterwegs oder vorgemerkt ist, wird nicht erneut in voller Menge
	// vorgeschlagen. Beide Quellen unabhängig voneinander — fällt eine aus,
	// bleibt der Abgleich mit der anderen erhalten.
	if (connection === 'connected') {
		const [cartResult, ordersResult, etaResult] = await Promise.allSettled([
			getCartView(),
			getOpenOrderQuantities(),
			getDeliveryEta()
		]);
		cart = cartResult.status === 'fulfilled' ? cartResult.value : null;
		eta = etaResult.status === 'fulfilled' ? etaResult.value : null;
		const cartQuantities = new Map<string, number>();
		for (const line of cart?.lines ?? []) {
			cartQuantities.set(line.productId, (cartQuantities.get(line.productId) ?? 0) + line.quantity);
		}
		const orderQuantities = ordersResult.status === 'fulfilled' ? ordersResult.value : new Map();
		cartUnavailable = cartResult.status === 'rejected';
		openOrdersUnavailable = ordersResult.status === 'rejected';

		suggestions = suggestions
			.map((s) => {
				const inCartQty = s.picnicId ? (cartQuantities.get(s.picnicId) ?? 0) : 0;
				const onOrderQty = s.picnicId ? (orderQuantities.get(s.picnicId) ?? 0) : 0;
				return { ...s, inCartQty, onOrderQty, needed: s.needed - inCartQty - onOrderQty };
			})
			.filter((s) => {
				if (s.needed > 0) return true;
				covered.push(s.name);
				return false;
			});
	}

	// Ersatz für nicht Lieferbares: Die Cart-Antwort nennt nur Platzhalter
	const unavailable = (cart?.lines ?? []).filter((line) => line.isUnavailable).slice(0, MAX_REPLACEMENT_LOOKUPS);
	await Promise.all(
		unavailable.map(async (line) => {
			try {
				replacements[line.productId] = await getReplacements(line.productId);
			} catch {
				replacements[line.productId] = [];
			}
		})
	);

	// Warenkorbzeilen, die Proviant kennt, verlinken auf ihre Artikelseite
	const articleIds = Object.fromEntries(
		db
			.select({ id: articles.id, picnicId: articles.picnicId })
			.from(articles)
			.all()
			.filter((a) => a.picnicId)
			.map((a) => [a.picnicId!, a.id])
	);

	// Preise: veraltete gedeckelt nachziehen, dann aus dem Cache lesen. Die
	// Vorschlagsliste ist kurz, deshalb ist das hier vertretbar.
	const picnicIds = suggestions.map((s) => s.picnicId).filter((id): id is string => Boolean(id));
	await refreshPrices(picnicIds);
	const prices = pricesFor(picnicIds);

	const priced = suggestions.map((s) => ({
		...s,
		price: s.picnicId ? (prices.get(s.picnicId) ?? null) : null
	}));

	// Summe und Ersparnis rechnet bewusst die **Seite**, nicht der Server:
	// Auswahl und Mengen sind dort veränderlicher Zustand, eine hier
	// berechnete Summe beschriebe nach dem ersten Klick etwas anderes als der
	// Knopf darunter tut. Der Server liefert die Preise, die Seite die Menge.
	return {
		suggestions: priced,
		covered,
		connection,
		cartUnavailable,
		openOrdersUnavailable,
		cart,
		eta,
		replacements,
		articleIds
	};
};

/** Gemeinsame Hülle der Warenkorb-Aktionen: Eingabe prüfen, Fehler übersetzen. */
async function cartAction(
	locals: App.Locals,
	formData: FormData,
	run: (productId: string, formData: FormData) => Promise<CartActionResult>
) {
	const t = translator(locals.locale);
	const productId = String(formData.get('productId') ?? '').trim();
	if (!productId) return fail(400, { cartMessage: t('msg.invalidProduct') });
	try {
		const result = await run(productId, formData);
		return result === 'ok' ? { cartChanged: true } : fail(409, { cartMessage: t('order.cart.notApplied') });
	} catch (err) {
		return fail(502, { cartMessage: describePicnicError(err, t, 'Warenkorb ändern') });
	}
}

export const actions: Actions = {
	// Warenkorb bearbeiten — nur Inhalt, nie bestellen und nie das Lieferfenster
	cartRemove: async ({ request, locals }) =>
		cartAction(locals, await request.formData(), (productId) => removeCartLine(productId)),

	cartChange: async ({ request, locals }) =>
		cartAction(locals, await request.formData(), (productId, formData) => {
			const delta = Number(formData.get('delta'));
			return Number.isInteger(delta) && delta !== 0 && Math.abs(delta) <= 99
				? changeCartQuantity(productId, delta)
				: Promise.resolve('notApplied');
		}),

	cartSwap: async ({ request, locals }) =>
		cartAction(locals, await request.formData(), (productId, formData) => {
			const replacementId = String(formData.get('replacementId') ?? '').trim();
			return replacementId ? swapCartLine(productId, replacementId) : Promise.resolve('notApplied');
		}),

	// Alle verknüpften Artikel auffrischen — bewusst ohne Altersgrenze und mit
	// hohem Deckel: Wer hier klickt, will aktuelle Preise und nimmt die
	// Wartezeit in Kauf.
	refreshPrices: async () => {
		const ids = db
			.select({ picnicId: articles.picnicId })
			.from(articles)
			.all()
			.map((row) => row.picnicId)
			.filter((id): id is string => Boolean(id));
		const { updated } = await refreshPrices(ids, { maxAgeMs: 0, limit: 200 });
		return { pricesRefreshed: updated };
	},

	// Picnic-Verbindung herstellen (env-Credentials)
	connect: async ({ locals }) => {
		try {
			const { needs2FA } = await login();
			return { connection: getConnectionState(), needs2FA };
		} catch (err) {
			return fail(400, { message: describePicnicError(err, translator(locals.locale), 'Anmeldung') });
		}
	},

	send2FACode: async ({ locals }) => {
		try {
			await request2FACode();
			return { codeSent: true };
		} catch (err) {
			return fail(400, { message: describePicnicError(err, translator(locals.locale), 'SMS-Code anfordern') });
		}
	},

	verify2FA: async ({ request, locals }) => {
		const t = translator(locals.locale);
		const code = String((await request.formData()).get('code') ?? '').trim();
		if (!code) return fail(400, { message: t('msg.enterCode') });
		try {
			await verify2FA(code);
			return { connection: getConnectionState() };
		} catch (err) {
			return fail(400, { message: describePicnicError(err, t, '2FA-Prüfung') });
		}
	},

	// Ausgewählte Vorschläge in den Picnic-Warenkorb legen
	addToCart: async ({ request, locals }) => {
		const t = translator(locals.locale);
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
						: t('msg.nothingSelected')
			});
		}

		try {
			await addToCart(items);
		} catch (err) {
			return fail(502, { message: describePicnicError(err, t, 'Warenkorb befüllen') });
		}

		// Gegenprobe: Picnic quittiert auch Produkt-IDs, die es nicht (mehr) kennt,
		// ohne Fehler — dann landet nichts im Warenkorb und der Artikel taucht
		// weiter als Vorschlag auf. Das lieber melden als still schlucken.
		const notInCart: string[] = [];
		try {
			const cartQuantities = await getCartQuantities();
			for (const item of items) {
				if (!cartQuantities.has(item.productId)) {
					const name = suggestions.find((s) => s.picnicId === item.productId)?.name;
					if (name) notInCart.push(name);
				}
			}
		} catch {
			// Gegenprobe nicht möglich — Bestellung gilt trotzdem als übergeben
		}

		return {
			added: items.length,
			totalUnits: items.reduce((sum, item) => sum + item.quantity, 0),
			skipped,
			notInCart
		};
	}
};
