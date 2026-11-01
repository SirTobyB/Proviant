/**
 * Schreibaktionen auf den Picnic-Warenkorb, jeweils **mit Gegenprobe**.
 *
 * Picnic quittiert Produkt-IDs, die es nicht (mehr) kennt, ohne Fehler — es
 * landet dann einfach nichts im Warenkorb (live geprüft). Jede Aktion liest den
 * Warenkorb deshalb danach noch einmal und meldet, ob die Änderung angekommen
 * ist, statt blind Erfolg zu melden. Bestellt wird hier nie; das Lieferfenster
 * bleibt unangetastet.
 */
import { addToCart, getCartQuantities, removeFromCart } from '#lib/server/picnic/index.js';

export type CartActionResult = 'ok' | 'notApplied';

/** Legt eine Packung in den Warenkorb (Artikelstamm, Angebote, Mengenrabatt). */
export async function addArticleToCart(picnicId: string, count = 1): Promise<CartActionResult> {
	const before = (await getCartQuantities()).get(picnicId) ?? 0;
	await addToCart([{ productId: picnicId, quantity: count }]);
	const after = (await getCartQuantities()).get(picnicId) ?? 0;
	return after > before ? 'ok' : 'notApplied';
}

/** Ändert die Menge um ±n; bei 0 ist das Produkt draußen. */
export async function changeCartQuantity(productId: string, delta: number): Promise<CartActionResult> {
	const before = (await getCartQuantities()).get(productId) ?? 0;
	if (delta > 0) await addToCart([{ productId, quantity: delta }]);
	else if (delta < 0 && before > 0) await removeFromCart(productId, Math.min(before, -delta));
	const after = (await getCartQuantities()).get(productId) ?? 0;
	return after === Math.max(0, before + delta) ? 'ok' : 'notApplied';
}

/** Nimmt ein Produkt ganz aus dem Warenkorb. */
export async function removeCartLine(productId: string): Promise<CartActionResult> {
	const before = (await getCartQuantities()).get(productId) ?? 0;
	if (before > 0) await removeFromCart(productId, before);
	const after = (await getCartQuantities()).get(productId) ?? 0;
	return after === 0 ? 'ok' : 'notApplied';
}

/**
 * Tauscht ein nicht lieferbares Produkt gegen einen Ersatz in gleicher Menge.
 * Landet der Ersatz nicht im Warenkorb, kommt das alte Produkt zurück — sonst
 * wäre die Position am Ende ganz verschwunden.
 */
export async function swapCartLine(productId: string, replacementId: string): Promise<CartActionResult> {
	const quantities = await getCartQuantities();
	const count = quantities.get(productId) ?? 0;
	if (count === 0) return 'notApplied';
	const replacementBefore = quantities.get(replacementId) ?? 0;

	await removeFromCart(productId, count);
	await addToCart([{ productId: replacementId, quantity: count }]);
	const after = await getCartQuantities();
	if ((after.get(replacementId) ?? 0) >= replacementBefore + count) return 'ok';

	await addToCart([{ productId, quantity: count }]);
	return 'notApplied';
}
