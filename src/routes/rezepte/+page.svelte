<script lang="ts">
	let { data } = $props();

	const filters = [
		{ value: '', label: 'Alle' },
		{ value: 'meal', label: 'Warme Mahlzeiten' },
		{ value: 'cake', label: 'Kuchen' }
	];
</script>

<svelte:head><title>Rezepte – LebensmittelKumpel</title></svelte:head>

<div class="flex items-center justify-between gap-3">
	<div>
		<h1 class="text-2xl font-bold">Rezepte</h1>
		<p class="mt-1 text-sm text-gray-500">{data.recipes.length} Rezepte</p>
	</div>
	<a href="/rezepte/neu" class="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">+ Neues Rezept</a>
</div>

<div class="mt-4 flex gap-2">
	{#each filters as filter (filter.value)}
		<a
			href={filter.value ? `/rezepte?kategorie=${filter.value}` : '/rezepte'}
			class="rounded-full px-3 py-1.5 text-sm font-medium {(data.category ?? '') === filter.value ? 'bg-green-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}"
		>
			{filter.label}
		</a>
	{/each}
</div>

{#if data.recipes.length === 0}
	<div class="mt-8 max-w-2xl rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
		Noch keine Rezepte — lege das erste an!
	</div>
{:else}
	<div class="mt-4 grid grid-cols-2 gap-3 md:max-w-3xl md:grid-cols-3">
		{#each data.recipes as recipe (recipe.id)}
			<a href={`/rezepte/${recipe.id}`} class="overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-green-300">
				<div class="aspect-[4/3] w-full bg-gray-100">
					{#if recipe.imagePath}
						<img src={`/api/images/${recipe.imagePath}`} alt="" loading="lazy" class="h-full w-full object-cover" />
					{:else}
						<div class="flex h-full w-full items-center justify-center text-3xl">{recipe.category === 'cake' ? '🍰' : '🍲'}</div>
					{/if}
				</div>
				<div class="p-3">
					<div class="truncate font-medium">{recipe.name}</div>
					<div class="text-xs text-gray-500">{recipe.category === 'cake' ? 'Kuchen' : 'Warme Mahlzeit'} · {recipe.servings} Portionen</div>
				</div>
			</a>
		{/each}
	</div>
{/if}
