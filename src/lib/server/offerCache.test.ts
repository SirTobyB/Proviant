import { describe, expect, it } from 'vitest';
import { mergeOffers, offerCacheState } from './offerCache';

const HOUR = 60 * 60 * 1000;

describe('offerCacheState', () => {
	const now = 100 * HOUR;

	it('unterscheidet frisch, veraltet und abgelaufen', () => {
		expect(offerCacheState(null, now)).toBe('missing');
		expect(offerCacheState(now - 0.5 * HOUR, now)).toBe('fresh');
		expect(offerCacheState(now - 2 * HOUR, now)).toBe('stale');
		// Review: scheitert die Auffrischung dauerhaft, darf der alte Stand nicht ewig gelten
		expect(offerCacheState(now - 25 * HOUR, now)).toBe('expired');
	});
});

describe('mergeOffers', () => {
	const now = 100 * HOUR;
	const price = (promoPrice: number | null) => ({
		regularPrice: 349,
		promoPrice,
		promoLabel: null,
		promoMinQuantity: null,
		priceRanges: null
	});

	// Live: Géramont war im Angebot, stand aber nicht (mehr) auf Picnics Angebotsseite
	it('ergänzt Angebote aus dem Preis-Cache, die die Angebotsseite nicht zeigt', () => {
		const merged = mergeOffers(
			new Map([['s1', price(200)]]),
			new Map([['s2', { ...price(222), fetchedAt: new Date(now - 2 * HOUR) }]]),
			now
		);
		expect([...merged.keys()]).toEqual(['s1', 's2']);
	});

	it('lässt alte und rabattlose Cache-Einträge weg, die Angebotsseite gewinnt', () => {
		const merged = mergeOffers(
			new Map([['s1', price(200)]]),
			new Map([
				['s1', { ...price(300), fetchedAt: new Date(now) }],
				['s2', { ...price(222), fetchedAt: new Date(now - 25 * HOUR) }],
				['s3', { ...price(null), fetchedAt: new Date(now) }]
			]),
			now
		);
		expect([...merged.keys()]).toEqual(['s1']);
		expect(merged.get('s1')?.promoPrice).toBe(200);
	});
});
