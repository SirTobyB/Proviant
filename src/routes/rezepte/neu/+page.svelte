<script lang="ts">
	import RecipeForm from '$lib/components/RecipeForm.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Neues Rezept – LebensmittelKumpel</title></svelte:head>

<h1 class="text-2xl font-bold">Neues Rezept</h1>

<RecipeForm allTags={data.allTags} submitLabel="Rezept anlegen" errorMessage={form?.message ?? null} />
