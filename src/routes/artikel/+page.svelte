<script lang="ts">
	import { enhance } from '$app/forms';

	let { data } = $props();

	function packageSize(amount: number | null, unit: string | null): string {
		if (amount == null) return '';
		return `${amount.toLocaleString('de-DE')} ${unit ?? ''}`.trim();
	}
</script>

<svelte:head><title>Artikel – LebensmittelKumpel</title></svelte:head>

<div class="flex items-center justify-between gap-3">
	<div>
		<h1 class="text-2xl font-bold">Artikel</h1>
		<p class="mt-1 text-sm text-gray-500">{data.articles.length} Artikel im Stamm</p>
	</div>
	<a
		href="/artikel/neu"
		class="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
	>
		+ Neuer Artikel
	</a>
</div>

<form method="GET" class="mt-4 max-w-md">
	<input
		type="search"
		name="q"
		value={data.query}
		placeholder="Suchen (Name oder EAN) …"
		class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
	/>
</form>

{#if data.articles.length === 0}
	<div class="mt-8 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
		{data.query ? 'Keine Artikel gefunden.' : 'Noch keine Artikel — lege den ersten an!'}
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
						<span class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
							{#if packageSize(article.amount, article.unit)}
								<span>{packageSize(article.amount, article.unit)}</span>
							{/if}
							{#if article.ean}
								<span class="rounded bg-gray-100 px-1.5 py-0.5">EAN</span>
							{/if}
							{#if article.picnicId}
								<span class="rounded bg-red-50 px-1.5 py-0.5 text-red-600">Picnic</span>
							{/if}
						</span>
					</span>
				</a>
				<!-- Schnell-Bestandskorrektur -->
				<form method="POST" action="?/bookOut" use:enhance>
					<input type="hidden" name="articleId" value={article.id} />
					<button type="submit" disabled={article.stock === 0} class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30" aria-label="Ausbuchen">−</button>
				</form>
				<div class="w-10 shrink-0 text-center">
					<span class="block text-sm font-semibold {article.stock === 0 ? 'text-gray-400' : ''}">{article.stock}×</span>
					{#if article.minStock > 0 && article.stock < article.minStock}
						<span class="block text-[10px] text-amber-600">min. {article.minStock}</span>
					{/if}
				</div>
				<form method="POST" action="?/bookIn" use:enhance>
					<input type="hidden" name="articleId" value={article.id} />
					<button type="submit" class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-50" aria-label="Einbuchen">+</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}
