/**
 * Isoliertes Adapter-Modul um die inoffizielle Picnic-API (picnic-api).
 *
 * Die restliche App importiert ausschließlich aus diesem Modul — bricht die
 * inoffizielle API, ist nur diese Datei betroffen. Grundsatz: Wir befüllen
 * nur den Warenkorb, bestellt wird immer manuell in der Picnic-App.
 */
import PicnicClient from 'picnic-api';
import * as env from '$app/env/private';
import fs from 'node:fs';
import path from 'node:path';
import type { Translate } from '#lib/i18n/index.js';
import { logWarn } from '#lib/server/log.js';
import { aggregateChecklist, type DeliveryChecklistItem } from './checklist';
import { PicnicAdapterError, picnicErrorKind, type PicnicErrorKind } from './errors';
import { catalogPrice, tilePrice, type CatalogPrice, type ProductPrice } from './price';
import { priceTiers } from '#lib/priceTiers.js';
import type { PriceTier } from '#lib/offers.js';
import { extractSearchHits, type ProductSearchHit } from './search';
import { extractRecipeTiles, type ParsedPicnicRecipe, type PicnicRecipeTile } from './recipeImport';
import { mapPicnicRecipe } from './recipeMapping';
import { createThrottle } from './throttle';
import { extractProductFacts, type NutritionRow, type ProductFacts } from './productFacts';

export { picnicErrorKind };
export type {
	PicnicErrorKind,
	CatalogPrice,
	NutritionRow,
	ProductFacts,
	DeliveryChecklistItem,
	ParsedPicnicRecipe,
	PicnicRecipeTile,
	ProductPrice,
	ProductSearchHit
};

type Client = InstanceType<typeof PicnicClient>;

/** Eine Warenkorb-Position: Picnic-Produkt-ID und Anzahl Gebinde. */
export type CartItem = { productId: string; quantity: number };

/**
 * Verständliche Meldung zu einem Picnic-Fehler für die Oberfläche; der
 * Rohfehler landet im Log. `context` sagt dort, wobei es passiert ist.
 */
export function describePicnicError(err: unknown, t: Translate, context: string): string {
	const kind = picnicErrorKind(err);
	logWarn(`Picnic-Fehler: ${context}`, { art: kind, fehler: err instanceof Error ? err.message : String(err) });
	return t(`picnic.error.${kind}`);
}

/** Auth-Key überlebt Neustarts in DATA_DIR (Docker-Volume) */
function authKeyFile(): string {
	return path.join(env.DATA_DIR ?? '.', 'picnic-auth-key');
}

export type ConnectionState = 'unconfigured' | 'disconnected' | 'needs2FA' | 'connected';

let client: Client | null = null;
// 2FA ist offen: Auth-Key liegt vor, ist aber erst nach Code-Eingabe voll gültig
let pending2FA = false;

function hasCredentials(): boolean {
	return Boolean(env.PICNIC_USERNAME && env.PICNIC_PASSWORD);
}

function getClient(): Client {
	if (!client) {
		let authKey: string | undefined;
		if (fs.existsSync(authKeyFile())) {
			authKey = fs.readFileSync(authKeyFile(), 'utf8').trim();
		}
		client = new PicnicClient({ countryCode: 'DE', authKey });
	}
	return client;
}

function persistAuthKey(): void {
	const key = getClient().authKey;
	if (key) fs.writeFileSync(authKeyFile(), key, 'utf8');
}

export function isLoggedIn(): boolean {
	return Boolean(getClient().authKey) && !pending2FA;
}

/** Zustand der Picnic-Verbindung für die UI. */
export function getConnectionState(): ConnectionState {
	if (!hasCredentials()) return 'unconfigured';
	if (pending2FA) return 'needs2FA';
	return getClient().authKey ? 'connected' : 'disconnected';
}

/**
 * Stellt sicher, dass eine gültige Verbindung besteht; loggt bei Bedarf ein.
 * Wirft eine sprechende Fehlermeldung, wenn 2FA offen oder nichts konfiguriert ist.
 */
