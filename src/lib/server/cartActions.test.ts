import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Ein Warenkorb im Speicher statt Picnic. Der Adapter selbst braucht
 * SvelteKit-Umgebung und Netz; hier zählt nur, was die Aktionen damit tun.
 */
const basket = new Map<string, number>();
let failAddFor: string | null = null;

vi.mock('#lib/server/picnic/index.js', () => ({
	getCartQuantities: async () => new Map(basket),
	addToCart: async (items: { productId: string; quantity: number }[]) => {
		for (const item of items) {
			if (item.productId === failAddFor) throw new Error('Picnic nicht erreichbar');
			basket.set(item.productId, (basket.get(item.productId) ?? 0) + item.quantity);
		}
	},
	removeFromCart: async (productId: string, count: number) => {
		const left = (basket.get(productId) ?? 0) - count;
		if (left > 0) basket.set(productId, left);
		else basket.delete(productId);
	}
}));

const { swapCartLine } = await import('./cartActions');

describe('swapCartLine', () => {
	beforeEach(() => {
		basket.clear();
		failAddFor = null;
		basket.set('alt', 2);
	});

	it('tauscht in gleicher Menge', async () => {
		expect(await swapCartLine('alt', 'neu')).toBe('ok');
		expect(Object.fromEntries(basket)).toEqual({ neu: 2 });
	});

	// Review: wirft das Hinzufügen des Ersatzes, darf das Original nicht verloren gehen
	it('legt das Original zurück, wenn das Hinzufügen des Ersatzes scheitert', async () => {
		failAddFor = 'neu';
		await expect(swapCartLine('alt', 'neu')).rejects.toThrow('Picnic nicht erreichbar');
		expect(Object.fromEntries(basket)).toEqual({ alt: 2 });
	});
});
