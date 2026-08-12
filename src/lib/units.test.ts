import { describe, expect, it } from 'vitest';
import { coverageMulti, scaleAmount, toBase, unitFamily, type IngredientArticleStock } from './units';

/** Kurzschreibweise für einen Alternativartikel im Test. */
function article(
	overrides: Partial<IngredientArticleStock> & Pick<IngredientArticleStock, 'id'>
): IngredientArticleStock {
	return {
		packageAmount: 500,
		packageUnit: 'g',
		stockPackages: 0,
		picnicId: null,
		...overrides
	};
}

describe('unitFamily / toBase', () => {
	it('ordnet Einheiten ihrer Familie zu', () => {
		expect(unitFamily('kg')).toBe('mass');
		expect(unitFamily('ml')).toBe('volume');
		expect(unitFamily('Stück')).toBe('count');
		expect(unitFamily('Prise')).toBeNull();
		expect(unitFamily(null)).toBeNull();
	});

	it('rechnet in die Basiseinheit um', () => {
		expect(toBase(1.5, 'kg')).toBe(1500);
		expect(toBase(2, 'l')).toBe(2000);
		expect(toBase(3, 'Stück')).toBe(3);
		expect(toBase(1, 'Prise')).toBeNull();
	});
});

describe('scaleAmount', () => {
	it('skaliert auf die gewünschten Portionen', () => {
		expect(scaleAmount(200, 4, 6)).toBe(300);
	});

	it('lässt die Menge unverändert, wenn die Basisportionen unbrauchbar sind', () => {
		expect(scaleAmount(200, 0, 6)).toBe(200);
	});

	it('reicht null durch', () => {
		expect(scaleAmount(null, 4, 6)).toBeNull();
	});
});

describe('coverageMulti', () => {
	it('deckt den Bedarf aus einem Artikel', () => {
		const result = coverageMulti(800, 'g', [article({ id: 1, stockPackages: 2 })]);
		expect(result).toMatchObject({ covered: true, comparable: true, neededPackages: 0 });
	});

	it('zählt den Bestand über mehrere Alternativartikel zusammen', () => {
		// 6 + 6 Stück decken einen Bedarf von 10, den kein Artikel allein schafft
		const eier = [
			article({ id: 1, packageAmount: 6, packageUnit: 'Stück', stockPackages: 1 }),
			article({ id: 2, packageAmount: 6, packageUnit: 'Stück', stockPackages: 1 })
		];
		expect(coverageMulti(10, 'Stück', eier).covered).toBe(true);
		expect(coverageMulti(13, 'Stück', eier).covered).toBe(false);
	});

	it('ignoriert Artikel mit unpassender Einheitenfamilie', () => {
		const result = coverageMulti(500, 'g', [
			article({ id: 1, packageAmount: 1, packageUnit: 'l', stockPackages: 10 })
		]);
		expect(result.comparable).toBe(false);
	});

	it('meldet nicht vergleichbar, wenn Bedarf oder Gebinde keine Einheit haben', () => {
		expect(coverageMulti(500, null, [article({ id: 1 })]).comparable).toBe(false);
		expect(
			coverageMulti(500, 'g', [article({ id: 1, packageAmount: null, packageUnit: null })]).comparable
		).toBe(false);
	});

	it('rundet die Fehlmenge auf ganze Gebinde auf', () => {
		// 1200 g fehlen bei 500-g-Gebinden -> 3 Packungen
		const result = coverageMulti(1200, 'g', [article({ id: 1, picnicId: 'p1' })]);
		expect(result).toMatchObject({ covered: false, neededPackages: 3, orderPicnicId: 'p1' });
	});

	it('bestellt über den ersten Alternativartikel mit Picnic-Verknüpfung', () => {
		const result = coverageMulti(1000, 'g', [
			article({ id: 1, picnicId: null }),
			article({ id: 2, picnicId: 'p2' })
		]);
		expect(result.orderPicnicId).toBe('p2');
	});

	it('nennt die Fehlmenge auch ohne Picnic-Verknüpfung', () => {
		// Regression: hier stand früher 0 Gebinde, obwohl etwas fehlte
		const result = coverageMulti(1000, 'g', [article({ id: 1, picnicId: null })]);
		expect(result).toMatchObject({ covered: false, neededPackages: 2, orderPicnicId: null });
	});
});
