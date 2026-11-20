<script lang="ts">
	/**
	 * Hinweis auf die nächste Picnic-Lieferung (Startseite, Bestellseite).
	 *
	 * Die Lieferzeit kommt gestreamt als Promise. Der letzte Wert wird hier
	 * festgehalten, statt `{#await}` zu nutzen: Beim Nachladen zeigte `{#await}`
	 * sonst kurz nichts an, und die Karte flackerte alle zwei Minuten.
	 * Formatiert wird nur im Browser — der Server rechnet in UTC.
	 */
	import { invalidate } from '$app/navigation';
	import { DELIVERY_REFRESH_MS, deliveryEtaText, wantsLivePosition, type DeliveryEta } from '#lib/deliveryEta.js';
	import { translator, type Locale } from '#lib/i18n/index.js';

	let {
		delivery,
		locale,
		autoRefresh = false
	}: { delivery: Promise<DeliveryEta | null> | null; locale: Locale; autoRefresh?: boolean } = $props();

	const t = $derived(translator(locale));
	let current = $state<DeliveryEta | null>(null);

	$effect(() => {
		let cancelled = false;
		if (!delivery) current = null;
		else delivery.then((value) => !cancelled && (current = value));
		return () => (cancelled = true);
	});

	// Am Liefertag nachladen, nur bei sichtbarem Tab
	$effect(() => {
		if (!autoRefresh || !current || !wantsLivePosition(current.windowStart)) return;
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') invalidate('app:delivery');
		}, DELIVERY_REFRESH_MS);
		return () => clearInterval(timer);
	});

	const text = $derived(current ? deliveryEtaText(current, t, locale) : null);
</script>

{#if text}
	<div class="mt-4 max-w-2xl rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">
		<div class="font-medium">🚚 {t('delivery.heading')}</div>
		<div class="mt-0.5">
			<span class="text-base font-semibold">{text.main}</span>
			{#if text.window}<span class="text-green-700"> · {text.window}</span>{/if}
		</div>
	</div>
{/if}
