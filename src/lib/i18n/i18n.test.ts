import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, isLocale, localeFromHeader, resolveLocale } from './locales';
import { translator } from './translate';
import { en } from './messages/en';
import { de } from './messages/de';
import { nl } from './messages/nl';

describe('localeFromHeader', () => {
	it('nimmt die erste unterstützte Sprache', () => {
		expect(localeFromHeader('de-DE,de;q=0.9,en;q=0.8')).toBe('de');
	});

	it('schneidet die Region ab: de-AT zählt als Deutsch', () => {
		expect(localeFromHeader('de-AT')).toBe('de');
	});

	it('richtet sich nach den q-Gewichten, nicht nach der Reihenfolge', () => {
		// Französisch steht vorn, ist aber nicht unterstützt; nl schlägt en
		expect(localeFromHeader('fr-FR,fr;q=1.0,en;q=0.5,nl;q=0.9')).toBe('nl');
	});

	it('überspringt nicht unterstützte Sprachen', () => {
		expect(localeFromHeader('fr-FR,it;q=0.9,en-GB;q=0.7')).toBe('en');
	});

	it('liefert null ohne Treffer oder ohne Header', () => {
		expect(localeFromHeader('fr-FR,it;q=0.9')).toBeNull();
		expect(localeFromHeader('')).toBeNull();
		expect(localeFromHeader(null)).toBeNull();
	});

	it('ignoriert Einträge mit q=0 (ausdrücklich abgelehnt)', () => {
		expect(localeFromHeader('de;q=0,en;q=0.5')).toBe('en');
	});
});

describe('resolveLocale', () => {
	it('nimmt die Benutzerwahl vor allem anderen', () => {
		expect(resolveLocale({ user: 'nl', cookie: 'de', acceptLanguage: 'en' })).toBe('nl');
	});

	it('nimmt das Cookie, wenn der Benutzer nichts gewählt hat', () => {
		expect(resolveLocale({ user: null, cookie: 'de', acceptLanguage: 'en' })).toBe('de');
	});

	it('fällt auf die Systemsprache zurück', () => {
		expect(resolveLocale({ user: null, cookie: null, acceptLanguage: 'nl-NL,nl;q=0.9' })).toBe('nl');
	});

	it('landet ohne jeden Hinweis bei Englisch', () => {
		expect(resolveLocale({})).toBe(DEFAULT_LOCALE);
		expect(DEFAULT_LOCALE).toBe('en');
	});

	it('ignoriert Unsinn in Benutzerwahl und Cookie', () => {
		expect(resolveLocale({ user: 'klingon', cookie: 'xx', acceptLanguage: 'de' })).toBe('de');
	});
});

describe('isLocale', () => {
	it('erkennt nur die drei Sprachen', () => {
		expect(isLocale('en')).toBe(true);
		expect(isLocale('de')).toBe(true);
		expect(isLocale('nl')).toBe(true);
		expect(isLocale('de-DE')).toBe(false);
		expect(isLocale(null)).toBe(false);
	});
});

describe('translator', () => {
	it('übersetzt in die gewählte Sprache', () => {
		expect(translator('en')('account.language.title')).toBe('Language');
		expect(translator('de')('account.language.title')).toBe('Sprache');
		expect(translator('nl')('account.language.title')).toBe('Taal');
	});

	it('setzt Platzhalter ein', () => {
		expect(translator('en')('account.language.system', { name: 'Deutsch' })).toBe(
			'System language (Deutsch)'
		);
	});

	it('lässt unbekannte Platzhalter stehen, statt sie zu leeren', () => {
		expect(translator('en')('account.language.system', { falsch: 'x' })).toBe(
			'System language ({name})'
		);
	});

	it('wählt die Pluralform nach der Zahl', () => {
		const t = translator('en');
		expect(t('common.packs', { n: 1 })).toBe('1 pack');
		expect(t('common.packs', { n: 5 })).toBe('5 packs');
	});

	it('behandelt 0 im Englischen als Plural', () => {
		// Klassischer Stolperstein: "0 pack" wäre falsch
		expect(translator('en')('common.packs', { n: 0 })).toBe('0 packs');
	});

	it('kommt mit Sprachen klar, die für beide Zahlen dieselbe Form nutzen', () => {
		const t = translator('de');
		expect(t('common.packs', { n: 1 })).toBe('1 Gebinde');
		expect(t('common.packs', { n: 139 })).toBe('139 Gebinde');
	});

	it('unterscheidet im Niederländischen Singular und Plural', () => {
		const t = translator('nl');
		expect(t('common.packs', { n: 1 })).toBe('1 verpakking');
		expect(t('common.packs', { n: 3 })).toBe('3 verpakkingen');
	});
});

describe('Wörterbücher', () => {
	it('haben in allen Sprachen dieselben Schlüssel', () => {
		const schluessel = Object.keys(en).sort();
		expect(Object.keys(de).sort()).toEqual(schluessel);
		expect(Object.keys(nl).sort()).toEqual(schluessel);
	});

	it('haben nirgends leere Texte', () => {
		for (const [sprache, woerterbuch] of Object.entries({ en, de, nl })) {
			for (const [schluessel, text] of Object.entries(woerterbuch)) {
				expect(text.trim(), `${sprache}: ${schluessel}`).not.toBe('');
			}
		}
	});

	it('verwenden in jeder Sprache dieselben Platzhalter', () => {
		// Ein vergessenes {name} in einer Übersetzung fällt sonst erst im Betrieb auf
		const platzhalter = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(',');
		for (const [schluessel, text] of Object.entries(en)) {
			expect(platzhalter(de[schluessel as keyof typeof de]), `de: ${schluessel}`).toBe(
				platzhalter(text)
			);
			expect(platzhalter(nl[schluessel as keyof typeof nl]), `nl: ${schluessel}`).toBe(
				platzhalter(text)
			);
		}
	});
});
