<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let selectedTags = $state<string[]>([]);

	function toggleTag(tag: string) {
		selectedTags = selectedTags.includes(tag)
			? selectedTags.filter((t) => t !== tag)
			: [...selectedTags, tag];
	}

	const suggestion = $derived(form && 'suggestion' in form ? form.suggestion : null);
</script>

<svelte:head><title>Rezeptvorschlag – LebensmittelKumpel</title></svelte:head>

<div class="flex items-center gap-2">
	<a href="/rezepte" class="text-sm text-gray-500 hover:text-gray-700">← Rezepte</a>
</div>
<h1 class="mt-1 text-2xl font-bold">Was kochen wir?</h1>
<p class="mt-1 text-sm text-gray-500">Zufälliger Vorschlag — kürzlich Gekochtes (14 Tage) wird ausgelassen, Kochbares leicht bevorzugt.</p>

<form method="POST" action="?/roll" use:enhance class="mt-5 max-w-xl">
	{#if data.allTags.length > 0}
		<span class="block text-sm font-medium text-gray-700">Nach Tags filtern (optional)</span>
		<div class="mt-2 flex flex-wrap gap-1.5">
			{#each data.allTags as tag (tag)}
				<button
					type="button"
					onclick={() => toggleTag(tag)}
					class="rounded-full px-3 py-1 text-sm font-medium {selectedTags.includes(tag) ? 'bg-green-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}"
				>
					{tag}
				</button>
			{/each}
		</div>
	{/if}
	{#each selectedTags as tag (tag)}
		<input type="hidden" name="tags" value={tag} />
	{/each}

	<button type="submit" class="mt-4 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
		{suggestion ? '🎲 Nochmal würfeln' : '🎲 Vorschlag würfeln'}
	</button>
</form>

{#if form && 'none' in form && form.none}
	<div class="mt-5 max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{form.reason}</div>
{/if}

{#if suggestion}
	<div class="mt-5 max-w-xl overflow-hidden rounded-xl border border-gray-200 bg-white">
		<a href={`/rezepte/${suggestion.id}`} class="block">
			<div class="aspect-[16/9] w-full bg-gray-100">
				{#if suggestion.imagePath}
					<img src={`/api/images/${suggestion.imagePath}`} alt="" class="h-full w-full object-cover" />
				{:else}
					<div class="flex h-full w-full items-center justify-center text-5xl">{suggestion.category === 'cake' ? '🍰' : '🍲'}</div>
				{/if}
			</div>
		</a>
		<div class="p-4">
			<div class="flex items-start justify-between gap-2">
				<div>
					<a href={`/rezepte/${suggestion.id}`} class="text-lg font-bold hover:underline">{suggestion.name}</a>
					<div class="text-sm text-gray-500">{suggestion.category === 'cake' ? 'Kuchen' : 'Warme Mahlzeit'} · {suggestion.servings} Portionen</div>
				</div>
				{#if suggestion.cookable}
					<span class="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">✓ kochbar</span>
				{/if}
			</div>
			{#if suggestion.tags.length > 0}
				<div class="mt-2 flex flex-wrap gap-1">
					{#each suggestion.tags as tag (tag)}
						<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{tag}</span>
					{/each}
				</div>
			{/if}
			{#if form && 'relaxed' in form && form.relaxed}
				<p class="mt-2 text-xs text-amber-600">Alle Rezepte wurden kürzlich gekocht — Sperre wurde für diesen Vorschlag gelockert.</p>
			{/if}

			<div class="mt-4 flex gap-2">
				<a href={`/rezepte/${suggestion.id}`} class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">Zum Rezept</a>
				<form method="POST" action="?/markCooked" use:enhance>
					<input type="hidden" name="recipeId" value={suggestion.id} />
					<button type="submit" class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">🍽 Kochen wir</button>
				</form>
			</div>
		</div>
	</div>
{/if}

{#if form && 'cooked' in form && form.cooked}
	<div class="mt-4 max-w-xl rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">Als heute gekocht vermerkt — würfle für einen neuen Vorschlag.</div>
{/if}
