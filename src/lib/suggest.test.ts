import { describe, expect, it } from 'vitest';
import { COOLDOWN_DAYS, eligible, pickWeighted, withinCooldown, type SuggestCandidate } from './suggest';

const NOW = Date.UTC(2026, 4, 20);
const daysAgo = (days: number) => NOW - days * 86_400_000;

describe('withinCooldown', () => {
	it('sperrt kürzlich Gekochtes', () => {
		expect(withinCooldown(daysAgo(COOLDOWN_DAYS - 1), NOW)).toBe(true);
	});

	it('gibt es nach Ablauf der Sperre wieder frei', () => {
		expect(withinCooldown(daysAgo(COOLDOWN_DAYS + 1), NOW)).toBe(false);
	});

	it('behandelt nie Gekochtes als frei', () => {
		expect(withinCooldown(null, NOW)).toBe(false);
	});
});

describe('eligible', () => {
	it('filtert gesperrte Rezepte heraus', () => {
		const candidates: SuggestCandidate[] = [
			{ id: 1, lastCookedAt: daysAgo(2), cookable: true },
			{ id: 2, lastCookedAt: daysAgo(30), cookable: false },
			{ id: 3, lastCookedAt: null, cookable: false }
		];
		expect(eligible(candidates, NOW).map((c) => c.id)).toEqual([2, 3]);
	});
});

describe('pickWeighted', () => {
	const candidates: SuggestCandidate[] = [
		{ id: 1, lastCookedAt: null, cookable: true }, // Gewicht 1.5
		{ id: 2, lastCookedAt: null, cookable: false } // Gewicht 1.0
	];

	it('gibt ohne Kandidaten null zurück', () => {
		expect(pickWeighted([])).toBeNull();
	});

	it('wählt anhand des Zufallswerts über die gewichtete Strecke', () => {
		// Gesamtgewicht 2.5: alles unter 1.5 trifft das kochbare Rezept
		expect(pickWeighted(candidates, () => 0)?.id).toBe(1);
		expect(pickWeighted(candidates, () => 0.59)?.id).toBe(1); // 1.475
		expect(pickWeighted(candidates, () => 0.61)?.id).toBe(2); // 1.525
		expect(pickWeighted(candidates, () => 0.999)?.id).toBe(2);
	});

	it('bevorzugt kochbare Rezepte, schließt die anderen aber nicht aus', () => {
		const treffer = new Set<number>();
		for (let i = 0; i < 100; i++) treffer.add(pickWeighted(candidates, () => i / 100)!.id);
		expect([...treffer].sort()).toEqual([1, 2]);
	});
});
