import { describe, expect, it } from 'vitest';
import { parseChangelog } from './changelog';

const BEISPIEL = `# Changelog

Alle nennenswerten Änderungen …

## [Unveröffentlicht]

## [1.1.0] - 2026-09-01

Kurze Einordnung der Version.

### Hinzugefügt

- **Wochenplan** für sieben Tage mit gebündelter
  Einkaufsliste
- Zweiter Punkt

### Behoben

- Leere Mengenfelder nach dem Bestellen

## [1.0.0] - 2026-08-13

### Hinzugefügt

- Erste Fassung

[1.0.0]: https://example.invalid/tag/v1.0.0
`;

describe('parseChangelog', () => {
	const versionen = parseChangelog(BEISPIEL);

	it('lässt leere Versionen wie „Unveröffentlicht" weg', () => {
		expect(versionen.map((v) => v.version)).toEqual(['1.1.0', '1.0.0']);
	});

	it('liest Version, Datum und Einordnung', () => {
		expect(versionen[0]).toMatchObject({
			version: '1.1.0',
			date: '2026-09-01',
			note: 'Kurze Einordnung der Version.'
		});
		expect(versionen[1].note).toBeNull();
	});

	it('setzt eine umbrochene Einordnung wieder zusammen', () => {
		// Die Absätze in CHANGELOG.md sind auf 80 Zeichen umbrochen — nur die
		// erste Zeile zu nehmen hieße, die Notiz mitten im Satz abzuschneiden
		const [version] = parseChangelog(
			`## [3.0.0] - 2026-10-01\n\nDer Image-Pfad hat sich geändert; ein Pull gegen den alten Pfad\nliefert ab hier keine Aktualisierungen mehr.\n\n### Geändert\n\n- Neuer Name\n`
		);
		expect(version.note).toBe(
			'Der Image-Pfad hat sich geändert; ein Pull gegen den alten Pfad liefert ab hier keine Aktualisierungen mehr.'
		);
	});

	it('gruppiert die Einträge nach Kategorie', () => {
		expect(versionen[0].sections.map((s) => s.title)).toEqual(['Hinzugefügt', 'Behoben']);
		expect(versionen[0].sections[1].entries).toEqual([
			{ label: null, text: 'Leere Mengenfelder nach dem Bestellen' }
		]);
	});

	it('fasst umgebrochene Listenpunkte zusammen und trennt die Hervorhebung ab', () => {
		expect(versionen[0].sections[0].entries[0]).toEqual({
			label: 'Wochenplan',
			text: 'für sieben Tage mit gebündelter Einkaufsliste'
		});
	});

	it('übernimmt keine Link-Definitionen als Inhalt', () => {
		const texte = versionen.flatMap((v) => v.sections.flatMap((s) => s.entries.map((e) => e.text)));
		expect(texte.some((t) => t.includes('example.invalid'))).toBe(false);
		expect(versionen[1].note).toBeNull();
	});

	it('verträgt eine leere Datei', () => {
		expect(parseChangelog('')).toEqual([]);
	});
});