export async function ensureLoggedIn(): Promise<void> {
	if (isLoggedIn()) return;
	if (!hasCredentials()) {
		throw new PicnicAdapterError('notConfigured');
	}
	const { needs2FA } = await login();
	if (needs2FA) {
		throw new PicnicAdapterError('needs2FA');
	}
}

/**
 * Login mit E-Mail/Passwort aus der Umgebung (PICNIC_USERNAME/PICNIC_PASSWORD).
 * Liefert { needs2FA }: ist es true, muss request2FACode()/verify2FA() folgen.
 */
export async function login(): Promise<{ needs2FA: boolean }> {
	if (!hasCredentials()) {
		throw new PicnicAdapterError('notConfigured');
	}
	const result = await getClient().auth.login(env.PICNIC_USERNAME!, env.PICNIC_PASSWORD!);
	persistAuthKey();
	pending2FA = Boolean(result?.secondFactorAuthenticationRequired);
	return { needs2FA: pending2FA };
}

/** Fordert einen 2FA-Code per SMS an (setzt einen vorherigen login() voraus). */
export async function request2FACode(): Promise<void> {
	await getClient().auth.generate2FACode('SMS');
}

export async function verify2FA(code: string): Promise<void> {
	await getClient().auth.verify2FACode(code);
	persistAuthKey();
	pending2FA = false;
}

/**
 * Produktsuche, z.B. zur Verknüpfung von Artikeln mit Picnic-IDs.
 *
 * Eine Weiche nach Seitenformat: `catalog.getSearchResults()` aus picnic-api 5
 * versteht nur die RSC-Fassung der Suchseite, Picnic DE liefert aber noch
 * Fusion — dann wirft die Bibliothek (live geprüft). Deshalb erst die Seite
 * holen und nachsehen: Fusion werten wir selbst aus (`search.ts`), bei RSC
 * übernimmt die Bibliothek. Stellt Picnic DE um, läuft die Suche ohne
 * Codeänderung weiter.
 */
export async function searchProducts(query: string): Promise<ProductSearchHit[]> {
	const pageId = `search-page-results?search_term=${encodeURIComponent(query)}`;
	const page = await getClient().app.getPage(pageId);
	if (page.format === 'fusion') return extractSearchHits(page.page);

	// RSC: Treffer kommen in Abschnitten („Schon mal gekauft", je Produktgruppe
	// einer), dasselbe Produkt kann in mehreren stehen
	const results = await getClient().catalog.getSearchResults(query);
	const hits = new Map<string, ProductSearchHit>();
	for (const section of results.products?.sections ?? []) {
		for (const tile of section.products) {
			if (hits.has(tile.id)) continue;
			hits.set(tile.id, {
				id: tile.id,
				name: tile.name,
				unitQuantity: tile.unitQuantity,
				price: tile.displayPrice,
				imageId: tile.imageId
			});
		}
	}
	return [...hits.values()];
}

/** Produktbild als Data-URI, z.B. zur Übernahme in den Artikelstamm */
export async function getProductImage(imageId: string): Promise<string> {
	return getClient().catalog.getImageAsDataUri(imageId, 'medium');
}

/**
 * Legt Produkte in den Picnic-Warenkorb (Bestellvorschläge, „Rezept bestellen“).
 * Mengen sind Gebinde-Anzahlen — Aufrunden auf Gebindegrößen passiert vorher.
 */
export async function addToCart(items: CartItem[]): Promise<void> {
	// picnic-api 5 kennt nur noch das Einzel-Hinzufügen. Bewusst nacheinander:
	// jeder Aufruf antwortet mit dem ganzen Warenkorb, parallel liefen also
	// konkurrierende Änderungen desselben Korbs gegen eine fremde Schnittstelle.
	for (const item of items) {
		await getClient().cart.addProductToCart(item.productId, item.quantity);
	}
}

