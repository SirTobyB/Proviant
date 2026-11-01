import { describe, expect, it } from 'vitest';
import { mapPicnicRecipe, parseNeededText } from './recipeMapping';

describe('parseNeededText', () => {
	it('liest Menge und Einheit aus dem Hinweis der Zutatenkachel', () => {
		expect(parseNeededText('(200 g benötigt)')).toEqual({ amount: 200, unit: 'g' });
		expect(parseNeededText('(0.75 EL benötigt)')).toEqual({ amount: 0.75, unit: 'EL' });
		expect(parseNeededText('(0,5 l benötigt)')).toEqual({ amount: 0.5, unit: 'l' });
		expect(parseNeededText('(1 Tafel benötigt)')).toEqual({ amount: 1, unit: 'Tafel' });
	});

	it('vereinheitlicht Stückangaben wie der bisherige Import', () => {
		expect(parseNeededText('(1.5 Stk. benötigt)')).toEqual({ amount: 1.5, unit: 'Stück' });
		expect(parseNeededText('(2 stuks nodig)')).toEqual({ amount: 2, unit: 'Stück' });
	});

	it('versteht auch die niederländische und englische Fassung', () => {
		expect(parseNeededText('(150 g nodig)')).toEqual({ amount: 150, unit: 'g' });
		expect(parseNeededText('(150 g needed)')).toEqual({ amount: 150, unit: 'g' });
	});

	it('gibt bei fehlendem oder fremdem Text nichts zurück', () => {
		expect(parseNeededText(null)).toEqual({ amount: null, unit: null });
		expect(parseNeededText('irgendwas')).toEqual({ amount: null, unit: null });
		expect(parseNeededText('(0 g benötigt)')).toEqual({ amount: null, unit: null });
	});
});

/** Ausschnitt eines echten `getRecipe()`-Ergebnisses (Fladenbrot mit Hähnchen-Gyros, 4 Portionen). */
const gyros = {
	portions: 4,
	defaultPortions: 4,
	description: 'Der Imbiss-Favorit in der leichten Variante',
	steps: ['Paprika schneiden', 'Hähnchen anbraten'],
	note: null,
	ingredients: [
		{ name: 'Bio Hähnchenbrust', sellingUnitId: 's1054445', type: 'CORE', neededText: '(1 Pck. benötigt)' },
		{ name: 'Zaziki', sellingUnitId: 's1019331', type: 'CORE', neededText: '(200 g benötigt)' },
		{ name: 'Zwiebeln rot', sellingUnitId: 's1021585', type: 'CORE_STOCKABLE', neededText: '(2 Stk. benötigt)' },
		{ name: 'Gyros vegan', sellingUnitId: 's1025979', type: 'VARIATION', neededText: null },
		{ name: 'Sonnenblumenöl', sellingUnitId: 's1018545', type: 'CUPBOARD', neededText: '(2 EL benötigt)' },
		{ name: 'Alpenjodsalz', sellingUnitId: 's1027264', type: 'CUPBOARD', neededText: null },
		{ name: 'Mühlen Chunks natur vegan', sellingUnitId: 's1166061', type: 'CORE', neededText: null },
		{ name: 'Altes Produkt', sellingUnitId: '', type: 'CORE', neededText: '(1 Stk. benötigt)' },
		{ name: null, sellingUnitId: 's9', type: 'CORE', neededText: '(1 Stk. benötigt)' }
	]
};

describe('mapPicnicRecipe', () => {
	const mapped = mapPicnicRecipe(gyros);

	it('übernimmt Portionen, Beschreibung und Schritte', () => {
		expect(mapped.servings).toBe(4);
		expect(mapped.description).toBe('Der Imbiss-Favorit in der leichten Variante');
		expect(mapped.steps).toEqual(['Paprika schneiden', 'Hähnchen anbraten']);
		expect(mapped.tip).toBeNull();
	});

	it('liefert Menge, Einheit und Picnic-ID je Zutat', () => {
		expect(mapped.ingredients[0]).toEqual({
			name: 'Bio Hähnchenbrust',
			amount: 1,
			unit: 'Pck.',
			picnicId: 's1054445',
			pantry: false
		});
	});

	it('markiert Vorratszutaten, auch ohne Mengenangabe', () => {
		const pantry = mapped.ingredients.filter((ing) => ing.pantry).map((ing) => ing.name);
		expect(pantry).toEqual(['Zwiebeln rot', 'Sonnenblumenöl', 'Alpenjodsalz']);
		expect(mapped.ingredients.find((ing) => ing.name === 'Alpenjodsalz')).toMatchObject({ amount: null, unit: null });
	});

	it('nennt die Vorratszutaten als Zusatzzeile im Zubereitungstext', () => {
		expect(mapped.extraLines).toEqual(['Aus dem Vorrat: Zwiebeln rot, Sonnenblumenöl, Alpenjodsalz']);
		expect(mapPicnicRecipe({ ...gyros, ingredients: [] }).extraLines).toEqual([]);
	});

	it('lässt Varianten und Zutaten ohne Mengenangabe weg, die nicht zum Vorrat gehören', () => {
		const names = mapped.ingredients.map((ing) => ing.name);
		expect(names).not.toContain('Gyros vegan');
		expect(names).not.toContain('Mühlen Chunks natur vegan');
	});

	// Review: eine vorhandene, aber nicht lesbare Mengenangabe ist eine echte Zutat
	it('behält Zutaten mit unlesbarer Mengenangabe, nur ohne Menge', () => {
		const odd = mapPicnicRecipe({
			...gyros,
			ingredients: [
				{ name: 'Petersilie', sellingUnitId: 's7', type: 'CORE', neededText: '(½ Bund benötigt)' },
				{ name: 'Tomaten', sellingUnitId: 's8', type: 'CORE', neededText: '(1-2 Stk. benötigt)' }
			]
		});
		expect(odd.ingredients).toEqual([
			{ name: 'Petersilie', amount: null, unit: null, picnicId: 's7', pantry: false },
			{ name: 'Tomaten', amount: null, unit: null, picnicId: 's8', pantry: false }
		]);
	});

	it('behält ausgelaufene Produkte ohne ID und verwirft namenlose', () => {
		expect(mapped.ingredients.find((ing) => ing.name === 'Altes Produkt')).toMatchObject({ picnicId: null });
		expect(mapped.ingredients).toHaveLength(6);
	});

	it('nimmt bei eigenen Rezepten ohne Schritte die Notiz als Text', () => {
		const own = mapPicnicRecipe({ ...gyros, steps: [], note: '<p>Erst anbraten, <b>dann</b> köcheln</p>' });
		expect(own.steps).toEqual(['Erst anbraten, dann köcheln']);
	});

	it('verkraftet Datenmüll, ohne zu werfen', () => {
		expect(mapPicnicRecipe(null).ingredients).toEqual([]);
		expect(mapPicnicRecipe({ ingredients: 'kaputt' }).servings).toBeNull();
	});
});
