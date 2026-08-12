<script lang="ts">
	import ArticleForm from '$lib/components/ArticleForm.svelte';
	import StockEntryRow from '$lib/components/StockEntryRow.svelte';
	import { sumQuantity } from '$lib/stock';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	// Zweistufige Lösch-Bestätigung statt confirm(): mobilfreundlich und ohne blockierenden Dialog
	let confirmDelete = $state(false);

	// Aufgeklappte Charge — immer höchstens eine in der ganzen Liste
	let openEntryId = $state<number | null>(null);
	let openMode = $state<'view' | 'edit' | 'move'>('view');
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

<!-- Bestände: Chargen dieses Artikels über alle Lagerorte (Funktion wie auf der Lagerort-Seite) -->
<div class="mt-8 max-w-xl border-t border-gray-200 pt-4">
	<h2 class="text-sm font-semibold text-gray-700">Bestände</h2>

	{#if form?.entryMessage}
		<div class="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.entryMessage}</div>
	{/if}
	{#if form && 'moved' in form && form.moved}
		<div class="mt-3 rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">Nach „{form.targetName}" umgelagert.</div>
	{/if}

	{#if data.stock.length === 0}
		<p class="mt-3 text-sm text-gray-500">Kein Bestand vorhanden.</p>
	{:else}
		<div class="mt-3 space-y-4">
			{#each data.stock as group (group.locationId)}
				<div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
					<div class="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5">
						<a href={`/lager/${group.locationId}`} class="font-semibold hover:underline">{group.locationName}</a>
						<span class="shrink-0 text-sm font-semibold text-gray-700">{sumQuantity(group.entries)}×</span>
					</div>

					<ul class="divide-y divide-gray-50">
						{#each group.entries as entry (entry.id)}
							<StockEntryRow
								{entry}
								moveTargets={data.locations.filter((l) => l.id !== entry.locationId)}
								mode={openEntryId === entry.id ? openMode : 'view'}
								onMode={(mode) => { openEntryId = mode === 'view' ? null : entry.id; openMode = mode; }}
							/>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	{/if}
</div>

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
