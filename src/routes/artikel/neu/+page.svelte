<script lang="ts">
	import ArticleForm from '$lib/components/ArticleForm.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Neuer Artikel – LebensmittelKumpel</title></svelte:head>

<h1 class="text-2xl font-bold">Neuer Artikel</h1>

<ArticleForm
	article={{ ean: data.ean }}
	locations={data.locations}
	submitLabel="Artikel anlegen"
	errorMessage={form?.message ?? null}
	autoLookup={Boolean(data.ean)}
/>
