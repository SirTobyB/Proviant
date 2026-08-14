<script lang="ts">
	import RecipeForm from '$lib/components/RecipeForm.svelte';
	import { translator } from '$lib/i18n';

	let { data, form } = $props();

	const t = $derived(translator(data.locale));
</script>

<svelte:head><title>{t('recipe.new.title')} – LebensmittelKumpel</title></svelte:head>

<h1 class="text-2xl font-bold">{t('recipe.new.title')}</h1>

<RecipeForm allTags={data.allTags} submitLabel={t('recipe.new.submit')} errorMessage={form?.message ?? null} />