/**
 * Aktuelle Warenkorb-Mengen je Produkt-ID (für den Abgleich der
 * Bestellvorschläge).
 *
 * Seit picnic-api 5 liest die Bibliothek die Menge selbst aus dem
 * QUANTITY-Decorator (inkl. `decorator_overrides`) — früher stand hier genau
 * diese Auswertung, weil ein Produkt je Zeile nur **einmal** auftaucht und
 * Zählen der Vorkommen immer 1 ergab. Defensiv bleibt es trotzdem: die API ist
 * unoffiziell, unplausible Zeilen werden übersprungen.
 */
/** Eine Zeile des Picnic-Warenkorbs, so wie Proviant sie anzeigt. */
export type CartLine = {
	productId: string;
	name: string;
	unitQuantity: string;
	imageId: string | null;
	quantity: number;
	maxCount: number;
	/** Preis der **Zeile** in Cent (nach Rabatt) */
	linePrice: number;
	/** Zeilenpreis vor Rabatt, `null` ohne Rabatt */
	lineOriginalPrice: number | null;
	/** Staffeln und Mehrfachangebot als Stufen (für den Mengenrabatt-Hinweis) */
	tiers: PriceTier[];
	labels: string[];
	isUnavailable: boolean;
	unavailableReason: string | null;
};

export type CartView = {
	lines: CartLine[];
	totalCount: number;
	/** Zu zahlen inkl. Pfand und Gebühren, in Cent */
	totalPrice: number;
	/** Mindestbestellwert des gewählten Lieferfensters, `null` = keiner bekannt */
	minimumOrderValue: number | null;
	/** Gewähltes Lieferfenster; `explicit` = selbst gewählt, sonst von Picnic vorbelegt */
	slot: { start: string; end: string; explicit: boolean } | null;
};

/**
 * Der Warenkorb zum Anzeigen. Nicht Lieferbares steht vorn, damit es auffällt.
 * Die Ersatzprodukte der Cart-Antwort sind Platzhalter (Name „irrelevant“,
 * Preis 0) — die echten liefert `getReplacements`.
 */
export async function getCartView(): Promise<CartView> {
	await ensureLoggedIn();
	const cart = await getClient().cart.getCart();
	const lines: CartLine[] = cart.items
		.filter((item) => item.productId && item.quantity > 0)
		.map((item) => {
			const labels = item.labels.map((label) => label.text).filter(Boolean);
			const unitRegular = item.quantity > 0 ? Math.round((item.originalPrice ?? item.displayPrice) / item.quantity) : 0;
			const tilePriced = tilePrice({
				displayPrice: unitRegular,
				originalPrice: null,
				labels: labels.map((text) => ({ text })),
				priceRanges: item.priceRanges
			});
			return {
				productId: item.productId,
				name: item.name,
				unitQuantity: item.unitQuantity,
				imageId: item.imageId,
				quantity: item.quantity,
				maxCount: item.maxCount,
				linePrice: item.displayPrice,
				lineOriginalPrice: item.originalPrice != null && item.originalPrice > item.displayPrice ? item.originalPrice : null,
				tiers: priceTiers(tilePriced),
				labels,
				isUnavailable: item.isUnavailable,
				unavailableReason: item.unavailableReason
			};
		})
		.sort((a, b) => Number(b.isUnavailable) - Number(a.isUnavailable));
	const slot = cart.selectedSlot;
	return {
		lines,
		totalCount: cart.totalCount,
		totalPrice: cart.totalPrice,
		minimumOrderValue: cart.minimumOrderValue,
		slot:
			slot?.windowStart && slot.windowEnd
				? { start: slot.windowStart, end: slot.windowEnd, explicit: slot.isExplicitSelection }
				: null
	};
}

/** Ein Ersatzvorschlag für ein nicht lieferbares Produkt. */
export type CartReplacement = { id: string; name: string; unitQuantity: string; imageId: string | null; price: number };

