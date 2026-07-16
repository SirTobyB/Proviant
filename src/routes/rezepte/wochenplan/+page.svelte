<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let checkedDates = $state<Set<string>>(new Set());
	let pickerOpenFor = $state<string | null>(null);
	let pickerQuery = $state('');
	let selectedTags = $state<string[]>([]);

	function toggleChecked(date: string) {
		const next = new Set(checkedDates);
		if (next.has(date)) next.delete(date);
		else next.add(date);
		checkedDates = next;
	}

	function toggleTag(tag: string) {
		selectedTags = selectedTags.includes(tag)
			? selectedTags.filter((t) => t !== tag)
			: [...selectedTags, tag];
	}

	function openPicker(date: string) {
		pickerOpenFor = date;
		pickerQuery = '';
	}

	function weekdayLabel(date: string, index: number): string {
		const d = new Date(date + 'T00:00:00');
		const label = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
		return index === 0 ? `Heute · ${label}` : label;
	}

	const rollNoneLeft = $derived((form && 'rolled' in form ? form.noneLeft : []) ?? []);

	const filteredRecipes = $derived(
		pickerQuery.trim() === ''
			? data.allRecipes
			: data.allRecipes.filter((r) => r.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()))
	);

	const hasAnyEntry = $derived(data.days.some((d) => d.entry != null));
</script>

<svelte:head><title>Wochenplan – LebensmittelKumpel</title></svelte:head>

<div class="flex items-center gap-2">
	<a href="/rezepte" class="text-sm text-gray-500 hover:text-gray-700">← Rezepte</a>
</div>
<h1 class="mt-1 text-2xl font-bold">Wochenplan</h1>
<p class="mt-1 text-sm text-gray-500">
	Für leere Tage Vorschläge würfeln lassen oder manuell ein Rezept wählen, danach die fehlenden
	Zutaten der ganzen Woche gebündelt in den Picnic-Warenkorb legen.
</p>

