<script lang="ts">
	import RecipeForm from '$lib/components/RecipeForm.svelte';
	import { translator } from '$lib/i18n';

	let { data, form } = $props();

	const t = $derived(translator(data.locale));

	// Formular-Startwerte; bei Navigation wird die Seite neu geladen
	// svelte-ignore state_referenced_locally
	const recipeValues = {
		name: data.recipe.name,
		category: data.recipe.category,
		servings: data.recipe.servings,
		instructions: data.recipe.instructions,
		imagePath: data.recipe.imagePath,
		tags: data.tags,
		ingredients: data.ingredients.map((i) => ({
			articles: i.articles.map((a) => ({ id: a.id, name: a.name })),
			freeText: i.freeText,
			amount: i.amount,
			unit: i.unit
		}))
	};
</script>

<svelte:head><title>{data.recipe.name} – Proviant</title></svelte:head>

<div class="flex items-center gap-2">
	<a href={`/rezepte/${data.recipe.id}`} class="text-sm text-gray-500 hover:text-gray-700">← {t('recipe.back')}</a>
</div>
<h1 class="mt-1 text-2xl font-bold">{t('recipe.edit.title')}</h1>

<RecipeForm recipe={recipeValues} allTags={data.allTags} submitLabel={t('recipe.edit.submit')} errorMessage={form?.message ?? null} />
