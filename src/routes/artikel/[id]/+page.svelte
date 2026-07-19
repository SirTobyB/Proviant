<script lang="ts">
	import ArticleForm from '$lib/components/ArticleForm.svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	// Zweistufige Lösch-Bestätigung statt confirm(): mobilfreundlich und ohne blockierenden Dialog
	let confirmDelete = $state(false);
</script>

<svelte:head><title>{data.article.name} – LebensmittelKumpel</title></svelte:head>

<h1 class="text-2xl font-bold">Artikel bearbeiten</h1>

{#key data.article.id}
	<ArticleForm
		article={{ ...data.article, tags: data.tags }}
		locations={data.locations}
		allTags={data.allTags}
		submitLabel="Speichern"
		errorMessage={form?.message ?? null}
		action="?/update"
	/>
{/key}

<div class="mt-8 max-w-xl border-t border-gray-200 pt-4">
	{#if confirmDelete}
		<form method="POST" action="?/delete" class="flex flex-wrap items-center gap-3" use:enhance>
			<span class="text-sm text-gray-700">
				„{data.article.name}“ wirklich löschen? Bestände dieses Artikels werden mitgelöscht.
			</span>
			<button
				type="submit"
				class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
			>
				Ja, löschen
			</button>
			<button
				type="button"
				onclick={() => (confirmDelete = false)}
				class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				Abbrechen
			</button>
		</form>
	{:else}
		<button
			type="button"
			onclick={() => (confirmDelete = true)}
			class="text-sm font-medium text-red-600 hover:text-red-700"
		>
			Artikel löschen
		</button>
	{/if}
</div>