/** Picnics Ersatzvorschläge für ein nicht lieferbares Produkt (mit echten Namen und Preisen). */
export async function getReplacements(productId: string): Promise<CartReplacement[]> {
	await ensureLoggedIn();
	const { replacements } = await getClient().cart.getReplacements(productId);
	return replacements
		.filter((tile) => tile.id && tile.name && !tile.isUnavailable)
		.map((tile) => ({
			id: tile.id,
			name: tile.name,
			unitQuantity: tile.unitQuantity,
			imageId: tile.imageId,
			price: tile.displayPrice
		}));
}

/** Nimmt `count` Packungen eines Produkts aus dem Warenkorb. */
export async function removeFromCart(productId: string, count: number): Promise<void> {
	await ensureLoggedIn();
	await getClient().cart.removeProductFromCart(productId, count);
}

/**
 * Ankunftszeit der nächsten offenen Lieferung, wie die Picnic-App sie zeigt.
 * `null`, wenn keine Lieferung unterwegs ist oder Picnic (noch) keine Zeit
 * kennt — die gibt es meist erst am Liefertag.
 */
export async function getDeliveryEta(): Promise<{
	eta: string | null;
	windowStart: string | null;
	windowEnd: string | null;
} | null> {
	await ensureLoggedIn();
	const open = (await getClient().delivery.getDeliverySummaries()).find(
		(delivery) => delivery.status !== 'COMPLETED' && delivery.status !== 'CANCELLED'
	);
	if (!open) return null;
	const position = await getClient().delivery.getDeliveryPosition(open.id);
	const eta = position.eta != null ? new Date(position.eta).toISOString() : null;
	if (!eta && !position.etaWindowStart) return null;
	return { eta, windowStart: position.etaWindowStart, windowEnd: position.etaWindowEnd };
}

export async function getCartQuantities(): Promise<Map<string, number>> {
	await ensureLoggedIn();
	const cart = await getClient().cart.getCart();
	const quantities = new Map<string, number>();
	for (const line of cart?.items ?? []) {
		const id = typeof line?.productId === 'string' && line.productId ? line.productId : null;
		const qty = Number(line?.quantity);
		if (id && Number.isFinite(qty) && qty > 0) {
			quantities.set(id, (quantities.get(id) ?? 0) + qty);
		}
	}
	return quantities;
}

type ChecklistOrders = NonNullable<Parameters<typeof aggregateChecklist>[0]>;

/** Rohe Lieferung, soweit `checklist.ts` sie liest. */
type RawDelivery = { orders?: unknown; decorators?: unknown };

/**
 * Lieferung im **Rohformat** von Picnic.
 *
 * Bewusst nicht `delivery.getDelivery()`: Das aufbereitete Modell von
 * picnic-api 5 lässt die Decorators der Lieferung weg — und genau dort meldet
 * Picnic nicht gelieferte Positionen (`ARTICLE_DELIVERY_ISSUES`, siehe
 * `checklist.ts`). Ohne sie hielte die Prüfung eine stornierte Position für
 * erwartet. `sendRequest` ist der dafür vorgesehene, öffentliche Weg.
 */
async function getRawDelivery(deliveryId: string): Promise<RawDelivery> {
	const raw = await getClient().sendRequest<null, RawDelivery | null>(
		'GET',
		`/deliveries/${encodeURIComponent(deliveryId)}`
	);
	return raw ?? {};
}

/** Bestellungen einer rohen Lieferung; defensiv, das Format ist unoffiziell. */
function rawOrders(detail: RawDelivery): ChecklistOrders {
	return (Array.isArray(detail.orders) ? detail.orders : []) as ChecklistOrders;
}

/**
 * Bereits bestellte, aber noch nicht gelieferte Mengen je Produkt-ID — zusammen
 * mit dem Warenkorb der Abgleich für die Bestellvorschläge.
 *
 * Die Lieferungsliste enthält keine Positionen, die kommen erst im Detailabruf
 * (live geprüft), deshalb je offener Lieferung ein zusätzlicher Aufruf. In der
 * Praxis ist höchstens eine Lieferung offen; die Obergrenze deckelt nur den
 * Ausreißerfall.
 */
