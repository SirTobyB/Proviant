import { describe, expect, it } from 'vitest';
import { tileName } from './tiles';

describe('tileName', () => {
	it('stellt das Präfix mit Leerzeichen voran', () => {
		expect(tileName({ namePrefix: 'Bio', name: 'Zitronen' })).toBe('Bio Zitronen');
		expect(tileName({ namePrefix: 'Bio', name: 'H-Vollmilch 3,8%' })).toBe('Bio H-Vollmilch 3,8%');
	});

	it('klebt einen klein beginnenden Rest ans Präfix (mitten im Wort getrennt)', () => {
		expect(tileName({ namePrefix: 'Bio', name: 'land Frische Milch 3,8%' })).toBe('Bioland Frische Milch 3,8%');
	});

	it('lässt Namen ohne Präfix unverändert', () => {
		expect(tileName({ namePrefix: null, name: 'Eisbergsalat' })).toBe('Eisbergsalat');
		expect(tileName({ name: 'Rucola' })).toBe('Rucola');
		expect(tileName({ namePrefix: '  ', name: 'Rucola' })).toBe('Rucola');
	});

	it('fällt bei leerem Namen auf das Präfix zurück', () => {
		expect(tileName({ namePrefix: 'Bio', name: '' })).toBe('Bio');
	});
});
