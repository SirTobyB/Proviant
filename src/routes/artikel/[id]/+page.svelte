<script lang="ts">
	import ArticleForm from '$lib/components/ArticleForm.svelte';
	import { enhance } from '$app/forms';
	import { mhdStatus, mhdLabel, formatDate, MHD_BADGE_CLASSES } from '$lib/mhd';

	let { data, form } = $props();

	// Zweistufige Lösch-Bestätigung statt confirm(): mobilfreundlich und ohne blockierenden Dialog
	let confirmDelete = $state(false);

	// Welche Charge wird gerade bearbeitet bzw. umgelagert?
	let editingId = $state<number | null>(null);
	let movingId = $state<number | null>(null);
	let moveTarget = $state('');

	// Ziel beim Öffnen je Charge setzen — die Optionsliste unterscheidet sich
	// pro Charge (eigener Lagerort wird gefiltert), ein globaler Default kann
	// daher auf eine weggefilterte Option zeigen
	function openMove(entry: { id: number; locationId: number }) {
		movingId = entry.id;
		editingId = null;
		moveTarget = String(data.locations.find((l) => l.id !== entry.locationId)?.id ?? '');
	}

	function locationTotal(entries: { quantity: number }[]): number {
		return entries.reduce((sum, entry) => sum + entry.quantity, 0);
	}
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
						<span class="shrink-0 text-sm font-semibold text-gray-700">{locationTotal(group.entries)}×</span>
					</div>

					<ul class="divide-y divide-gray-50">
						{#each group.entries as entry (entry.id)}
							{@const status = mhdStatus(entry.bestBefore)}
							<li class="px-4 py-2.5">
								{#if editingId === entry.id}
									<form
										method="POST"
										action="?/updateEntry"
										use:enhance={() => async ({ update }) => { editingId = null; await update(); }}
										class="flex flex-wrap items-end gap-2"
									>
										<input type="hidden" name="entryId" value={entry.id} />
										<div>
											<label for={`q-${entry.id}`} class="block text-xs text-gray-500">Anzahl</label>
											<input id={`q-${entry.id}`} name="quantity" type="number" min="0" value={entry.quantity} class="mt-0.5 w-20 rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
										</div>
										<div>
											<label for={`b-${entry.id}`} class="block text-xs text-gray-500">MHD</label>
											<input id={`b-${entry.id}`} name="bestBefore" type="date" value={entry.bestBefore ?? ''} class="mt-0.5 rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
										</div>
										<button type="submit" class="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">Speichern</button>
										<button type="button" onclick={() => (editingId = null)} class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Abbrechen</button>
										<span class="ml-auto text-xs text-gray-400">Anzahl 0 = löschen</span>
									</form>
								{:else if movingId === entry.id}
									<form
										method="POST"
										action="?/moveEntry"
										use:enhance={() => async ({ update }) => { movingId = null; await update(); }}
										class="flex flex-wrap items-end gap-2"
									>
										<input type="hidden" name="entryId" value={entry.id} />
										<div>
											<label for={`t-${entry.id}`} class="block text-xs text-gray-500">Neuer Lagerort</label>
											<select id={`t-${entry.id}`} name="targetLocationId" bind:value={moveTarget} class="mt-0.5 rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600">
												{#each data.locations.filter((l) => l.id !== entry.locationId) as loc (loc.id)}
													<option value={String(loc.id)}>{loc.name}</option>
												{/each}
											</select>
										</div>
										<button type="submit" class="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">Umlagern</button>
										<button type="button" onclick={() => (movingId = null)} class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Abbrechen</button>
									</form>
								{:else}
									<div class="flex items-center gap-3">
										<span class="w-10 shrink-0 text-sm font-medium text-gray-700">{entry.quantity}×</span>
										<span class="flex-1 text-sm text-gray-600">
											{#if entry.bestBefore}
												MHD {formatDate(entry.bestBefore)}
											{:else}
												<span class="text-gray-400">kein MHD</span>
											{/if}
										</span>
										<span class="rounded-full px-2.5 py-1 text-xs font-medium {MHD_BADGE_CLASSES[status]}">
											{mhdLabel(entry.bestBefore)}
										</span>
										<button type="button" onclick={() => openMove(entry)} class="shrink-0 text-sm text-gray-500 underline hover:text-gray-700">Umlagern</button>
										<button type="button" onclick={() => { editingId = entry.id; movingId = null; }} class="shrink-0 text-sm text-gray-500 underline hover:text-gray-700">Ändern</button>
									</div>
								{/if}
							</li>
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