export async function getOpenOrderQuantities(): Promise<Map<string, number>> {
	await ensureLoggedIn();
	const deliveries = await getClient().delivery.getDeliverySummaries();
	// Bewusst per Ausschluss statt per Positivliste: ein künftiger
	// Zwischenstatus von Picnic soll als „noch nicht geliefert" zählen
	const open = deliveries
		.filter((delivery) => delivery.status !== 'COMPLETED' && delivery.status !== 'CANCELLED')
		.slice(0, 5);

	const quantities = new Map<string, number>();
	for (const delivery of open) {
		const detail = await getRawDelivery(delivery.id);
		// Stornierte Teilbestellungen kommen nicht mehr — die zählen nicht mit
		const orders = rawOrders(detail).filter(
			(order) => (order as { status?: string } | null)?.status !== 'CANCELLED'
		);
		// Einzelne stornierte Positionen ebenso: `aggregateChecklist` zieht sie
		// anhand der Lieferungs-Decorators ab. Ohne das gälte ein Artikel, den
		// Picnic gar nicht liefert, weiter als „unterwegs" und würde nie wieder
		// vorgeschlagen.
		for (const item of aggregateChecklist(orders, detail.decorators)) {
			if (item.quantity < 1) continue;
			quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
		}
	}
	return quantities;
}

export type DeliverySummary = {
	id: string;
	creationTime: string;
	deliveryStart: string | null;
	status: string;
	totalPrice: number;
};

/** Jüngste Lieferungen als schlanke Zusammenfassung für die Übersicht. */
export async function getRecentDeliveries(limit = 10): Promise<DeliverySummary[]> {
	await ensureLoggedIn();
	const deliveries = await getClient().delivery.getDeliverySummaries();
	return deliveries.slice(0, limit).map((delivery) => ({
		id: delivery.id,
		creationTime: delivery.creationTime,
		deliveryStart: delivery.windowStart,
		status: delivery.status,
		// Summe der Bestellwerte der (Teil-)Bestellungen — rechnet die Bibliothek
		totalPrice: delivery.totalPrice
	}));
}

/**
 * Sollliste einer Lieferung: alle Positionen über sämtliche (Teil-)Bestellungen
 * hinweg, je Produkt-ID aggregiert.
 */
export async function getDeliveryChecklist(deliveryId: string): Promise<DeliveryChecklistItem[]> {
	await ensureLoggedIn();
	const detail = await getRawDelivery(deliveryId);
	return aggregateChecklist(rawOrders(detail), detail.decorators);
}

export type OrderedProduct = {
	productId: string;
	name: string;
	unitQuantity: string;
	imageId: string | null;
	/** In wie vielen der betrachteten Lieferungen das Produkt vorkam */
	timesOrdered: number;
	/** Lieferdatum des letzten Kaufs (ISO) */
	lastOrderedAt: string | null;
};

/**
 * Aggregiert alle Produkte aus den letzten Lieferungen (Quelle für den
 * Artikel-Import). Ein API-Call pro Lieferung — deshalb begrenzt.
 */
export async function listOrderedProducts(deliveryLimit = 10): Promise<OrderedProduct[]> {
	await ensureLoggedIn();
	const deliveries = await getRecentDeliveries(deliveryLimit);

	const byProduct = new Map<string, OrderedProduct>();
	for (const delivery of deliveries) {
		let items: DeliveryChecklistItem[];
		try {
			items = await getDeliveryChecklist(delivery.id);
		} catch {
			continue; // einzelne fehlerhafte Lieferungen überspringen
		}
		for (const item of items) {
			const existing = byProduct.get(item.productId);
			if (existing) {
				existing.timesOrdered += 1;
			} else {
				byProduct.set(item.productId, {
					productId: item.productId,
					name: item.name,
					unitQuantity: item.unitQuantity,
					imageId: item.imageId,
					timesOrdered: 1,
					lastOrderedAt: delivery.deliveryStart
				});
			}
		}
	}
	// Häufig Gekauftes zuerst, dann alphabetisch
	return [...byProduct.values()].sort(
		(a, b) => b.timesOrdered - a.timesOrdered || a.name.localeCompare(b.name, 'de')
	);
}

