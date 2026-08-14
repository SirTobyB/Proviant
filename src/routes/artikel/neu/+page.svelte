<script lang="ts">
	import ArticleForm from '$lib/components/ArticleForm.svelte';
	import { translator } from '$lib/i18n';

	let { data, form } = $props();

	const t = $derived(translator(data.locale));
</script>

<svelte:head><title>{t('item.new.title')} – LebensmittelKumpel</title></svelte:head>

<h1 class="text-2xl font-bold">{t('item.new.title')}</h1>

<ArticleForm
	article={{ ean: data.ean }}
	locations={data.locations}
	allTags={data.allTags}
	submitLabel={t('item.new.submit')}
	errorMessage={form?.message ?? null}
	autoLookup={Boolean(data.ean)}
/>
