/**
 * Voraussichtliche Ankunft der nächsten Picnic-Lieferung.
 *
 * Zwei Quellen mit unterschiedlicher Reichweite: Das gebuchte **Fenster**
 * steht ab der Bestellung in der Lieferungsliste, die **Live-ETA** gibt
 * Picnic erst, wenn die Tour am Liefertag läuft. Dieses Modul entscheidet,
 * welche Lieferung zählt, ab wann sich die Live-Abfrage lohnt und wie das
 * Ergebnis angezeigt wird.
 *
 * Bewusst rein (kein SvelteKit, kein Picnic): Formatiert wird im Browser,
 * weil der Server im Container in UTC läuft und sonst falsche Uhrzeiten
 * rendern würde.
 */
import { BCP47, type Locale, type Translate } from '#lib/i18n/index.js';

export type DeliveryEta = {
	/** Beginn des gebuchten Fensters (ISO). */
	windowStart: string;
	windowEnd: string | null;
	/** Live-ETA des Fahrers (ISO), nur bei laufender Tour. */
	eta: string | null;
};

/** Ab so viel Zeit vor Fensterbeginn fragt der Server die Fahrerposition ab. */
export const LIVE_LOOKAHEAD_MS = 12 * 3_600_000;

/** Abstand, in dem die Startseite die Lieferzeit am Liefertag neu holt. */
export const DELIVERY_REFRESH_MS = 120_000;

/**
 * Die nächste offene Lieferung: weder zugestellt noch storniert, mit Fenster,
 * das früheste zuerst. Ohne Fenster lässt sich nichts anzeigen.
 */
export function nextOpenDelivery<T extends { status: string; windowStart: string | null }>(list: T[]): T | null {
	let next: T | null = null;
	for (const delivery of list) {
		if (delivery.status === 'COMPLETED' || delivery.status === 'CANCELLED') continue;
		if (!delivery.windowStart || Number.isNaN(Date.parse(delivery.windowStart))) continue;
		if (!next || Date.parse(delivery.windowStart) < Date.parse(next.windowStart!)) next = delivery;
	}
	return next;
}

/**
 * Lohnt sich die Abfrage der Fahrerposition? Erst kurz vor dem Fenster —
 * vorher gibt es keine Tour. Ein schon begonnenes oder verstrichenes Fenster
 * zählt weiter, solange die Lieferung offen ist (Verspätung).
 */
export function wantsLivePosition(windowStart: string, now = new Date()): boolean {
	const start = Date.parse(windowStart);
	if (Number.isNaN(start)) return false;
	return start - now.getTime() < LIVE_LOOKAHEAD_MS;
}

function dayLabel(date: Date, t: Translate, locale: Locale, now: Date): string {
	const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
	if (days === 0) return t('delivery.today');
	if (days === 1) return t('delivery.tomorrow');
	return date.toLocaleDateString(BCP47[locale], { weekday: 'short', day: '2-digit', month: '2-digit' });
}

/**
 * Anzeigetext: vor der Tour Tag + Fenster („Di., 24.11., 18:00–19:00“), mit
 * Live-ETA die genaue Zeit („Heute ca. 18:24“) und das Fenster daneben.
 */
export function deliveryEtaText(
	eta: DeliveryEta,
	t: Translate,
	locale: Locale,
	now = new Date()
): { main: string; window: string | null } {
	const time = (iso: string) =>
		new Date(iso).toLocaleTimeString(BCP47[locale], { hour: '2-digit', minute: '2-digit' });
	const start = new Date(eta.windowStart);
	const range = eta.windowEnd ? `${time(eta.windowStart)}–${time(eta.windowEnd)}` : time(eta.windowStart);

	if (eta.eta && !Number.isNaN(Date.parse(eta.eta))) {
		return {
			main: t('delivery.live', { day: dayLabel(new Date(eta.eta), t, locale, now), time: time(eta.eta) }),
			window: t('delivery.bookedWindow', { range })
		};
	}
	return { main: t('delivery.window', { day: dayLabel(start, t, locale, now), range }), window: null };
}