/**
 * Rohe Fusion-Seite für unsere eigenen Parser in `recipeImport.ts`.
 *
 * picnic-api 5 hat die Seitenabrufe der Rezepte privat gemacht; `app.getPage`
 * ist der öffentliche Ersatz. Picnic stellt Seiten nach und nach auf RSC um —
 * kommt eine als RSC, verstehen unsere Parser sie nicht. Dann lieber eine
 * klare Meldung als ein still leerer Import.
 */
async function getFusionPage(pageId: string): Promise<unknown> {
	const page = await getClient().app.getPage(pageId);
	if (page.format !== 'fusion') {
		throw new PicnicAdapterError(
			'unexpectedFormat',
			`Picnic liefert die Seite ${pageId.split('?')[0]} in einem unbekannten Format (${page.format})`
		);
	}
	return page.page;
}

/**
 * Prozessweite Drossel für Rezeptabrufe (siehe `throttle.ts`): „Alle
 * importieren" holt Dutzende Rezeptseiten am Stück, jede gut 1 MB groß.
 */
const recipeThrottle = createThrottle(1500);

/**
 * Dasselbe für den Artikelimport (Bestellungen, Favoriten, Lieferungs-Check):
 * je Artikel eine Produktseite. Die Favoriten umfassen live gut 500 Produkte.
 */
const productImportThrottle = createThrottle(1000);

/** Rezepte der Picnic-Rezeptseite (Kacheln mit ID und Name). */
export async function listPicnicRecipes(): Promise<PicnicRecipeTile[]> {
	await ensureLoggedIn();
	return extractRecipeTiles(await getFusionPage('meals-page-root'));
}

/** Ein Gang der Picnic-Favoriten mit seinen Produkten (Quelle für den Artikelimport). */
export type FavoriteAisle = {
	id: string;
	title: string;
	products: { productId: string; name: string; unitQuantity: string; imageId: string | null }[];
};

/** Höchstens so viele Gänge werden gleichzeitig nachgeladen. */
const AISLE_CONCURRENCY = 4;

/**
 * Die Produkte, die der Haushalt bei Picnic kauft, nach Gang gruppiert
 * (Reiter „Favoriten“ der App). Lange Gänge liefert die Übersicht nur
 * angeschnitten (`complete: false`) — die werden einzeln nachgeladen. Ein
 * Produkt steht nur im ersten Gang, in dem es vorkommt; leere Gänge fallen weg.
 */
export async function listFavoriteProducts(): Promise<FavoriteAisle[]> {
	await ensureLoggedIn();
	const { aisles } = await getClient().catalog.getFavorites();

	const tilesByAisle = new Map(aisles.map((aisle) => [aisle.id, aisle.products]));
	const incomplete = aisles.filter((aisle) => !aisle.complete);
	for (let i = 0; i < incomplete.length; i += AISLE_CONCURRENCY) {
		await Promise.all(
			incomplete.slice(i, i + AISLE_CONCURRENCY).map(async (aisle) => {
				try {
					tilesByAisle.set(aisle.id, await getClient().catalog.getFavoritesInAisle(aisle.id));
				} catch {
					// dann eben nur der angeschnittene Teil
				}
			})
		);
	}

	const seen = new Set<string>();
	const result: FavoriteAisle[] = [];
	for (const aisle of aisles) {
		const products = (tilesByAisle.get(aisle.id) ?? [])
			.filter((tile) => tile.id && tile.name && !seen.has(tile.id))
			.map((tile) => {
				seen.add(tile.id);
				return { productId: tile.id, name: tile.name, unitQuantity: tile.unitQuantity, imageId: tile.imageId };
			});
		if (products.length > 0) result.push({ id: aisle.id, title: aisle.title, products });
	}
	return result;
}

