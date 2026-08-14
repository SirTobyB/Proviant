<script lang="ts">
	import { packageSize } from '$lib/format';
	import { translator } from '$lib/i18n';
	import StockEntryRow from '$lib/components/StockEntryRow.svelte';
	import { sumQuantity } from '$lib/stock';

	let { data, form } = $props();

	// Vorerst nur für die Zahlformate; die Texte dieser Seite folgen später
	const t = $derived(translator(data.locale));

	// Aufgeklappte Charge — immer höchstens eine in der ganzen Liste
	let openEntryId = $state<number | null>(null);
	let openMode = $state<'view' | 'edit' | 'move'>('view');
</script>

<svelte:head><title>{data.location.name} – LebensmittelKumpel</title></svelte:head>

<div class="flex items-center gap-2">
	<a href="/" class="text-sm text-gray-500 hover:text-gray-700">← Lager</a>
</div>
<h1 class="mt-1 text-2xl font-bold">{data.location.name}</h1>

{#if form?.message}
	<div class="mt-4 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.message}</div>
{/if}
{#if form && 'moved' in form && form.moved}
	<div class="mt-4 max-w-2xl rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">Nach „{form.targetName}" umgelagert.</div>
{/if}

{#if data.articles.length === 0}
	<div class="mt-6 max-w-2xl rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
		Keine Bestände in diesem Lagerort. Per <a href="/scan" class="text-green-700 underline">Scannen</a> einbuchen.
	</div>
{:else}
	<div class="mt-6 max-w-2xl space-y-4">
		{#each data.articles as article (article.articleId)}
			<div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
				<div class="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
					<a href={`/artikel/${article.articleId}`} class="shrink-0">
						{#if article.imagePath}
							<img src={`/api/images/${article.imagePath}`} alt="" class="h-10 w-10 rounded-lg border border-gray-100 object-contain" />
						{:else}
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">📦</div>
						{/if}
					</a>
					<a href={`/artikel/${article.articleId}`} class="min-w-0 flex-1">
						<span class="block truncate font-semibold hover:underline">{article.articleName}</span>
						{#if packageSize(article.amount, article.unit, data.locale, t)}
							<span class="text-xs text-gray-500">{packageSize(article.amount, article.unit, data.locale, t)}</span>
						{/if}
					</a>
					<span class="shrink-0 text-sm font-semibold text-gray-700">{sumQuantity(article.entries)}×</span>
				</div>

				<ul class="divide-y divide-gray-50">
					{#each article.entries as entry (entry.id)}
						<StockEntryRow
							{entry}
							moveTargets={data.otherLocations}
							mode={openEntryId === entry.id ? openMode : 'view'}
							onMode={(mode) => { openEntryId = mode === 'view' ? null : entry.id; openMode = mode; }}
						/>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
{/if}
