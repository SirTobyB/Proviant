<script lang="ts">
	import { enhance } from '$app/forms';
	import { translator } from '$lib/i18n';

	let { data, form } = $props();

	const t = $derived(translator(data.locale));

	let selectedTags = $state<string[]>([]);

	function toggleTag(tag: string) {
		selectedTags = selectedTags.includes(tag)
			? selectedTags.filter((t) => t !== tag)
			: [...selectedTags, tag];
	}

	const suggestion = $derived(form && 'suggestion' in form ? form.suggestion : null);
</script>

<svelte:head><title>{t('suggest.title')} – Proviant</title></svelte:head>

<div class="flex items-center gap-2">
	<a href="/rezepte" class="text-sm text-gray-500 hover:text-gray-700">← {t('recipes.back')}</a>
</div>
<h1 class="mt-1 text-2xl font-bold">{t('suggest.title')}</h1>
<p class="mt-1 text-sm text-gray-500">{t('suggest.description')}</p>

<form method="POST" action="?/roll" use:enhance class="mt-5 max-w-xl">
	{#if data.allTags.length > 0}
		<span class="block text-sm font-medium text-gray-700">{t('suggest.filterByTags')}</span>
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
		🎲 {suggestion ? t('suggest.rollAgain') : t('suggest.roll')}
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
					<div class="text-sm text-gray-500">{suggestion.category === 'cake' ? t('recipes.categoryCake') : t('recipes.categoryMeal')} · {t('recipes.servings', { n: suggestion.servings })}</div>
				</div>
				{#if suggestion.cookable}
					<span class="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">✓ {t('recipes.cookable')}</span>
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
				<p class="mt-2 text-xs text-amber-600">{t('suggest.relaxed')}</p>
			{/if}

			<div class="mt-4 flex gap-2">
				<a href={`/rezepte/${suggestion.id}`} class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">{t('suggest.openRecipe')}</a>
				<form method="POST" action="?/markCooked" use:enhance>
					<input type="hidden" name="recipeId" value={suggestion.id} />
					<button type="submit" class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">🍽 {t('suggest.cookThis')}</button>
				</form>
			</div>
		</div>
	</div>
{/if}

{#if form && 'cooked' in form && form.cooked}
	<div class="mt-4 max-w-xl rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">{t('suggest.markedCooked')}</div>
{/if}