/**
 * Ein Picnic-Rezept, umgerechnet auf seine **Standardportionen**.
 *
 * Ohne Angabe liefert Picnic das Rezept für die Portionenzahl, die zuletzt in
 * der App gewählt war (live: 3 statt 4). Weicht sie ab, wird mit den
 * Standardportionen neu geladen — sonst passten gespeicherte Portionen und
 * Mengen nicht zusammen.
 */
export async function getPicnicRecipe(id: string): Promise<ParsedPicnicRecipe> {
	await ensureLoggedIn();
	let recipe = await recipeThrottle(() => getClient().recipe.getRecipe(id));
	if (recipe.defaultPortions > 0 && recipe.portions !== recipe.defaultPortions) {
		const portions = recipe.defaultPortions;
		recipe = await recipeThrottle(() => getClient().recipe.getRecipe(id, { portions }));
	}
	return mapPicnicRecipe(recipe);
}

/** In der Picnic-App gespeicherte Rezepte. */
export async function listSavedPicnicRecipes(): Promise<PicnicRecipeTile[]> {
	await ensureLoggedIn();
	return (await getClient().recipe.getSavedRecipes()).map((r) => ({ id: r.id, name: r.name }));
}

/** In der Picnic-App selbst angelegte Rezepte. */
export async function listOwnPicnicRecipes(): Promise<PicnicRecipeTile[]> {
	await ensureLoggedIn();
	return (await getClient().recipe.getUserDefinedRecipes()).map((r) => ({ id: r.id, name: r.name }));
}

/**
 * Preis je Produkt-ID. Es gibt **keinen Bulk-Lookup** — ein Call pro Produkt,
 * deshalb ist die Menge vom Aufrufer zu deckeln (siehe `server/prices.ts`).
 *
 * `catalog.getProduct()` lädt die Produktseite genau **einmal** und liefert
 * seit picnic-api 5 auch den Streichpreis (`originalPrice`) — vorher musste
 * die rohe Seite dafür ein zweites Mal ausgewertet werden. Die Deutung liegt
 * in `catalogPrice()`; ein Parserfehler der Bibliothek wird in
 * `getProductPrices` zu „kein Preis", lieber das als ein kaputter.
 */
async function fetchProductPrice(id: string): Promise<CatalogPrice | null> {
	return catalogPrice(await getClient().catalog.getProduct(id));
}

/**
 * Gleichzeitig laufende Preisabrufe. Picnics API ist inoffiziell und
 * erfahrungsgemäß empfindlich; der Auffrisch-Knopf schickt bis zu 200 IDs auf
 * einmal, und die alle parallel loszulassen war ein Sturm auf eine fremde
 * Schnittstelle. Ein paar wenige gleichzeitig sind schnell genug.
 */
const PRICE_CONCURRENCY = 5;

/**
 * Geduld je Produkt. Ohne Deckel hing ein einziger stehengebliebener Abruf die
 * ganze Seite auf — `refreshPrices` wird im `load` von `/bestellen` und
 * `/rezepte/[id]` abgewartet. Ein fehlender Preis ist dort das kleinere Übel
 * als eine Seite, die nie fertig lädt.
 */
const PRICE_TIMEOUT_MS = 10_000;

/**
 * Wartet höchstens `ms` auf `promise`; danach (und bei jedem Fehler) `null`.
 *
 * Der Abruf selbst läuft weiter — abbrechen lässt er sich über die
 * `picnic-api` nicht. Er ist danach nur niemandes Problem mehr.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(null), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			() => {
				clearTimeout(timer);
				resolve(null);
			}
		);
	});
}

/**
 * Preise zu mehreren Produkt-IDs. Einzelne Fehlschläge werden übersprungen —
 * ein nicht mehr existierendes Produkt darf nicht die ganze Seite kippen. Die
 * zurückgegebene Map darf also kleiner sein als die Eingabe.
 *
 * Abgearbeitet wird die Liste als Warteschlange durch wenige Arbeiter, statt
 * alle IDs gleichzeitig loszuschicken.
 */
