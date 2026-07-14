<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();

	let query = $state('');
	// Auswahl je Produkt-ID; neu Ladbares (nicht Verknüpftes) ist vorausgewählt
	// svelte-ignore state_referenced_locally
	let selected = $state<Record<string, boolean>>(
		Object.fromEntries(data.products.map((p) => [p.productId, !data.linkedIds.includes(p.productId)]))
	);
	let defaultLocationId = $state('');
	let submitting = $state(false);

	const filtered = $derived(
		data.products.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
	);
	const selectedProducts = $derived(
		data.products.filter((p) => selected[p.productId] && !data.linkedIds.includes(p.productId))
	);
	const productsJson = $derived(
		JSON.stringify(
			selectedProducts.map((p) => ({
				productId: p.productId,
				name: p.name,
				unitQuantity: p.unitQuantity,
				imageId: p.imageId
			}))
		)
	);

	function isLinked(id: string): boolean {
		return data.linkedIds.includes(id);
	}

	function setAll(value: boolean) {
		for (const p of filtered) {
			if (!isLinked(p.productId)) selected[p.productId] = value;
		}
	}

	function formatDate(iso: string | null): string {
		return iso ? new Date(iso).toLocaleDateString('de-DE') : '';
	}
</script>

<svelte:head><title>Artikel-Import – LebensmittelKumpel</title></svelte:head>

<div class="flex items-center gap-2">
	<a href="/artikel" class="text-sm text-gray-500 hover:text-gray-700">← Artikel</a>
</div>
<h1 class="mt-1 text-2xl font-bold">Aus Bestellungen importieren</h1>
<p class="mt-1 text-sm text-gray-500">
	Alle Produkte aus deinen letzten 10 Picnic-Lieferungen. Der Import übernimmt Name,
	Gebindegröße, Bild und die Picnic-Verknüpfung — die EAN liefert Picnic nicht,
	sie lässt sich später im Artikel ergänzen (z.B. nach dem ersten Scan).
</p>

{#if data.connection !== 'connected'}
	<div class="mt-6 max-w-2xl rounded-xl border border-gray-200 bg-white p-6 text-center">
		<div class="text-3xl">🔌</div>
		<p class="mt-2 font-medium">Noch nicht mit Picnic verbunden</p>
		<p class="mt-1 text-sm text-gray-500">
			Stelle die Verbindung auf der Seite <a href="/bestellen" class="text-green-700 underline">Bestellen</a> her.
		</p>
	</div>
{:else if data.error}
	<div class="mt-6 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{data.error}</div>
{:else}
	{#if form?.message}
		<div class="mt-4 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.message}</div>
	{/if}
	{#if form && 'imported' in form}
		<div class="mt-4 max-w-2xl rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">
			{form.imported} Artikel importiert{form.skipped ? ` · ${form.skipped} übersprungen (bereits verknüpft)` : ''}.
			<a href="/artikel" class="underline">Zur Artikelliste</a>
		</div>
	{/if}

	<div class="mt-4 flex max-w-2xl flex-wrap items-center gap-2">
		<input
			type="search"
			bind:value={query}
			placeholder="Produkte durchsuchen …"
			class="block w-full max-w-xs rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
		/>
		<button type="button" onclick={() => setAll(true)} class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Alle wählen</button>
		<button type="button" onclick={() => setAll(false)} class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Keine</button>
	</div>

	<p class="mt-2 text-xs text-gray-500">{filtered.length} von {data.products.length} Produkten</p>

	<ul class="mt-2 max-w-2xl divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
		{#each filtered as product (product.productId)}
			{@const linked = isLinked(product.productId)}
			<li class="flex items-center gap-3 px-4 py-2.5 {linked ? 'opacity-60' : ''}">
				<input
					type="checkbox"
					checked={!linked && selected[product.productId]}
					disabled={linked}
					onchange={(e) => (selected[product.productId] = e.currentTarget.checked)}
					class="h-5 w-5 shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-600 disabled:opacity-40"
				/>
				{#if product.imageId}
					<img src={`/api/picnic/image/${product.imageId}`} alt="" loading="lazy" class="h-10 w-10 shrink-0 rounded-lg border border-gray-100 bg-white object-contain" />
				{:else}
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">📦</div>
				{/if}
				<div class="min-w-0 flex-1">
					<div class="truncate text-sm font-medium">{product.name}</div>
					<div class="text-xs text-gray-500">
						{product.unitQuantity}
						· {product.timesOrdered}× bestellt
						{#if product.lastOrderedAt}· zuletzt {formatDate(product.lastOrderedAt)}{/if}
					</div>
				</div>
				{#if linked}
					<span class="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">vorhanden</span>
				{/if}
			</li>
		{/each}
	</ul>

	<form
		method="POST"
		action="?/import"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				submitting = false;
				await update();
				await invalidateAll();
			};
		}}
		class="mt-4 max-w-2xl"
	>
		<input type="hidden" name="products" value={productsJson} />
		<div class="flex flex-wrap items-end gap-3">
			<div>
				<label for="loc" class="block text-xs font-medium text-gray-500">Standard-Lagerort für alle (optional)</label>
				<select id="loc" name="defaultLocationId" bind:value={defaultLocationId} class="mt-1 block rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600">
					<option value="">—</option>
					{#each data.locations as location (location.id)}
						<option value={String(location.id)}>{location.name}</option>
					{/each}
				</select>
			</div>
			<button
				type="submit"
				disabled={submitting || selectedProducts.length === 0}
				class="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
			>
				{submitting ? 'Importiere …' : `${selectedProducts.length} Artikel importieren`}
			</button>
		</div>
	</form>
{/if}
