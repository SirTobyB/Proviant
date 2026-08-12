<script lang="ts">
	import { keepValues } from '$lib/forms';
	import { packageSize } from '$lib/format';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	// Auswahl und Mengen pro Vorschlag (Fehlmenge vorbelegt)
	const defaultSelected = () =>
		Object.fromEntries(data.suggestions.map((s) => [s.id, Boolean(s.picnicId)]));
	const defaultQuantities = () => Object.fromEntries(data.suggestions.map((s) => [s.id, s.needed]));

	// svelte-ignore state_referenced_locally
	let selected = $state<Record<number, boolean>>(defaultSelected());
	// svelte-ignore state_referenced_locally
	let quantities = $state<Record<number, number>>(defaultQuantities());

	// Nach jedem Neuladen der Daten (v.a. nach dem Bestellen) neu vorbelegen:
	// sonst behalten die Felder Werte von vorher — für neu hinzugekommene
	// Vorschläge gäbe es gar keinen Eintrag und das Mengenfeld bliebe leer.
	$effect(() => {
		data.suggestions;
		selected = defaultSelected();
		quantities = defaultQuantities();
	});

	const connectionLabel: Record<string, string> = {
		unconfigured: 'Keine Zugangsdaten hinterlegt',
		disconnected: 'Nicht verbunden',
		needs2FA: 'Bestätigung per SMS-Code nötig',
		connected: 'Mit Picnic verbunden'
	};

	// Nach dem 2FA-Code-Versand das Eingabefeld zeigen
	let codeSent = $state(false);
	$effect(() => {
		if (form && 'codeSent' in form && form.codeSent) codeSent = true;
	});

	const connection = $derived(
		form && 'connection' in form && form.connection ? form.connection : data.connection
	);

	const selectedCount = $derived(
		data.suggestions.filter((s) => selected[s.id] && s.picnicId).length
	);

	// Alle an-/abwählen (nur Picnic-verknüpfte — die übrigen sind disabled)
	const selectableCount = $derived(data.suggestions.filter((s) => s.picnicId).length);
	const allSelected = $derived(selectableCount > 0 && selectedCount === selectableCount);
	function toggleAll() {
		// Zielwert einmal vorab festhalten: allSelected wird sonst schon nach der
		// ersten Zuweisung neu berechnet und kippt mitten in der Schleife
		const next = !allSelected;
		for (const s of data.suggestions) {
			if (s.picnicId) selected[s.id] = next;
		}
	}

</script>

<svelte:head><title>Bestellen – LebensmittelKumpel</title></svelte:head>

<h1 class="text-2xl font-bold">Bestellen</h1>
<p class="mt-1 text-sm text-gray-500">Artikel unter Mindestbestand → Picnic-Warenkorb</p>