export async function getProductPrices(ids: string[]): Promise<Map<string, CatalogPrice>> {
	await ensureLoggedIn();
	const prices = new Map<string, CatalogPrice>();

	let next = 0;
	async function worker(): Promise<void> {
		while (next < ids.length) {
			const id = ids[next++];
			const price = await withTimeout(fetchProductPrice(id), PRICE_TIMEOUT_MS);
			if (price) prices.set(id, price);
		}
	}

	const workers = Array.from({ length: Math.min(PRICE_CONCURRENCY, ids.length) }, () => worker());
	await Promise.all(workers);
	return prices;
}

/** Höchstens so viele Aktionsgruppen werden gleichzeitig geladen. */
const PROMO_GROUP_CONCURRENCY = 6;

/**
 * Alle Produkte mit Angebot: die Kacheln der Angebotsseite plus die Produkte
 * jeder Aktionsgruppe („Alpro Milchersatz“, „De Cecco Pasta“ …), die die Seite
 * nur als Sammelkachel zeigt. Gedeutet über `tilePrice`; übrig bleiben nur
 * Produkte mit echtem Rabatt. Eine Beschriftung mit Zahl, die sich nicht
 * deuten ließ, wird geloggt — dann kennt Picnic eine neue Angebotsform.
 */
export async function getPromotedProducts(): Promise<Map<string, CatalogPrice>> {
	await ensureLoggedIn();
	const { sections } = await getClient().catalog.getPromotions();

	const tiles = sections.flatMap((section) => section.products);
	const groupIds = [...new Set(sections.flatMap((section) => section.groups.map((group) => group.id)))];
	for (let i = 0; i < groupIds.length; i += PROMO_GROUP_CONCURRENCY) {
		const groups = await Promise.all(
			groupIds.slice(i, i + PROMO_GROUP_CONCURRENCY).map((id) =>
				getClient()
					.catalog.getPromotionGroup(id)
					.catch(() => null)
			)
		);
		for (const group of groups) if (group) tiles.push(...group.products);
	}

	const result = new Map<string, CatalogPrice>();
	const unknownLabels = new Set<string>();
	for (const tile of tiles) {
		if (result.has(tile.id)) continue;
		const price = tilePrice(tile);
		if (price?.promoPrice != null) {
			result.set(tile.id, price);
		} else if (tile.originalPrice == null) {
			for (const label of tile.labels) {
				const text = label.text;
				if (text && /\d/.test(text) && !/^jetzt\s/i.test(text)) unknownLabels.add(text);
			}
		}
	}
	// „jetzt 1.49€“ ohne Streichpreis ist bekannt und bewusst nicht deutbar
	if (unknownLabels.size > 0) logWarn('Unbekannte Picnic-Angebotsbeschriftungen', { labels: [...unknownLabels].join(' | ') });
	return result;
}

/**
 * Ein Produkt für die Artikelseite: Preis (mit Angebot), Grundpreis und die
 * Produktdaten (Marke, Herkunft, Bio, Nährwerte) — alles aus einem Abruf.
 * `bulk` für Importe vieler Artikel am Stück: dann gedrosselt (siehe
 * `throttle.ts`). Die Artikelseite selbst bleibt ungebremst, damit sie nicht
 * hinter einem laufenden Import wartet.
 */
export async function getProductDetails(
	id: string,
	options: { bulk?: boolean } = {}
): Promise<{ price: CatalogPrice | null; unitPrice: string | null; facts: ProductFacts }> {
	await ensureLoggedIn();
	const fetchProduct = () => getClient().catalog.getProduct(id);
	const product = await (options.bulk ? productImportThrottle(fetchProduct) : fetchProduct());
	return { price: catalogPrice(product), unitPrice: product.unitPrice ?? null, facts: extractProductFacts(product) };
}
