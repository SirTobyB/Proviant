<script lang="ts">
	import { articleFilterHref, packageSize } from '#lib/format.js';
	import { keepValues } from '#lib/forms.js';
	import { enhance } from '$app/forms';
	import { translator } from '#lib/i18n/index.js';
	import OfferBadge from '#lib/components/OfferBadge.svelte';
	import CartButton from '#lib/components/CartButton.svelte';

	let { data, form } = $props();

	const t = $derived(translator(data.locale));

	// Buchungsmenge je Artikel für die Schnellkorrektur (Default 1)
	let quantities = $state<Record<number, number>>({});

	function quantityFor(id: number): number {
		const q = quantities[id];
		return Number.isInteger(q) && q >= 1 ? q : 1;
	}


	const tagHref = (tag: string) => articleFilterHref(data.filters, { tag });
	const anyFilter = $derived(Boolean(data.query || data.filters.tag || data.filters.noLocation || data.filters.offers));
</script>

<svelte:head><title>{t('items.title')} – Proviant</title></svelte:head>

<div class="flex flex-wrap items-center justify-between gap-3">
	<div>
		<h1 class="text-2xl font-bold">{t('items.title')}</h1>
		<p class="mt-1 text-sm text-gray-500">{t('items.count', { n: data.articles.length })}</p>
	</div>
	<div class="flex flex-wrap gap-2">
		<a
			href="/artikel/import"
			class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
		>
			⬇ {t('items.picnicImport')}
		</a>
		<a
			href="/artikel/neu"
			class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
		>
			+ {t('items.new')}
		</a>
	</div>
</div>

<form method="GET" class="mt-4 max-w-md">
	<input
		type="search"
		name="q"
		value={data.query}
		placeholder={t('items.search')}
		class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
	/>
	{#if data.tagFilter}<input type="hidden" name="tag" value={data.tagFilter} />{/if}
	{#if data.filters.noLocation}<input type="hidden" name="ohneLagerort" value="1" />{/if}
	{#if data.filters.offers}<input type="hidden" name="angebot" value="1" />{/if}
</form>

<div class="mt-3 flex max-w-2xl flex-wrap gap-1.5">
	<a
		href={articleFilterHref(data.filters, { noLocation: !data.filters.noLocation })}
		class="rounded-full px-3 py-1 text-sm font-medium {data.filters.noLocation ? 'bg-green-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}"
	>
		{t('items.filter.noLocation')}
	</a>
	<a
		href={articleFilterHref(data.filters, { offers: !data.filters.offers })}
		class="rounded-full px-3 py-1 text-sm font-medium {data.filters.offers ? 'bg-green-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}"
	>
		{t('items.filter.offers')}
	</a>
</div>

{#if data.allTags.length > 0}
	<div class="mt-3 flex max-w-2xl flex-wrap gap-1.5">
		{#each data.allTags as tag (tag)}
			<a
				href={tagHref(tag)}
				class="rounded-full px-3 py-1 text-sm font-medium {tag === data.tagFilter ? 'bg-green-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}"
			>
				{tag}
			</a>
		{/each}
	</div>
{/if}

{#if form && 'cartMessage' in form && form.cartMessage}
	<div class="mt-4 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.cartMessage}</div>
{/if}

{#if data.articles.length === 0}
	<div class="mt-8 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
		{anyFilter ? t('items.emptyFiltered') : t('items.empty')}
	</div>
{:else}
	<ul class="mt-4 max-w-2xl divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
		{#each data.articles as article (article.id)}
			<li class="flex items-center gap-2 pr-3 hover:bg-green-50">
				<a href={`/artikel/${article.id}`} class="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4">
					{#if article.imagePath}
						<img
							src={`/api/images/${article.imagePath}`}
							alt=""
							loading="lazy"
							class="h-12 w-12 shrink-0 rounded-lg border border-gray-100 bg-white object-contain"
						/>
					{:else}
						<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg">📦</div>
					{/if}
					<span class="min-w-0 flex-1">
						<span class="block truncate font-medium">{article.name}</span>
						<span class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
							{#if packageSize(article.amount, article.unit, data.locale, t)}
								<span>{packageSize(article.amount, article.unit, data.locale, t)}</span>
							{/if}
							{#if article.ean}
								<span class="rounded bg-gray-100 px-1.5 py-0.5">EAN</span>
							{/if}
							{#if article.picnicId}
								<span class="rounded bg-red-50 px-1.5 py-0.5 text-red-600">Picnic</span>
								{#await data.offers then offers}
									{#if offers[article.picnicId]}
										<OfferBadge price={offers[article.picnicId]} locale={data.locale} compact />
									{/if}
								{/await}
							{/if}
							{#each article.tags.slice(0, 3) as tag (tag)}
								<span class="rounded-full bg-green-50 px-1.5 py-0.5 text-green-700">{tag}</span>
							{/each}
						</span>
					</span>
				</a>
				<!-- Warenkorb-Knopf erst ab Tablet-Breite: auf 375 px kürzte er die Namen
				     bis zur Unlesbarkeit; auf dem Handy liegt er auf der Artikelseite -->
				{#if article.picnicId}
					<div class="hidden sm:block">
					{#await data.cart}
						<CartButton articleId={article.id} inCart={null} {t} compact />
					{:then cart}
						<CartButton articleId={article.id} inCart={cart ? (cart[article.picnicId] ?? 0) : null} {t} compact />
					{/await}
					</div>
				{/if}
				<!-- Schnell-Bestandskorrektur: Menge (Default 1) wirkt auf − und + -->
				<!-- reset: false — sonst verliert das versteckte Mengenfeld nach dem ersten Klick seinen Wert -->
				<form method="POST" action="?/bookOut" use:enhance={keepValues}>
					<input type="hidden" name="articleId" value={article.id} />
					<input type="hidden" name="quantity" value={quantityFor(article.id)} />
					<button type="submit" disabled={article.stock === 0} class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30" aria-label={t('items.bookOut')}>−</button>
				</form>
				<div class="w-14 shrink-0 text-center">
					<input
						type="number"
						min="1"
						max="999"
						inputmode="numeric"
						value={quantityFor(article.id)}
						oninput={(e) => (quantities[article.id] = Number(e.currentTarget.value))}
						aria-label={t('items.quantityLabel')}
						class="w-14 rounded-lg border-gray-300 px-1 py-1 text-center text-sm focus:border-green-600 focus:ring-green-600"
					/>
					<span class="mt-0.5 block text-xs font-semibold {article.stock === 0 ? 'text-gray-400' : 'text-gray-600'}">{article.stock}×</span>
					{#if article.minStock > 0 && article.stock < article.minStock}
						<span class="block text-[10px] text-amber-600">{t('items.minStock', { n: article.minStock })}</span>
					{/if}
				</div>
				<form method="POST" action="?/bookIn" use:enhance={keepValues}>
					<input type="hidden" name="articleId" value={article.id} />
					<input type="hidden" name="quantity" value={quantityFor(article.id)} />
					<button type="submit" class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-50" aria-label={t('items.bookIn')}>+</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}
