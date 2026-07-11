<script lang="ts">
	import RecipeForm from '$lib/components/RecipeForm.svelte';

	let { data, form } = $props();

	// Formular-Startwerte; bei Navigation wird die Seite neu geladen
	// svelte-ignore state_referenced_locally
	const recipeValues = {
		name: data.recipe.name,
		category: data.recipe.category,
		servings: data.recipe.servings,
		instructions: data.recipe.instructions,
		imagePath: data.recipe.imagePath,
		ingredients: data.ingredients.map((i) => ({
			articleId: i.articleId,
			articleName: i.articleName,
			freeText: i.freeText,
			amount: i.amount,
			unit: i.unit
		}))
	};
</script>

<svelte:head><title>{data.recipe.name} bearbeiten – LebensmittelKumpel</title></svelte:head>

<div class="flex items-center gap-2">
	<a href={`/rezepte/${data.recipe.id}`} class="text-sm text-gray-500 hover:text-gray-700">← Zurück</a>
</div>
<h1 class="mt-1 text-2xl font-bold">Rezept bearbeiten</h1>

<RecipeForm recipe={recipeValues} submitLabel="Speichern" errorMessage={form?.message ?? null} />
