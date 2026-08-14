<script lang="ts">
	import { enhance } from '$app/forms';
	import { translator } from '$lib/i18n';

	let { data, form } = $props();

	const t = $derived(translator(data.locale));

	let query = $state('');
	// Während des Imports den geklickten Eintrag markieren
	let importing = $state<string | null>(null);

	const filtered = $derived(
		data.tiles.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))
	);

	function alreadyImported(name: string): boolean {
		return data.existingNames.includes(name.toLowerCase());
	}
</script>

<svelte:head><title>{t('recipeImport.title')} – LebensmittelKumpel</title></svelte:head>

<div class="flex items-center gap-2">
	<a href="/rezepte" class="text-sm text-gray-500 hover:text-gray-700">← {t('recipes.back')}</a>
</div>
<h1 class="mt-1 text-2xl font-bold">{t('recipeImport.title')}</h1>
<p class="mt-1 text-sm text-gray-500">
	{t('recipeImport.description')}
</p>

{#if data.connection !== 'connected'}
	<div class="mt-6 max-w-2xl rounded-xl border border-gray-200 bg-white p-6 text-center">
		<div class="text-3xl">🔌</div>
		<p class="mt-2 font-medium">{t('recipeImport.notConnected')}</p>
		<p class="mt-1 text-sm text-gray-500">
			{t('recipeImport.connectBefore')}<a href="/bestellen" class="text-green-700 underline">{t('nav.order')}</a>{t('recipeImport.connectAfter')}
		</p>
	</div>
{:else if data.error}
	<div class="mt-6 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{data.error}</div>
{:else}
	{#if form?.message}
		<div class="mt-4 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.message}</div>
	{/if}

	<input
		type="search"
		bind:value={query}
		placeholder={t('recipeImport.search')}
		class="mt-4 block w-full max-w-md rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
	/>

	<p class="mt-2 text-xs text-gray-500">{t('recipeImport.counted', { shown: filtered.length, total: data.tiles.length })}</p>

	<ul class="mt-2 max-w-2xl divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
		{#each filtered as tile (tile.id)}
			<li class="flex items-center gap-3 px-4 py-2.5">
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm">🍲</div>
				<span class="min-w-0 flex-1 truncate text-sm font-medium">{tile.name}</span>
				{#if alreadyImported(tile.name)}
					<span class="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{t('recipeImport.exists')}</span>
				{/if}
				<form
					method="POST"
					action="?/import"
					use:enhance={() => {
						importing = tile.id;
						return async ({ update }) => {
							importing = null;
							await update();
						};
					}}
				>
					<input type="hidden" name="id" value={tile.id} />
					<input type="hidden" name="name" value={tile.name} />
					<button
						type="submit"
						disabled={importing !== null}
						class="shrink-0 rounded-lg border border-green-600 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
					>
						{importing === tile.id ? t('recipeImport.importing') : t('recipeImport.import')}
					</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}
