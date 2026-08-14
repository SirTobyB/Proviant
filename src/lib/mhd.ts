/**
 * Hilfsfunktionen rund um das Mindesthaltbarkeitsdatum (MHD).
 * MHD wird als ISO-Datum (YYYY-MM-DD) gespeichert.
 */
import { BCP47, type Locale, type Translate } from '$lib/i18n';

export type MhdStatus = 'expired' | 'critical' | 'soon' | 'ok' | 'none';

/** Schwellen in Tagen für die Ampel-Bewertung. */
export const MHD_CRITICAL_DAYS = 3;
export const MHD_SOON_DAYS = 14;

/** Ganze Tage bis zum MHD (negativ = bereits abgelaufen); null wenn kein MHD. */
export function daysUntil(bestBefore: string | null, today = new Date()): number | null {
	if (!bestBefore) return null;
	const target = new Date(bestBefore + 'T00:00:00');
	if (Number.isNaN(target.getTime())) return null;
	const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export function mhdStatus(bestBefore: string | null, today = new Date()): MhdStatus {
	const days = daysUntil(bestBefore, today);
	if (days === null) return 'none';
	if (days < 0) return 'expired';
	if (days <= MHD_CRITICAL_DAYS) return 'critical';
	if (days <= MHD_SOON_DAYS) return 'soon';
	return 'ok';
}

/**
 * Kurztext zur Restlaufzeit, z.B. „abgelaufen (3 Tage)", „läuft heute ab".
 *
 * Die Übersetzerfunktion kommt von außen, statt sie hier zu beschaffen: So
 * bleibt das Modul rein (kein globaler Sprachzustand, siehe i18n/translate.ts)
 * und im Test lässt sich jede Sprache einzeln durchspielen.
 */
export function mhdLabel(bestBefore: string | null, t: Translate, today = new Date()): string {
	const days = daysUntil(bestBefore, today);
	if (days === null) return t('mhd.none');
	if (days < 0) return days === -1 ? t('mhd.expiredYesterday') : t('mhd.expired', { n: -days });
	if (days === 0) return t('mhd.today');
	if (days === 1) return t('mhd.tomorrow');
	return t('mhd.inDays', { n: days });
}

/** Datumsanzeige in der Schreibweise der Sprache (de: TT.MM.JJJJ, en-GB: DD/MM/YYYY). */
export function formatDate(bestBefore: string | null, locale: Locale): string {
	if (!bestBefore) return '';
	const date = new Date(bestBefore + 'T00:00:00');
	if (Number.isNaN(date.getTime())) return bestBefore;
	return date.toLocaleDateString(BCP47[locale], {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});
}

/** Tailwind-Klassen für die Ampel-Badge je Status. */
export const MHD_BADGE_CLASSES: Record<MhdStatus, string> = {
	expired: 'bg-red-100 text-red-800',
	critical: 'bg-orange-100 text-orange-800',
	soon: 'bg-amber-100 text-amber-800',
	ok: 'bg-green-100 text-green-700',
	none: 'bg-gray-100 text-gray-500'
};