<!-- Verbindungspanel -->
<div class="mt-4 max-w-2xl rounded-xl border border-gray-200 bg-white p-4">
	<div class="flex items-center gap-2">
		<span
			class="h-2.5 w-2.5 shrink-0 rounded-full {connection === 'connected'
				? 'bg-green-500'
				: connection === 'needs2FA'
					? 'bg-amber-500'
					: 'bg-gray-300'}"
		></span>
		<span class="text-sm font-medium">{connectionLabel[connection]}</span>
	</div>

	{#if connection === 'unconfigured'}
		<p class="mt-2 text-sm text-gray-500">
			Hinterlege <code class="rounded bg-gray-100 px-1">PICNIC_USERNAME</code> und
			<code class="rounded bg-gray-100 px-1">PICNIC_PASSWORD</code> in der Umgebung, um den Warenkorb zu befüllen.
		</p>
	{:else if connection === 'disconnected'}
		<form method="POST" action="?/connect" use:enhance class="mt-3">
			<button type="submit" class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
				Mit Picnic verbinden
			</button>
		</form>
	{:else if connection === 'needs2FA'}
		<div class="mt-3 space-y-3">
			<form method="POST" action="?/send2FACode" use:enhance>
				<button type="submit" class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
					{codeSent ? 'Code erneut senden' : 'SMS-Code anfordern'}
				</button>
			</form>
			<form method="POST" action="?/verify2FA" use:enhance class="flex gap-2">
				<input
					name="code"
					type="text"
					inputmode="numeric"
					placeholder="SMS-Code"
					class="block w-40 rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
				/>
				<button type="submit" class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
					Bestätigen
				</button>
			</form>
		</div>
	{/if}
</div>

{#if form?.message}
	<div class="mt-4 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.message}</div>
{/if}
{#if form && 'added' in form && form.added}
	<div class="mt-4 max-w-2xl rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">
		{form.totalUnits} Gebinde ({form.added} Artikel) in den Picnic-Warenkorb gelegt.
		Der Checkout bleibt bewusst in der Picnic-App.
		{#if form.skipped.length > 0}
			<div class="mt-1 text-green-700">Ohne Picnic-Verknüpfung übersprungen: {form.skipped.join(', ')}</div>
		{/if}
	</div>
{/if}
{#if form && 'notInCart' in form && form.notInCart?.length}
	<div class="mt-4 max-w-2xl rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
		Nicht im Warenkorb angekommen: {form.notInCart.join(', ')} — Picnic kennt die hinterlegte
		Produkt-ID vermutlich nicht mehr. Bitte die Picnic-Verknüpfung im Artikel neu setzen.
	</div>
{/if}
{#if data.cartUnavailable || data.openOrdersUnavailable}
	<div class="mt-4 max-w-2xl rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
		{#if data.cartUnavailable && data.openOrdersUnavailable}
			Warenkorb und offene Bestellungen konnten nicht gelesen werden
		{:else if data.cartUnavailable}
			Der Picnic-Warenkorb konnte nicht gelesen werden
		{:else}
			Offene Bestellungen konnten nicht gelesen werden
		{/if}
		— die Vorschläge sind daher nicht vollständig abgeglichen und könnten bereits Bestelltes enthalten.
	</div>
{/if}

<!-- Vorschlagsliste -->
{#if data.suggestions.length === 0}
	<div class="mt-6 max-w-2xl rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
		Alles ausreichend bevorratet — keine Vorschläge. Mindestbestände legst du je Artikel fest.
		{#if data.covered.length > 0}
			<div class="mt-2 text-xs text-gray-400">Bereits im Warenkorb oder bestellt: {data.covered.join(', ')}</div>
		{/if}
	</div>
{:else}
	<!-- reset: false — sonst leert SvelteKits Standard-Reset nach dem Absenden alle
	     Mengen und Haken: Svelte setzt value/checked nur als DOM-Property, das
	     Formular fällt beim Reset also auf leere Attribut-Defaults zurück -->
	<form
		method="POST"
		action="?/addToCart"
		use:enhance={keepValues}
		class="mt-6 max-w-2xl"
	>
		{#if selectableCount > 0}
			<div class="mb-2 flex justify-end">
				<button type="button" onclick={toggleAll} class="text-sm font-medium text-green-700 underline hover:text-green-800">
					{allSelected ? 'Alle abwählen' : 'Alle auswählen'}
				</button>
			</div>
		{/if}
		<ul class="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
			{#each data.suggestions as item (item.id)}
				<li class="flex items-center gap-3 px-4 py-3">
					<input
						type="checkbox"
						name="selected"
						value={item.id}
						checked={selected[item.id]}
						disabled={!item.picnicId}
						onchange={(e) => (selected[item.id] = e.currentTarget.checked)}
						class="h-5 w-5 shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-600 disabled:opacity-40"
					/>
					<a href={`/artikel/${item.id}`} class="shrink-0">
						{#if item.imagePath}
							<img src={`/api/images/${item.imagePath}`} alt="" loading="lazy" class="h-10 w-10 rounded-lg border border-gray-100 object-contain" />
						{:else}
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">📦</div>
						{/if}
					</a>
					<div class="min-w-0 flex-1">
						<a href={`/artikel/${item.id}`} class="block truncate font-medium hover:underline">{item.name}</a>
						<div class="text-xs text-gray-500">
							{packageSize(item.amount, item.unit)} · Bestand {item.stock}/{item.minStock}
							{#if item.inCartQty > 0}
								· {item.inCartQty} im Warenkorb
							{/if}
							{#if item.onOrderQty > 0}
								· {item.onOrderQty} bereits bestellt
							{/if}
							{#if !item.picnicId}
								· <a href={`/artikel/${item.id}`} class="text-amber-600 underline">Picnic verknüpfen</a>
							{/if}
						</div>
					</div>
					<input
						type="number"
						name={`quantity_${item.id}`}
						min="1"
						value={quantities[item.id]}
						oninput={(e) => (quantities[item.id] = Number(e.currentTarget.value))}
						class="w-16 shrink-0 rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
					/>
				</li>
			{/each}
		</ul>

		<button
			type="submit"
			disabled={connection !== 'connected' || selectedCount === 0}
			class="mt-4 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 sm:w-auto"
		>
			{selectedCount} Artikel in den Picnic-Warenkorb
		</button>
		{#if connection !== 'connected'}
			<p class="mt-2 text-xs text-gray-500">Zum Übertragen zuerst oben mit Picnic verbinden.</p>
		{/if}
		{#if data.covered.length > 0}
			<p class="mt-2 text-xs text-gray-400">Bereits im Warenkorb oder bestellt (nicht mehr vorgeschlagen): {data.covered.join(', ')}</p>
		{/if}
	</form>
{/if}
