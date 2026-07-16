<script lang="ts">
	let { data } = $props();

	const filters = [
		{ value: '', label: 'Alle' },
		{ value: 'meal', label: 'Warme Mahlzeiten' },
		{ value: 'cake', label: 'Kuchen' }
	];

	// Baut einen Link, der Kategorie- und Kochbar-Filter kombiniert
	function buildHref(category: string, cookable: boolean): string {
		const params = new URLSearchParams();
		if (category) params.set('kategorie', category);
		if (cookable) params.set('kochbar', '1');
		const query = params.toString();
		return query ? `/rezepte?${query}` : '/rezepte';
	}
</script>

<svelte:head><title>Rezepte – LebensmittelKumpel</title></svelte:head>

<div class="flex items-center justify-between gap-3">
	<div>
		<h1 class="text-2xl font-bold">Rezepte</h1>
		<p class="mt-1 text-sm text-gray-500">{data.recipes.length} Rezepte</p>
	</div>
	<div class="flex shrink-0 flex-wrap justify-end gap-2">
		<a href="/rezepte/vorschlag" class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">🎲 Vorschlag</a>
		<a href="/rezepte/wochenplan" class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">📅 Wochenplan</a>
		<a href="/rezepte/import" class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">⬇ Picnic-Import</a>
		<a href="/rezepte/neu" class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">+ Neu</a>
	</div>
</div>

<div class="mt-4 flex flex-wrap items-center gap-2">
	{#each filters as filter (filter.value)}
		<a
			href={buildHref(filter.value, data.onlyCookable)}
			class="rounded-full px-3 py-1.5 text-sm font-medium {(data.category ?? '') === filter.value ? 'bg-green-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}"
		>
			{filter.label}
		</a>
	{/each}
	<span class="mx-1 h-5 w-px bg-gray-200"></span>
	<a
		href={buildHref(data.category ?? '', !data.onlyCookable)}
		class="rounded-full px-3 py-1.5 text-sm font-medium {data.onlyCookable ? 'bg-green-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}"
	>
		Nur kochbare
	</a>
</div>

{#if data.recipes.length === 0}
	<div class="mt-8 max-w-2xl rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
		{data.onlyCookable ? 'Kein Rezept ist mit dem aktuellen Vorrat komplett kochbar.' : 'Noch keine Rezepte — lege das erste an!'}
	</div>
{:else}
	<div class="mt-4 grid grid-cols-2 gap-3 md:max-w-3xl md:grid-cols-3">
		{#each data.recipes as recipe (recipe.id)}
			<a href={`/rezepte/${recipe.id}`} class="overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-green-300">
				<div class="relative aspect-[4/3] w-full bg-gray-100">
					{#if recipe.imagePath}
						<img src={`/api/images/${recipe.imagePath}`} alt="" loading="lazy" class="h-full w-full object-cover" />
					{:else}
						<div class="flex h-full w-full items-center justify-center text-3xl">{recipe.category === 'cake' ? '🍰' : '🍲'}</div>
					{/if}
					{#if recipe.cookable}
						<span class="absolute right-1.5 top-1.5 rounded-full bg-green-600/90 px-2 py-0.5 text-xs font-medium text-white">kochbar</span>
					{/if}
				</div>
				<div class="p-3">
					<div class="truncate font-medium">{recipe.name}</div>
					<div class="text-xs text-gray-500">{recipe.category === 'cake' ? 'Kuchen' : 'Warme Mahlzeit'} · {recipe.servings} Portionen</div>
					{#if recipe.tags.length > 0}
						<div class="mt-1.5 flex flex-wrap gap-1">
							{#each recipe.tags.slice(0, 3) as tag (tag)}
								<span class="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{tag}</span>
							{/each}
						</div>
					{/if}
				</div>
			</a>
		{/each}
	</div>
{/if}
