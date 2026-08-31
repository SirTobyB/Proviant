/**
 * Was kostet ein Rezept — reine Rechnung, client- und servertauglich.
 *
 * Zwei Sichten, die bewusst getrennt bleiben:
 *   - `toOrder`: nur was der Vorrat nicht deckt („was muss ich kaufen")
 *   - `all`:     alle Zutaten, als wäre nichts da („was kostet das Gericht")
 *
 * Gerechnet wird auf **ganze Gebinde** — man kauft keine halbe Packung. Der
 * Preis pro Portion ist deshalb die Gebindesumme geteilt durch die Portionen
 * und springt bei kleinen Portionszahlen; das ist die ehrliche Zahl für
 * „was kostet mich das heute".
 */
import { effectivePrice, savingsOf, type PriceParts } from '$lib/prices';
import { coverageMulti, scaleAmount, type IngredientArticleStock } from '$lib/units';

export type CostPrice = PriceParts;

export type CostArticle = IngredientArticleStock & { name: string };

export type CostIngredient = {
	amount: number | null;
	unit: string | null;
	freeText: string | null;
	articles: CostArticle[];
};

export type CostBlock = {
	/** Tatsächlich zu zahlen, in Cent (Aktionspreis, wo vorhanden). */
	total: number;
	/** Ersparnis gegenüber den Normalpreisen, in Cent. */
	savings: number;
	/** `total` je Portion, **ungerundet** — gerundet wird nur in der Anzeige. */
	perPortion: number;
	/** `false` = die Summe ist eine Untergrenze, es fehlen Preise. */
	complete: boolean;
	/** Zutaten, für die kein Preis ermittelbar war. */
	unpriced: string[];
};

type Accumulator = { total: number; savings: number; unpriced: string[] };

function emptyAccumulator(): Accumulator {
	return { total: 0, savings: 0, unpriced: [] };
}

// Rabattrechnung bewusst aus `$lib/prices` statt hier noch einmal von Hand:
// Ein Vorzeichenfehler verbucht einen Rabatt als Aufschlag, und dieser Fehler
// darf nur an einer einzigen Stelle möglich sein.
function add(accumulator: Accumulator, price: CostPrice, packages: number): void {
	accumulator.total += effectivePrice(price) * packages;
	accumulator.savings += savingsOf(price) * packages;
}

function toBlock(accumulator: Accumulator, portions: number): CostBlock {
	return {
		total: accumulator.total,
		savings: accumulator.savings,
		perPortion: portions > 0 ? accumulator.total / portions : 0,
		complete: accumulator.unpriced.length === 0,
		unpriced: accumulator.unpriced
	};
}

export function recipeCost(input: {
	ingredients: CostIngredient[];
	baseServings: number;
	portions: number;
	prices: Map<string, CostPrice>;
}): { toOrder: CostBlock; all: CostBlock } {
	const { ingredients, baseServings, portions, prices } = input;
	const toOrder = emptyAccumulator();
	const all = emptyAccumulator();

	for (const ingredient of ingredients) {
		// Freitext-Zutaten („Salz nach Gefühl") tragen nichts bei und fehlen
		// auch nicht — sie sind gar nicht bestellbar gemeint.
		if (ingredient.articles.length === 0 || ingredient.amount == null) continue;

		const label = ingredient.articles.map((a) => a.name).join(' / ');
		const scaled = scaleAmount(ingredient.amount, baseServings, portions) ?? 0;
		const coverage = coverageMulti(scaled, ingredient.unit, ingredient.articles);

		// Ohne vergleichbare Einheit lässt sich kein Gebinde bestimmen — dann
		// ist die Zutat in beiden Sichten unbezifferbar.
		if (!coverage.comparable) {
			toOrder.unpriced.push(label);
			all.unpriced.push(label);
			continue;
		}

		const price = coverage.orderPicnicId ? prices.get(coverage.orderPicnicId) : undefined;

		// Gedeckte Zutat: in `toOrder` ist wirklich nichts zu kaufen, ein
		// fehlender Preis macht diesen Block deshalb **nicht** unvollständig.
		if (coverage.neededPackages > 0) {
			if (price) add(toOrder, price, coverage.neededPackages);
			else toOrder.unpriced.push(label);
		}

		if (coverage.fullPackages > 0) {
			if (price) add(all, price, coverage.fullPackages);
			else all.unpriced.push(label);
		}
	}

	return { toOrder: toBlock(toOrder, portions), all: toBlock(all, portions) };
}
