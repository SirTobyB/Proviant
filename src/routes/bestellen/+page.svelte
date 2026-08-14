<script lang="ts">
	import { keepValues } from '$lib/forms';
	import { translator } from '$lib/i18n';
	import { packageSize } from '$lib/format';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const t = $derived(translator(data.locale));

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

	// Schluessel entsprechen den Zustaenden des Picnic-Adapters
	const connectionLabel = $derived((zustand: string) =>
		zustand === 'unconfigured' || zustand === 'disconnected' || zustand === 'needs2FA' || zustand === 'connected'
			? t(`order.state.${zustand}`)
			: zustand
	);

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

<svelte:head><title>{t('order.title')} – LebensmittelKumpel</title></svelte:head>

<h1 class="text-2xl font-bold">{t('order.title')}</h1>
<p class="mt-1 text-sm text-gray-500">{t('order.subtitle')}</p>

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
		<span class="text-sm font-medium">{connectionLabel(connection)}</span>
	</div>

	{#if connection === 'unconfigured'}
		<p class="mt-2 text-sm text-gray-500">
			{t('order.unconfiguredHint', { username: 'PICNIC_USERNAME', password: 'PICNIC_PASSWORD' })}
		</p>
	{:else if connection === 'disconnected'}
		<form method="POST" action="?/connect" use:enhance class="mt-3">
			<button type="submit" class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
				{t('order.connect')}
			</button>
		</form>
	{:else if connection === 'needs2FA'}
		<div class="mt-3 space-y-3">
			<form method="POST" action="?/send2FACode" use:enhance>
				<button type="submit" class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
					{codeSent ? t('order.resendCode') : t('order.requestCode')}
				</button>
			</form>
			<form method="POST" action="?/verify2FA" use:enhance class="flex gap-2">
				<input
					name="code"
					type="text"
					inputmode="numeric"
					placeholder={t('order.codePlaceholder')}
					class="block w-40 rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
				/>
				<button type="submit" class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
					{t('order.confirmCode')}
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
		{t('order.added', { packs: t('common.packs', { n: form.totalUnits }), items: t('order.addedItems', { n: form.added }) })}
		{#if form.skipped.length > 0}
			<div class="mt-1 text-green-700">{t('order.skipped', { names: form.skipped.join(', ') })}</div>
		{/if}
	</div>
{/if}
{#if form && 'notInCart' in form && form.notInCart?.length}
	<div class="mt-4 max-w-2xl rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
		{t('order.notInCart', { names: form.notInCart.join(', ') })}
	</div>
{/if}
{#if data.cartUnavailable || data.openOrdersUnavailable}
	<div class="mt-4 max-w-2xl rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
		{#if data.cartUnavailable && data.openOrdersUnavailable}
			{t('order.cartAndOrdersUnavailable')}
		{:else if data.cartUnavailable}
			{t('order.cartUnavailable')}
		{:else}
			{t('order.openOrdersUnavailable')}
		{/if}
		{t('order.unavailableSuffix')}
	</div>
{/if}

<!-- Vorschlagsliste -->
{#if data.suggestions.length === 0}
	<div class="mt-6 max-w-2xl rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
		{t('order.empty')}
		{#if data.covered.length > 0}
			<div class="mt-2 text-xs text-gray-400">{t('order.covered', { names: data.covered.join(', ') })}</div>
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
					{allSelected ? t('order.deselectAll') : t('order.selectAll')}
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
							{packageSize(item.amount, item.unit, data.locale, t)} · {t('order.stock', { stock: item.stock, min: item.minStock })}
							{#if item.inCartQty > 0}
								· {t('order.inCart', { n: item.inCartQty })}
							{/if}
							{#if item.onOrderQty > 0}
								· {t('order.onOrder', { n: item.onOrderQty })}
							{/if}
							{#if !item.picnicId}
								· <a href={`/artikel/${item.id}`} class="text-amber-600 underline">{t('order.linkPicnic')}</a>
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
			{t('order.submit', { n: selectedCount })}
		</button>
		{#if connection !== 'connected'}
			<p class="mt-2 text-xs text-gray-500">{t('order.connectFirst')}</p>
		{/if}
		{#if data.covered.length > 0}
			<p class="mt-2 text-xs text-gray-400">{t('order.coveredNotSuggested', { names: data.covered.join(', ') })}</p>
		{/if}
	</form>
{/if}
