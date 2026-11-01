<script lang="ts">
	import { formatPrice } from '#lib/format.js';
	import { discountPercent } from '#lib/offers.js';
	import { translator, type Locale } from '#lib/i18n/index.js';

	/**
	 * Ein Picnic-Angebot in einheitlicher Form: Stückpreis statt Normalpreis,
	 * bei Mehrfachangeboten mit Mindestmenge. `compact` ist das kleine Abzeichen
	 * für Listen.
	 */
	let {
		price,
		locale,
		compact = false
	}: {
		price: { regularPrice: number; promoPrice: number | null; promoMinQuantity: number | null; promoLabel: string | null };
		locale: Locale;
		compact?: boolean;
	} = $props();

	const t = $derived(translator(locale));
	const percent = $derived(discountPercent(price));
	const minQuantity = $derived(price.promoMinQuantity != null && price.promoMinQuantity > 1 ? price.promoMinQuantity : null);
</script>

{#if price.promoPrice != null}
	{#if compact}
		<span class="rounded bg-green-50 px-1.5 py-0.5 font-medium text-green-700">{t('offers.badge', { percent })}</span>
	{:else}
		<div class="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
			<span class="font-semibold">{t('offers.onOffer')}</span>
			{t('offers.unitPrice', {
				price: formatPrice(price.promoPrice, locale),
				regular: formatPrice(price.regularPrice, locale)
			})}
			{#if minQuantity}· {t('offers.fromQuantity', { n: minQuantity })}{/if}
			<span class="text-green-700">(−{percent} %)</span>
			{#if price.promoLabel}
				<div class="mt-0.5 text-xs text-green-700">{t('offers.picnicLabel', { label: price.promoLabel })}</div>
			{/if}
		</div>
	{/if}
{/if}
