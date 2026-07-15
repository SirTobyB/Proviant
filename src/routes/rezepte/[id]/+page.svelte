<script lang="ts">
	import { enhance } from '$app/forms';
	import { coverageMulti, scaleAmount } from '$lib/units';

	let { data, form } = $props();

	// svelte-ignore state_referenced_locally
	let portions = $state(data.recipe.servings);
	let confirmDelete = $state(false);

	function scaledText(amount: number | null, unit: string | null): string {
		if (amount == null) return '';
		const scaled = scaleAmount(amount, data.recipe.servings, portions) ?? 0;
		const rounded = Math.round(scaled * 100) / 100;
		return `${rounded.toLocaleString('de-DE')} ${unit ?? ''}`.trim();
	}

	// Kochbarkeit je Zutat für die gewählten Portionen
	function ingredientState(ing: (typeof data.ingredients)[number]) {
		if (ing.articles.length === 0 || ing.amount == null) return { kind: 'unchecked' as const };
		const scaled = scaleAmount(ing.amount, data.recipe.servings, portions) ?? 0;
		const cov = coverageMulti(scaled, ing.unit, ing.articles);
		if (!cov.comparable) return { kind: 'unchecked' as const };
		return cov.covered
			? { kind: 'ok' as const }
			: { kind: 'missing' as const, needed: cov.neededPackages, hasPicnic: Boolean(cov.orderPicnicId) };
	}

	const missingCount = $derived(
		data.ingredients.filter((ing) => ingredientState(ing).kind === 'missing').length
	);
	const cookable = $derived(missingCount === 0);
	const orderableMissing = $derived(
		data.ingredients.filter((ing) => {
			const state = ingredientState(ing);
			return state.kind === 'missing' && state.hasPicnic;
		}).length
	);
</script>

<svelte:head><title>{data.recipe.name} – LebensmittelKumpel</title></svelte:head>

<div class="flex items-center gap-2">
	<a href="/rezepte" class="text-sm text-gray-500 hover:text-gray-700">← Rezepte</a>
</div>

