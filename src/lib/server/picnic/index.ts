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

type Client = InstanceType<typeof PicnicClient>;
type AddProductsItems = Parameters<Client['cart']['addProductsToCart']>[0];
type SellingUnits = Awaited<ReturnType<Client['catalog']['search']>>;

/** Auth-Key überlebt Neustarts in DATA_DIR (Docker-Volume) */
function authKeyFile(): string {
	return path.join(env.DATA_DIR ?? '.', 'picnic-auth-key');
}

let client: Client | null = null;

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
	return Boolean(getClient().authKey);
}

/**
 * Login mit E-Mail/Passwort aus der Umgebung (PICNIC_USERNAME/PICNIC_PASSWORD).
 * Falls Picnic 2FA verlangt, muss danach verify2FA() aufgerufen werden.
 */
export async function login(): Promise<void> {
	if (!env.PICNIC_USERNAME || !env.PICNIC_PASSWORD) {
		throw new Error('PICNIC_USERNAME und PICNIC_PASSWORD sind nicht gesetzt');
	}
	await getClient().auth.login(env.PICNIC_USERNAME, env.PICNIC_PASSWORD);
	persistAuthKey();
}

export async function request2FACode(): Promise<void> {
	await getClient().auth.generate2FACode('SMS');
}

export async function verify2FA(code: string): Promise<void> {
	await getClient().auth.verify2FACode(code);
	persistAuthKey();
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
