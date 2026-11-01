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
import { catalogPrice, type ProductPrice } from './price';
import { extractSearchHits, type ProductSearchHit } from './search';
import { extractRecipeTiles, type ParsedPicnicRecipe, type PicnicRecipeTile } from './recipeImport';
import { mapPicnicRecipe } from './recipeMapping';

export { picnicErrorKind };
export type {
	PicnicErrorKind,
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

/** Rezepte der Picnic-Rezeptseite (Kacheln mit ID und Name). */
export async function listPicnicRecipes(): Promise<PicnicRecipeTile[]> {
	await ensureLoggedIn();
	return extractRecipeTiles(await getFusionPage('meals-page-root'));
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
	let recipe = await getClient().recipe.getRecipe(id);
	if (recipe.defaultPortions > 0 && recipe.portions !== recipe.defaultPortions) {
		recipe = await getClient().recipe.getRecipe(id, { portions: recipe.defaultPortions });
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
async function fetchProductPrice(id: string): Promise<ProductPrice | null> {
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
export async function getProductPrices(ids: string[]): Promise<Map<string, ProductPrice>> {
	await ensureLoggedIn();
	const prices = new Map<string, ProductPrice>();

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
