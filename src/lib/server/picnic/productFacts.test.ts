import { describe, expect, it } from 'vitest';
import { extractProductFacts, findOrigin, isOrganicLabel } from './productFacts';

describe('isOrganicLabel', () => {
	it('erkennt Bio-Siegel als ganzes Wort', () => {
		expect(isOrganicLabel('Bio')).toBe(true);
		expect(isOrganicLabel('Biologisch')).toBe(true);
		expect(isOrganicLabel('EU-Bio')).toBe(true);
		expect(isOrganicLabel('Demeter')).toBe(true);
		expect(isOrganicLabel('organic')).toBe(true);
	});

	it('lässt Wörter, die nur mit „Bio“ beginnen, außen vor', () => {
		expect(isOrganicLabel('Biotin')).toBe(false);
		expect(isOrganicLabel('Biomarkt Müller')).toBe(false);
		expect(isOrganicLabel('2 für 2.22€')).toBe(false);
	});
});

/** Zusatzinformationen wie live bei Äpfeln Granny Smith (s1026022). */
const apfelInfo =
	'**Hinweise.**\nKlasse: I.\r\nSorte: Granny Smith.\r\nGröße: Siehe Etikett.\n**Ursprungsland**\nFrankreich\n\nDas Ursprungsland kann je nach Angebot abweichen und ist dem Aufdruck am Artikel zu entnehmen.';

describe('findOrigin', () => {
	it('liest das Ursprungsland aus den Zusatzinformationen', () => {
		expect(findOrigin({ infoSections: [{ title: 'Zusätzliche Informationen', content: apfelInfo }] })).toBe('Frankreich');
	});

	it('versteht auch „Herkunft“ und die niederländische Fassung', () => {
		expect(findOrigin({ infoSections: [{ title: 'x', content: '**Herkunft**\nItalien' }] })).toBe('Italien');
		expect(findOrigin({ infoSections: [{ title: 'x', content: '**Land van herkomst**\nSpanje' }] })).toBe('Spanje');
	});

	it('gibt nichts zurück, wenn die Angabe fehlt oder kein Land ist', () => {
		expect(findOrigin({ infoSections: [{ title: 'Zutaten', content: 'Zutaten: Wasser, *Biologischen Urprungs' }] })).toBeNull();
		expect(findOrigin({ infoSections: [{ title: 'x', content: '**Ursprungsland**\nSiehe Etikett auf der Verpackung, die Herkunft wechselt je nach Saison und Lieferant' }] })).toBeNull();
		expect(findOrigin({ infoSections: [{ title: 'x', content: '**Ursprungsland**\n' }] })).toBeNull();
		expect(findOrigin(null)).toBeNull();
	});
});

describe('extractProductFacts', () => {
	it('übernimmt Marke, Bio-Siegel und Nährwerttabelle', () => {
		expect(
			extractProductFacts({
				brand: 'Weihenstephan',
				labels: [{ text: 'Bio' }],
				infoSections: [],
				nutritionRows: [
					{ label: 'Pro 100g', value: null, isCategory: true, backgroundColor: null },
					{ label: 'Brennwert', value: '269 kJ /', isCategory: true, backgroundColor: '#fcfaf9' }
				]
			})
		).toEqual({
			brand: 'Weihenstephan',
			origin: null,
			organic: true,
			nutrition: [
				{ label: 'Pro 100g', value: null, isCategory: true },
				{ label: 'Brennwert', value: '269 kJ /', isCategory: true }
			]
		});
	});

	it('liefert für Obst ohne Marke und Nährwerte die Herkunft', () => {
		expect(
			extractProductFacts({
				brand: null,
				labels: [],
				infoSections: [{ title: 'Zusätzliche Informationen', content: apfelInfo }],
				nutritionRows: []
			})
		).toEqual({ brand: null, origin: 'Frankreich', organic: false, nutrition: null });
	});

	it('verkraftet Datenmüll, ohne zu werfen', () => {
		const empty = { brand: null, origin: null, organic: false, nutrition: null };
		expect(extractProductFacts(null)).toEqual(empty);
		expect(extractProductFacts({ brand: 7, labels: 'Bio', nutritionRows: [{ label: 3 }] })).toEqual(empty);
	});
});
