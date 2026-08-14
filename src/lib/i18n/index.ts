/**
 * Sammelstelle für die Oberflächensprachen — client- und servertauglich.
 * Komponenten und Server-Actions importieren nur von hier.
 */
export {
	BCP47,
	DEFAULT_LOCALE,
	LOCALES,
	LOCALE_LABEL,
	isLocale,
	localeFromHeader,
	resolveLocale,
	type Locale
} from './locales';
export { translator, type MessageKey, type Translate, type TranslateParams } from './translate';
