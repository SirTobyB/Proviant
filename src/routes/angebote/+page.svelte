<script lang="ts">
	import OfferBadge from '#lib/components/OfferBadge.svelte';
	import CartButton from '#lib/components/CartButton.svelte';
	import { packageSize } from '#lib/format.js';
	import { translator } from '#lib/i18n/index.js';

	let { data, form } = $props();

	const t = $derived(translator(data.locale));
</script>

<svelte:head><title>{t('offers.title')} – Proviant</title></svelte:head>

<h1 class="text-2xl font-bold">{t('offers.title')}</h1>
<p class="mt-1 text-sm text-gray-500">{t('offers.subtitle')}</p>

{#if form && 'cartMessage' in form && form.cartMessage}
	<div class="mt-4 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.cartMessage}</div>
{/if}

{#if data.connection !== 'connected'}
	<div class="mt-6 max-w-2xl rounded-xl border border-gray-200 bg-white p-6 text-center">
		<div class="text-3xl">🔌</div>
		<p class="mt-2 font-medium">{t('recipeImport.notConnected')}</p>
		<p class="mt-1 text-sm text-gray-500">
			{t('recipeImport.connectBefore')}<a href="/bestellen" class="text-green-700 underline">{t('nav.order')}</a>{t('recipeImport.connectAfter')}
		</p>
	</div>
{:else if data.items.length === 0}
	<div class="mt-6 max-w-2xl rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
		{t('offers.empty')}
	</div>
{:else}
	<ul class="mt-4 max-w-2xl divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
		{#each data.items as item (item.id)}
			{@const short = item.minStock > 0 && item.stock < item.minStock}
			<li class="flex items-start gap-3 px-4 py-3">
				<a href={`/artikel/${item.id}`} class="shrink-0">
					{#if item.imagePath}
						<img src={`/api/images/${item.imagePath}`} alt="" loading="lazy" class="h-12 w-12 rounded-lg border border-gray-100 bg-white object-contain" />
					{:else}
						<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-lg">📦</div>
					{/if}
				</a>
				<div class="min-w-0 flex-1">
					<a href={`/artikel/${item.id}`} class="block truncate font-medium hover:underline">{item.name}</a>
					<div class="text-xs text-gray-500">
						{packageSize(item.amount, item.unit, data.locale, t)}
						· <span class={short ? 'font-semibold text-amber-600' : ''}>{t('order.stock', { stock: item.stock, min: item.minStock })}</span>
					</div>
					<div class="mt-1.5">
						<OfferBadge price={item.price} locale={data.locale} />
					</div>
				</div>
				<CartButton articleId={item.id} inCart={data.cart && item.picnicId ? (data.cart[item.picnicId] ?? 0) : null} {t} compact />
			</li>
		{/each}
	</ul>
{/if}
