/**
 * Gewichteter Zufallsvorschlag für Rezepte.
 * Rein und ohne Server-Abhängigkeiten, damit unabhängig testbar.
 */

export type SuggestCandidate = {
	id: number;
	/** Zeitpunkt des letzten Kochens (ms seit Epoch) oder null. */
	lastCookedAt: number | null;
	cookable: boolean;
};

/** Mindestabstand zwischen zwei Vorschlägen desselben Rezepts. */
export const COOLDOWN_DAYS = 14;
/** Zusätzliches Gewicht für aktuell kochbare Rezepte (kleine Rolle). */
export const COOKABLE_WEIGHT = 1.5;
const BASE_WEIGHT = 1;

/** Rezepte, die innerhalb der Sperrfrist gekocht wurden, ausschließen. */
export function withinCooldown(lastCookedAt: number | null, now: number): boolean {
	if (lastCookedAt == null) return false;
	return now - lastCookedAt < COOLDOWN_DAYS * 86_400_000;
}

export function eligible(candidates: SuggestCandidate[], now: number): SuggestCandidate[] {
	return candidates.filter((c) => !withinCooldown(c.lastCookedAt, now));
}

/**
 * Wählt gewichtet-zufällig ein Rezept: grundsätzlich random, kochbare leicht
 * bevorzugt. `rng` liefert [0,1) (injizierbar für Tests). Gibt null zurück,
 * wenn keine Kandidaten übrig sind.
 */
export function pickWeighted(
	candidates: SuggestCandidate[],
	rng: () => number = Math.random
): SuggestCandidate | null {
	if (candidates.length === 0) return null;
	const weights = candidates.map((c) => (c.cookable ? COOKABLE_WEIGHT : BASE_WEIGHT));
	const total = weights.reduce((sum, w) => sum + w, 0);
	let roll = rng() * total;
	for (let i = 0; i < candidates.length; i++) {
		roll -= weights[i];
		if (roll < 0) return candidates[i];
	}
	return candidates[candidates.length - 1];
}
