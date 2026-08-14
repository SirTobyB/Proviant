/**
 * Nachschlagen und Einsetzen von Texten.
 *
 * Bewusst ohne Bibliothek: drei Sprachen brauchen kein Build-Werkzeug, und die
 * Typisierung gegen `en.ts` fängt fehlende Übersetzungen schon beim
 * `npm run check` ab.
 *
 * **Wichtig:** Hier liegt *kein* Modul-Zustand mit der „aktuellen" Sprache.
 * Der Node-Prozess bedient alle Anfragen gleichzeitig — eine solche Variable
 * würde die Sprache zwischen parallelen Requests vertauschen. Deshalb bindet
 * `translator(locale)` die Sprache in einen Funktionsabschluss, den der
 * Aufrufer explizit weiterreicht.
 */
import { BCP47, type Locale } from './locales';
import { en, type Messages } from './messages/en';
import { de } from './messages/de';
import { nl } from './messages/nl';

const DICTIONARIES: Record<Locale, Messages> = { en, de, nl };

type RawKey = keyof typeof en;
/** Zählbare Schlüssel werden ohne `_one`/`_other` aufgerufen. */
type PluralBase<K> = K extends `${infer Base}_one` ? Base : never;
export type MessageKey = Exclude<RawKey, `${string}_one` | `${string}_other`> | PluralBase<RawKey>;

export type TranslateParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: TranslateParams) => string;

/** Ersetzt `{name}`-Platzhalter; Unbekanntes bleibt unangetastet stehen. */
function interpolate(text: string, params: TranslateParams | undefined): string {
	if (!params) return text;
	return text.replace(/\{(\w+)\}/g, (treffer, name: string) =>
		name in params ? String(params[name]) : treffer
	);
}

/**
 * Liefert die Übersetzerfunktion für eine Sprache.
 *
 * Enthält `params.n` eine Zahl und gibt es zum Schlüssel Pluralvarianten, wählt
 * `Intl.PluralRules` die passende (de/en/nl kennen nur `one` und `other`, die
 * Regeln unterscheiden sich aber: „0" ist im Englischen `other`).
 */
export function translator(locale: Locale): Translate {
	const dictionary = DICTIONARIES[locale];
	const pluralRules = new Intl.PluralRules(BCP47[locale]);

	return (key, params) => {
		const n = params?.n;
		if (typeof n === 'number') {
			const kategorie = pluralRules.select(n);
			// Sprachen ohne eigene Form für die Kategorie fallen auf `other` zurück
			const variante = `${key}_${kategorie}` as RawKey;
			const ersatz = `${key}_other` as RawKey;
			const text = dictionary[variante] ?? dictionary[ersatz];
			if (text !== undefined) return interpolate(text, params);
		}
		const text = dictionary[key as RawKey];
		// Nur erreichbar, wenn ein Schlüssel zur Laufzeit hereingereicht wurde
		// (die Typen schließen es aus) — dann ist der Schlüssel selbst die
		// ehrlichste Anzeige, statt eine leere Stelle zu hinterlassen.
		return text === undefined ? String(key) : interpolate(text, params);
	};
}