<div class="mt-2 flex flex-wrap items-start justify-between gap-3">
	<div class="flex items-center gap-4">
		{#if data.recipe.imagePath}
			<img src={`/api/images/${data.recipe.imagePath}`} alt="" class="h-20 w-20 rounded-xl border border-gray-200 object-cover" />
		{:else}
			<div class="flex h-20 w-20 items-center justify-center rounded-xl bg-gray-100 text-3xl">{data.recipe.category === 'cake' ? '🍰' : '🍲'}</div>
		{/if}
		<div>
			<h1 class="text-2xl font-bold">{data.recipe.name}</h1>
			<p class="mt-1 text-sm text-gray-500">
				{data.recipe.category === 'cake' ? 'Kuchen' : 'Warme Mahlzeit'}
				{#if data.recipe.lastCookedAt}
					· zuletzt gekocht {new Date(data.recipe.lastCookedAt).toLocaleDateString('de-DE')}
				{/if}
			</p>
			{#if data.tags.length > 0}
				<div class="mt-1.5 flex flex-wrap gap-1">
					{#each data.tags as tag (tag)}
						<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{tag}</span>
					{/each}
				</div>
			{/if}
			<span class="mt-1.5 inline-block rounded-full px-2.5 py-1 text-xs font-medium {cookable ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}">
				{cookable ? '✓ Kochbar mit aktuellem Vorrat' : `${missingCount} Zutat(en) fehlen`}
			</span>
		</div>
	</div>
	<div class="flex gap-2">
		<form method="POST" action="?/markCooked" use:enhance>
			<button type="submit" class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">🍽 Heute gekocht</button>
		</form>
		<a href={`/rezepte/${data.recipe.id}/bearbeiten`} class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Bearbeiten</a>
	</div>
</div>

<!-- Portionswähler -->
<div class="mt-5 flex items-center gap-3">
	<span class="text-sm font-medium text-gray-700">Portionen</span>
	<div class="flex items-center gap-1">
		<button type="button" onclick={() => (portions = Math.max(1, portions - 1))} class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50">−</button>
		<span class="w-10 text-center font-semibold">{portions}</span>
		<button type="button" onclick={() => (portions = portions + 1)} class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50">+</button>
	</div>
	{#if portions !== data.recipe.servings}
		<span class="text-xs text-gray-400">Grundrezept: {data.recipe.servings}</span>
	{/if}
</div>

{#if form?.message}
	<div class="mt-4 max-w-xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.message}</div>
{/if}
{#if form && 'cooked' in form && form.cooked}
	<div class="mt-4 max-w-xl rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">Als heute gekocht vermerkt.</div>
{/if}
{#if form && 'added' in form && form.added}
	<div class="mt-4 max-w-xl rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">
		{form.totalPackages} Gebinde ({form.added} Zutaten) in den Picnic-Warenkorb gelegt.
		{#if form.unlinked.length > 0}<div class="mt-1 text-green-700">Ohne Picnic-Verknüpfung: {form.unlinked.join(', ')}</div>{/if}
	</div>
{/if}

<!-- Zutaten -->
<h2 class="mt-6 text-sm font-semibold text-gray-700">Zutaten</h2>
<ul class="mt-2 max-w-xl divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
	{#each data.ingredients as ing (ing.id)}
		{@const state = ingredientState(ing)}
		<li class="flex items-center gap-3 px-4 py-2.5">
			<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs
				{state.kind === 'ok' ? 'bg-green-100 text-green-700' : state.kind === 'missing' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}">
				{state.kind === 'ok' ? '✓' : state.kind === 'missing' ? '!' : '–'}
			</span>
			<div class="min-w-0 flex-1">
				<div class="truncate text-sm font-medium">
					{ing.articles.length > 0 ? ing.articles.map((a) => a.name).join(' oder ') : ing.freeText}
				</div>
				{#if state.kind === 'missing'}
					<div class="text-xs text-amber-600">
						{state.needed} Gebinde fehlen{state.hasPicnic ? '' : ' · nicht mit Picnic verknüpft'}
					</div>
				{:else if state.kind === 'unchecked' && ing.articles.length > 0}
					<div class="text-xs text-gray-400">Vorrat nicht prüfbar (Einheit)</div>
				{/if}
			</div>
			<span class="shrink-0 text-sm text-gray-600">{scaledText(ing.amount, ing.unit)}</span>
		</li>
	{/each}
</ul>

<!-- Warenkorb -->
<form method="POST" action="?/addToCart" use:enhance class="mt-4 max-w-xl">
	<input type="hidden" name="portions" value={portions} />
	<button
		type="submit"
		disabled={data.connection !== 'connected' || orderableMissing === 0}
		class="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 sm:w-auto"
	>
		Fehlende Zutaten in den Picnic-Warenkorb ({orderableMissing})
	</button>
	{#if data.connection !== 'connected'}
		<p class="mt-2 text-xs text-gray-500">Zum Bestellen zuerst auf <a href="/bestellen" class="underline">Bestellen</a> mit Picnic verbinden.</p>
	{:else if orderableMissing === 0 && !cookable}
		<p class="mt-2 text-xs text-gray-500">Die fehlenden Zutaten sind nicht mit Picnic verknüpft.</p>
	{/if}
</form>

{#if data.recipe.instructions}
	<h2 class="mt-8 text-sm font-semibold text-gray-700">Zubereitung</h2>
	<div class="mt-2 max-w-xl whitespace-pre-wrap rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">{data.recipe.instructions}</div>
{/if}

<!-- Löschen -->
<div class="mt-8 max-w-xl border-t border-gray-200 pt-4">
	{#if confirmDelete}
		<form method="POST" action="?/delete" class="flex flex-wrap items-center gap-3" use:enhance>
			<span class="text-sm text-gray-700">„{data.recipe.name}" wirklich löschen?</span>
			<button type="submit" class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Ja, löschen</button>
			<button type="button" onclick={() => (confirmDelete = false)} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Abbrechen</button>
		</form>
	{:else}
		<button type="button" onclick={() => (confirmDelete = true)} class="text-sm font-medium text-red-600 hover:text-red-700">Rezept löschen</button>
	{/if}
</div>