{#if form?.message}
	<div class="mt-4 max-w-xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.message}</div>
{/if}
{#if form && 'rolled' in form}
	<div class="mt-4 max-w-xl rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">
		{form.rolled} Tag(e) neu gewürfelt.
		{#if form.relaxed}<div class="mt-1 text-green-700">Für manche Tage wurde die 14-Tage-Sperre gelockert, da sonst nichts übrig war.</div>{/if}
		{#if rollNoneLeft.length > 0}<div class="mt-1 text-amber-700">Kein Rezept mehr übrig für: {rollNoneLeft.join(', ')}</div>{/if}
	</div>
{/if}
{#if form && 'added' in form && form.added}
	<div class="mt-4 max-w-xl rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">
		{form.totalPackages} Gebinde ({form.added} Zutaten) in den Picnic-Warenkorb gelegt.
		{#if form.unlinked.length > 0}<div class="mt-1 text-green-700">Ohne Picnic-Verknüpfung: {form.unlinked.join(', ')}</div>{/if}
		{#if form.incomparable.length > 0}<div class="mt-1 text-green-700">Einheiten nicht vergleichbar: {form.incomparable.join(', ')}</div>{/if}
	</div>
{/if}

<!-- Tag-Filter + Würfeln -->
<form method="POST" action="?/roll" use:enhance class="mt-5 max-w-xl">
	{#if data.allTags.length > 0}
		<span class="block text-sm font-medium text-gray-700">Nach Tags filtern (optional)</span>
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
	{#each selectedTags as tag (tag)}<input type="hidden" name="tags" value={tag} />{/each}
	{#each [...checkedDates] as date (date)}<input type="hidden" name="dates" value={date} />{/each}

	<button
		type="submit"
		disabled={checkedDates.size === 0}
		class="mt-3 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
	>
		🎲 Vorschläge würfeln ({checkedDates.size})
	</button>
</form>

<!-- Tageskarten -->
<div class="mt-5 max-w-xl space-y-2">
	{#each data.days as day, index (day.date)}
		<div class="rounded-xl border border-gray-200 bg-white p-3">
			<div class="text-xs font-medium text-gray-500">{weekdayLabel(day.date, index)}</div>

			{#if day.entry}
				<div class="mt-1.5 flex items-center gap-3">
					{#if day.entry.imagePath}
						<img src={`/api/images/${day.entry.imagePath}`} alt="" class="h-12 w-12 shrink-0 rounded-lg border border-gray-200 object-cover" />
					{:else}
						<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xl">{day.entry.category === 'cake' ? '🍰' : '🍲'}</div>
					{/if}
					<div class="min-w-0 flex-1">
						<a href={`/rezepte/${day.entry.recipeId}`} class="truncate text-sm font-semibold hover:underline">{day.entry.recipeName}</a>
						<div class="mt-0.5 flex items-center gap-2">
							{#if day.entry.cookable}
								<span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">✓ kochbar</span>
							{/if}
							<form method="POST" action="?/updateServings" use:enhance class="flex items-center gap-1">
								<input type="hidden" name="id" value={day.entry.id} />
								<input
									type="number"
									name="servings"
									min="1"
									value={day.entry.servings}
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
									class="w-14 rounded-lg border-gray-300 py-0.5 text-xs focus:border-green-600 focus:ring-green-600"
								/>
								<span class="text-xs text-gray-400">Portionen</span>
							</form>
						</div>
					</div>
					<div class="flex shrink-0 flex-col gap-1">
						<button type="button" onclick={() => openPicker(day.date)} class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">Ändern</button>
						<form method="POST" action="?/removeDay" use:enhance>
							<input type="hidden" name="id" value={day.entry.id} />
							<button type="submit" class="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">Entfernen</button>
						</form>
					</div>
				</div>
			{:else if pickerOpenFor !== day.date}
				<div class="mt-1.5 flex items-center gap-3">
					<label class="flex items-center gap-2 text-sm text-gray-600">
						<input type="checkbox" checked={checkedDates.has(day.date)} onchange={() => toggleChecked(day.date)} class="rounded border-gray-300 text-green-600 focus:ring-green-600" />
						Vorschlag benötigt
					</label>
					<button type="button" onclick={() => openPicker(day.date)} class="text-sm text-green-700 hover:underline">manuell wählen</button>
				</div>
			{/if}

			{#if pickerOpenFor === day.date}
				<div class="mt-2 rounded-lg border border-gray-200 p-2">
					<div class="flex gap-1">
						<input type="text" bind:value={pickerQuery} placeholder="Rezept suchen …" class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
						<button type="button" onclick={() => (pickerOpenFor = null)} class="shrink-0 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">Abbrechen</button>
					</div>
					<ul class="mt-1 max-h-56 divide-y divide-gray-100 overflow-y-auto overflow-x-hidden rounded-lg border border-gray-200">
						{#each filteredRecipes as r (r.id)}
							<li>
								<form method="POST" action="?/setDay" use:enhance={() => { pickerOpenFor = null; }}>
									<input type="hidden" name="date" value={day.date} />
									<input type="hidden" name="recipeId" value={r.id} />
									<button type="submit" class="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-green-50">
										<span class="shrink-0">{r.category === 'cake' ? '🍰' : '🍲'}</span>
										<span class="truncate">{r.name}</span>
									</button>
								</form>
							</li>
						{:else}
							<li class="px-2 py-1.5 text-sm text-gray-400">Kein Rezept gefunden</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/each}
</div>

<!-- Gebündelter Warenkorb -->
<form method="POST" action="?/buildCart" use:enhance class="mt-4 max-w-xl">
	<button
		type="submit"
		disabled={data.connection !== 'connected' || !hasAnyEntry}
		class="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 sm:w-auto"
	>
		Zutaten für die Woche in den Picnic-Warenkorb
	</button>
	{#if data.connection !== 'connected'}
		<p class="mt-2 text-xs text-gray-500">Zum Bestellen zuerst auf <a href="/bestellen" class="underline">Bestellen</a> mit Picnic verbinden.</p>
	{:else if !hasAnyEntry}
		<p class="mt-2 text-xs text-gray-500">Für diese Woche ist noch nichts geplant.</p>
	{/if}
</form>
