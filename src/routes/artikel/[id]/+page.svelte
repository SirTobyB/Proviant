<script lang="ts">
	import ArticleForm from '#lib/components/ArticleForm.svelte';
	import StockEntryRow from '#lib/components/StockEntryRow.svelte';
	import { sumQuantity } from '#lib/stock.js';
	import { enhance } from '$app/forms';
	import { translator } from '#lib/i18n/index.js';
	import OfferBadge from '#lib/components/OfferBadge.svelte';
	import CartButton from '#lib/components/CartButton.svelte';

	let { data, form } = $props();

	const t = $derived(translator(data.locale));

	// Zweistufige Lösch-Bestätigung statt confirm(): mobilfreundlich und ohne blockierenden Dialog
	let confirmDelete = $state(false);

	// Aufgeklappte Charge — immer höchstens eine in der ganzen Liste
	let openEntryId = $state<number | null>(null);
	let openMode = $state<'view' | 'edit' | 'move'>('view');
</script>

<svelte:head><title>{data.article.name} – Proviant</title></svelte:head>

<h1 class="text-2xl font-bold">{t('item.edit.title')}</h1>

{#await data.picnic then picnic}
	{#if picnic?.price?.promoPrice != null}
		<div class="mt-3 max-w-xl">
			<OfferBadge price={picnic.price} locale={data.locale} />
		</div>
	{/if}
{/await}

<!-- Produktdaten: gespeichert (Marke, Herkunft, Bio, Nährwerte), Grundpreis live -->
{#if data.article.picnicId || data.article.brand || data.article.origin || data.article.organic}
	<div class="mt-3 max-w-xl rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
			{#if data.article.brand}<span><span class="text-gray-500">{t('form.brand')}:</span> {data.article.brand}</span>{/if}
			{#if data.article.origin}<span><span class="text-gray-500">{t('form.origin')}:</span> {data.article.origin}</span>{/if}
			{#if data.article.organic}<span class="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">{t('form.organic')}</span>{/if}
			{#await data.picnic then picnic}
				{#if picnic?.unitPrice}<span><span class="text-gray-500">{t('item.facts.unitPrice')}:</span> {picnic.unitPrice}</span>{/if}
			{/await}
		</div>
		{#if data.nutrition}
			<details class="mt-2">
				<summary class="cursor-pointer text-gray-600">{t('item.facts.nutrition')}</summary>
				<table class="mt-2 w-full text-xs">
					<tbody>
						{#each data.nutrition as row, index (index)}
							<tr class="border-t border-gray-100">
								<td class="py-1 {row.isCategory ? 'font-medium' : 'pl-3 text-gray-500'}">{row.label}</td>
								<td class="py-1 text-right">{row.value ?? ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</details>
		{/if}
		<div class="mt-2">
			{#if data.article.picnicId}
				{#await data.cart}
					<CartButton articleId={data.article.id} inCart={null} {t} />
				{:then cart}
					<CartButton articleId={data.article.id} inCart={cart ? (cart[data.article.picnicId] ?? 0) : null} {t} />
				{/await}
			{/if}
			{#if form && 'cartAdded' in form && form.cartAdded}
				<p class="mt-1 text-xs text-green-700">{t('cart.added')}</p>
			{/if}
			{#if form && 'cartMessage' in form && form.cartMessage}
				<p class="mt-1 text-xs text-red-700">{form.cartMessage}</p>
			{/if}
		</div>
		{#if data.article.picnicId}
			<form method="POST" action="?/refreshFromPicnic" use:enhance class="mt-2">
				<button type="submit" class="text-sm font-medium text-green-700 underline hover:text-green-800">
					{t('item.facts.refresh')}
				</button>
			</form>
		{/if}
		{#if form && 'factsRefreshed' in form && form.factsRefreshed}
			<p class="mt-1 text-xs text-green-700">{t('item.facts.refreshed')}</p>
		{/if}
		{#if form && 'factsMessage' in form && form.factsMessage}
			<p class="mt-1 text-xs text-red-700">{form.factsMessage}</p>
		{/if}
	</div>
{/if}

<!-- Neu aufbauen, wenn sich der Artikel geändert hat (z.B. Produktdaten von Picnic) —
     sonst überschriebe das nächste Speichern die neuen Werte mit den alten -->
{#key `${data.article.id}-${data.article.updatedAt}`}
	<ArticleForm
		article={{ ...data.article, tags: data.tags }}
		locations={data.locations}
		allTags={data.allTags}
		submitLabel={t('item.edit.submit')}
		errorMessage={form?.message ?? null}
		action="?/update"
	/>
{/key}

<!-- Bestände: Chargen dieses Artikels über alle Lagerorte (Funktion wie auf der Lagerort-Seite) -->
<div class="mt-8 max-w-xl border-t border-gray-200 pt-4">
	<h2 class="text-sm font-semibold text-gray-700">{t('item.stock.title')}</h2>

	{#if form?.entryMessage}
		<div class="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.entryMessage}</div>
	{/if}
	{#if form && 'moved' in form && form.moved}
		<div class="mt-3 rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">{t('item.stock.moved', { name: form.targetName })}</div>
	{/if}

	{#if data.stock.length === 0}
		<p class="mt-3 text-sm text-gray-500">{t('item.stock.empty')}</p>
	{:else}
		<div class="mt-3 space-y-4">
			{#each data.stock as group (group.locationId)}
				<div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
					<div class="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5">
						<a href={`/lager/${group.locationId}`} class="font-semibold hover:underline">{group.locationName}</a>
						<span class="shrink-0 text-sm font-semibold text-gray-700">{sumQuantity(group.entries)}×</span>
					</div>

					<ul class="divide-y divide-gray-50">
						{#each group.entries as entry (entry.id)}
							<StockEntryRow
								{entry}
								moveTargets={data.locations.filter((l) => l.id !== entry.locationId)}
								mode={openEntryId === entry.id ? openMode : 'view'}
								onMode={(mode) => { openEntryId = mode === 'view' ? null : entry.id; openMode = mode; }}
							/>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	{/if}
</div>

<div class="mt-8 max-w-xl border-t border-gray-200 pt-4">
	{#if confirmDelete}
		<form method="POST" action="?/delete" class="flex flex-wrap items-center gap-3" use:enhance>
			<span class="text-sm text-gray-700">
				{t('item.deleteConfirm', { name: data.article.name })}
			</span>
			<button
				type="submit"
				class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
			>
				{t('item.deleteYes')}
			</button>
			<button
				type="button"
				onclick={() => (confirmDelete = false)}
				class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				{t('form.cancel')}
			</button>
		</form>
	{:else}
		<button
			type="button"
			onclick={() => (confirmDelete = true)}
			class="text-sm font-medium text-red-600 hover:text-red-700"
		>
			{t('item.delete')}
		</button>
	{/if}
</div>
