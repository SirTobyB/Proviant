/**
 * Isoliertes Adapter-Modul um die inoffizielle Picnic-API (picnic-api).
 *
 * Die restliche App importiert ausschließlich aus diesem Modul — bricht die
 * inoffizielle API, ist nur diese Datei betroffen. Grundsatz: Wir befüllen
 * nur den Warenkorb, bestellt wird immer manuell in der Picnic-App.
 */
import PicnicClient from 'picnic-api';
import { env } from '$env/dynamic/private';
import fs from 'node:fs';
import path from 'node:path';
import { aggregateChecklist, type DeliveryChecklistItem } from './checklist';
import {
	extractRecipeTiles,
	parseRecipeDetail,
	type ParsedPicnicRecipe,
	type PicnicRecipeTile
} from './recipeImport';

export type { DeliveryChecklistItem, ParsedPicnicRecipe, PicnicRecipeTile };

type Client = InstanceType<typeof PicnicClient>;
type AddProductsItems = Parameters<Client['cart']['addProductsToCart']>[0];
type SellingUnits = Awaited<ReturnType<Client['catalog']['search']>>;

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
		throw new Error('Keine Picnic-Zugangsdaten konfiguriert (PICNIC_USERNAME/PICNIC_PASSWORD)');
	}
	const { needs2FA } = await login();
	if (needs2FA) {
		throw new Error('Picnic verlangt eine 2FA-Bestätigung — bitte zuerst den SMS-Code eingeben');
	}
}

/**
 * Login mit E-Mail/Passwort aus der Umgebung (PICNIC_USERNAME/PICNIC_PASSWORD).
 * Liefert { needs2FA }: ist es true, muss request2FACode()/verify2FA() folgen.
 */
export async function login(): Promise<{ needs2FA: boolean }> {
	if (!hasCredentials()) {
		throw new Error('PICNIC_USERNAME und PICNIC_PASSWORD sind nicht gesetzt');
	}
	const result = await getClient().auth.login(env.PICNIC_USERNAME!, env.PICNIC_PASSWORD!);
	persistAuthKey();
	pending2FA = Boolean(result?.second_factor_authentication_required);
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

/** Produktsuche, z.B. zur Verknüpfung von Artikeln mit Picnic-IDs */
export async function searchProducts(query: string): Promise<SellingUnits> {
	return getClient().catalog.search(query);
}

/** Produktbild als Data-URI, z.B. zur Übernahme in den Artikelstamm */
export async function getProductImage(imageId: string): Promise<string> {
	return getClient().catalog.getImageAsDataUri(imageId, 'medium');
}

/**
 * Legt Produkte in den Picnic-Warenkorb (Bestellvorschläge, „Rezept bestellen“).
 * Mengen sind Gebinde-Anzahlen — Aufrunden auf Gebindegrößen passiert vorher.
 */
export async function addToCart(items: AddProductsItems): Promise<void> {
	await getClient().cart.addProductsToCart(items);
}

export async function getCart() {
	return getClient().cart.getCart();
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
	const deliveries = await getClient().delivery.getDeliveries();
	return deliveries.slice(0, limit).map((delivery) => ({
		id: delivery.delivery_id,
		creationTime: delivery.creation_time,
		deliveryStart: delivery.delivery_time?.start ?? delivery.eta2?.start ?? null,
		status: delivery.status,
		// Summe der Bestellwerte der (Teil-)Bestellungen dieser Lieferung
		totalPrice: (delivery.orders ?? []).reduce(
			(sum, order) => sum + ((order as { total_price?: number }).total_price ?? 0),
			0
		)
	}));
}

/**
 * Sollliste einer Lieferung: alle Positionen über sämtliche (Teil-)Bestellungen
 * hinweg, je Produkt-ID aggregiert.
 */
export async function getDeliveryChecklist(deliveryId: string): Promise<DeliveryChecklistItem[]> {
	await ensureLoggedIn();
	const detail = await getClient().delivery.getDelivery(deliveryId);
	return aggregateChecklist(detail.orders);
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

/** Rezepte der Picnic-Rezeptseite (Kacheln mit ID und Name). */
export async function listPicnicRecipes(): Promise<PicnicRecipeTile[]> {
	await ensureLoggedIn();
	const page = await getClient().recipe.getRecipesPage();
	return extractRecipeTiles(page);
}

/** Detaildaten eines Picnic-Rezepts (Zutaten, Portionen, Schritte). */
export async function getPicnicRecipeDetail(id: string, name?: string): Promise<ParsedPicnicRecipe> {
	await ensureLoggedIn();
	const page = await getClient().recipe.getRecipeDetailsPage(id);
	return parseRecipeDetail(page, name);
}
