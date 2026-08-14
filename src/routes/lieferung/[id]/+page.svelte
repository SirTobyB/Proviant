<script lang="ts">
	import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { translator } from '$lib/i18n';

	let { data } = $props();

	const t = $derived(translator(data.locale));

	// Einzelimport einer nicht verknüpften Position als Artikel
	let importingProduct = $state<string | null>(null);
	async function importArticle(item: Item) {
		importingProduct = item.productId;
		const body = new FormData();
		body.set('productId', item.productId);
		body.set('name', item.name);
		body.set('unitQuantity', item.unitQuantity);
		body.set('imageId', item.imageId ?? '');
		const response = await fetch('?/importArticle', { method: 'POST', body });
		const result = deserialize(await response.text());
		importingProduct = null;
		if (result.type === 'success') {
			showToast(t('delivery.toast.created', { name: item.name }));
			await invalidateAll(); // Position erscheint jetzt als verknüpft
		} else {
			showToast(t('delivery.toast.importFailed'), 'warn');
		}
	}

	type Item = (typeof data.items)[number];

	// Bildquelle: eigenes Artikelbild bevorzugt, sonst das Picnic-Produktbild
	function itemImage(item: Item): string | null {
		if (item.imagePath) return `/api/images/${item.imagePath}`;
		if (item.imageId) return `/api/picnic/image/${item.imageId}`;
		return null;
	}

	// Geprüfte (und ggf. eingebuchte) Anzahl je Produkt; Initialwert genügt
	// svelte-ignore state_referenced_locally
	let checked = $state<Record<string, number>>(
		Object.fromEntries(data.items.map((i) => [i.productId, 0]))
	);

	// Chargen, die diese Seite selbst eingebucht hat — je Produkt als Stapel.
	// Nur damit lässt sich "−" ehrlich beantworten: Es nimmt die jeweils letzte
	// eigene Buchung zurück, statt per FEFO eine beliebige Charge zu treffen.
	let bookedEntries = $state<Record<string, number[]>>({});

	function rememberEntry(productId: string, entryId: unknown) {
		if (typeof entryId !== 'number') return;
		(bookedEntries[productId] ??= []).push(entryId);
	}

	/** Grund einer Picnic-Stornierung; unbekannte Codes nicht erfinden. */
	function cancelReasonText(reason: string | null): string {
		if (reason === 'PRODUCT_NOT_SHIPPED') return t('delivery.cancelReason.PRODUCT_NOT_SHIPPED');
		if (reason === 'PRODUCT_ABSENT') return t('delivery.cancelReason.PRODUCT_ABSENT');
		if (reason === 'PRODUCT_LOW_QUALITY') return t('delivery.cancelReason.PRODUCT_LOW_QUALITY');
		return t('delivery.cancelReason.unknown');
	}

	// Scan-Bestätigung: matched item wartet auf Einbuchen
	type Pending = { item: Item; locationId: string; bestBefore: string };
	let pending = $state<Pending | null>(null);
	let scannerKey = $state(0);
	let toast = $state('');
	let toastKind = $state<'ok' | 'warn'>('ok');
	let unknownEan = $state('');
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	// Sichtprüfung: alle offenen Positionen auf einmal bestätigen
	let showBulk = $state(false);
	// svelte-ignore state_referenced_locally
	let bulkLocation = $state(data.locations[0] ? String(data.locations[0].id) : '');
	const openCount = $derived(data.items.filter((i) => (checked[i.productId] ?? 0) < i.quantity).length);

	// Soll = bestellt abzüglich der von Picnic stornierten Gebinde: Was gar nicht
	// erst geliefert wird, darf die Prüfung nicht offen halten.
	const totalExpected = $derived(data.items.reduce((sum, i) => sum + i.quantity, 0));
	const totalChecked = $derived(Object.values(checked).reduce((sum, n) => sum + n, 0));
	const allDone = $derived(
		data.items.length > 0 && data.items.every((i) => (checked[i.productId] ?? 0) >= i.quantity)
	);

	// Abschluss mit Fehlbestand: was bestellt war, aber nicht angekommen ist
	let showMissing = $state(false);
	let missingConfirmed = $state(false);
	let recordingMissing = $state(false);
	const missingItems = $derived(
		data.items
			.map((i) => ({ item: i, quantity: i.quantity - (checked[i.productId] ?? 0) }))
			.filter((m) => m.quantity > 0)
	);
	const totalMissing = $derived(missingItems.reduce((sum, m) => sum + m.quantity, 0));
	const cancelledItems = $derived(data.items.filter((i) => i.cancelledQuantity > 0));

	function showToast(message: string, kind: 'ok' | 'warn' = 'ok') {
		toast = message;
		toastKind = kind;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 3500);
	}

	function resetScanner() {
		pending = null;
		unknownEan = '';
		scannerKey += 1;
	}

	async function onDetect(ean: string) {
		const response = await fetch(`/api/articles/by-ean/${encodeURIComponent(ean)}`);
		const result = await response.json();
		if (!result.found || !result.article) {
			unknownEan = ean;
			showToast(t('delivery.toast.unknownBarcode', { ean }), 'warn');
			return;
		}
		const article = result.article;
		const item = data.items.find((i) => i.productId === article.picnicId);
		if (!item) {
			showToast(t('delivery.toast.notInDelivery', { name: article.name }), 'warn');
			resetScanner();
			return;
		}
		if ((checked[item.productId] ?? 0) >= item.quantity) {
			showToast(t('delivery.toast.alreadyChecked', { name: item.name }), 'warn');
			resetScanner();
			return;
		}
		pending = {
			item,
			locationId: item.defaultLocationId != null ? String(item.defaultLocationId) : '',
			bestBefore: ''
		};
	}

	async function confirmBooking() {
		if (!pending) return;
		const { item, locationId, bestBefore } = pending;
		if (!locationId) {
			showToast(t('delivery.toast.pickLocation'), 'warn');
			return;
		}
		const body = new FormData();
		body.set('articleId', String(item.articleId));
		body.set('locationId', locationId);
		body.set('bestBefore', bestBefore);
		body.set('quantity', '1');
		const response = await fetch('?/book', { method: 'POST', body });
		const result = deserialize(await response.text());
		if (result.type === 'success') {
			checked[item.productId] = (checked[item.productId] ?? 0) + 1;
			rememberEntry(item.productId, (result.data as { entryId?: number }).entryId);
			showToast(t('delivery.toast.booked', { name: item.name, checked: checked[item.productId], total: item.quantity }));
			resetScanner();
		} else {
			const message = result.type === 'failure' ? (result.data?.message as string) : undefined;
			showToast(message ?? t('delivery.toast.bookFailed'), 'warn');
		}
	}

	// Sichtprüfung bestätigen: ALLE offenen Positionen auf einmal in ihren
	// Standard-Lagerort (sonst Fallback) buchen; noch nicht im Artikelstamm
	// vorhandene Produkte werden dabei serverseitig automatisch angelegt.
	async function confirmAll() {
		const open = data.items
			.filter((i) => i.quantity - (checked[i.productId] ?? 0) > 0)
			.map((i) => ({
				productId: i.productId,
				quantity: i.quantity - (checked[i.productId] ?? 0),
				name: i.name,
				unitQuantity: i.unitQuantity,
				imageId: i.imageId ?? ''
			}));

		const body = new FormData();
		body.set('items', JSON.stringify(open));
		body.set('fallbackLocationId', bulkLocation);
		const response = await fetch('?/confirmAll', { method: 'POST', body });
		const result = deserialize(await response.text());
		if (result.type === 'success') {
			// Alles als gesehen markieren
			for (const i of data.items) checked[i.productId] = i.quantity;
			const data_ = result.data as { booked: number; imported: number; noLocation: string[]; failed: string[] };
			let suffix = data_.imported ? t('delivery.toast.bulkImported', { n: data_.imported }) : '';
			if (data_.noLocation?.length) suffix += ` · ohne Lagerort übersprungen: ${data_.noLocation.join(', ')}`;
			if (data_.failed?.length) suffix += ` · fehlgeschlagen: ${data_.failed.join(', ')}`;
			showToast(t('delivery.toast.bulkDone', { packs: t('common.packs', { n: data_.booked }) }) + suffix, data_.failed?.length ? 'warn' : 'ok');
			showBulk = false;
			await invalidateAll(); // neu angelegte Artikel als verknüpft anzeigen
			resetScanner();
		} else {
			showToast(t('delivery.toast.bulkFailed'), 'warn');
		}
	}

	// "−": nimmt die letzte eigene Buchung dieser Position zurück und bucht sie
	// wieder aus. Nur den Zähler zu senken wäre die gefährlichere Variante: Der
	// Bestand bliebe stehen, obwohl die Seite „0 geprüft" anzeigt.
	let unbookingProduct = $state<string | null>(null);
	async function unbook(item: Item) {
		if (unbookingProduct || (checked[item.productId] ?? 0) === 0) return;
		const stack = bookedEntries[item.productId] ?? [];
		const entryId = stack.at(-1);

		// Kein eigener Eintrag (z.B. Zähler kam aus der Sammelbestätigung vor einem
		// Neuladen): dann nur den Zähler korrigieren und das auch so sagen
		if (entryId === undefined) {
			checked[item.productId] = Math.max(0, (checked[item.productId] ?? 0) - 1);
			showToast(t('delivery.toast.unbookedCounterOnly', { name: item.name }), 'warn');
			return;
		}

		unbookingProduct = item.productId;
		const body = new FormData();
		body.set('entryId', String(entryId));
		const response = await fetch('?/unbookOne', { method: 'POST', body });
		const result = deserialize(await response.text());
		unbookingProduct = null;
		if (result.type === 'success') {
			stack.pop();
			checked[item.productId] = Math.max(0, (checked[item.productId] ?? 0) - 1);
			const data_ = result.data as { taken: number; locationName: string };
			showToast(
				data_.taken > 0
					? t('delivery.toast.unbooked', { name: item.name, location: data_.locationName })
					: t('delivery.toast.unbookedCounterOnly', { name: item.name }),
				data_.taken > 0 ? 'ok' : 'warn'
			);
			await invalidateAll();
		} else {
			showToast(t('delivery.toast.unbookFailed'), 'warn');
		}
	}

	// Abschluss der Prüfung mit Fehlbestand: schreibt je fehlender Position eine
	// Journalzeile (Bestand entsteht dabei bewusst keiner)
	async function confirmMissing() {
		recordingMissing = true;
		const body = new FormData();
		body.set(
			'items',
			JSON.stringify(missingItems.map((m) => ({ productId: m.item.productId, quantity: m.quantity })))
		);
		const response = await fetch('?/confirmMissing', { method: 'POST', body });
		const result = deserialize(await response.text());
		recordingMissing = false;
		if (result.type === 'success') {
			const recorded = (result.data as { recorded: number }).recorded;
			missingConfirmed = true;
			showMissing = false;
			showToast(t('delivery.toast.missingRecorded', { packs: t('common.packs', { n: recorded }) }));
		} else {
			showToast(t('delivery.toast.missingFailed'), 'warn');
		}
	}

	// "+": bucht 1 Gebinde wirklich ein (Standard-Lagerort des Artikels, sonst
	// Fallback) und legt den Artikel vorher automatisch aus Picnic an, falls er fehlt
	let bookingProduct = $state<string | null>(null);
	async function bookAndCheck(item: Item) {
		if (bookingProduct) return;
		bookingProduct = item.productId;
		const body = new FormData();
		body.set('productId', item.productId);
		body.set('name', item.name);
		body.set('unitQuantity', item.unitQuantity);
		body.set('imageId', item.imageId ?? '');
		body.set('fallbackLocationId', bulkLocation);
		const response = await fetch('?/bookOne', { method: 'POST', body });
		const result = deserialize(await response.text());
		bookingProduct = null;
		if (result.type === 'success') {
			checked[item.productId] = (checked[item.productId] ?? 0) + 1;
			const data_ = result.data as { created: boolean; locationName: string; entryId?: number };
			rememberEntry(item.productId, data_.entryId);
			const created = data_.created ? t('delivery.toast.createdSuffix') : '';
			showToast(t('delivery.toast.bookedOne', { name: item.name, location: data_.locationName }) + created);
			await invalidateAll();
		} else {
			const message = result.type === 'failure' ? (result.data?.message as string) : undefined;
			showToast(message ?? t('delivery.toast.bookFailed'), 'warn');
		}
	}

	function itemStatus(item: Item): 'open' | 'done' {
		return (checked[item.productId] ?? 0) >= item.quantity ? 'done' : 'open';
	}
</script>

<svelte:head><title>{t('delivery.title')} – Proviant</title></svelte:head>

<div class="flex items-center gap-2">
	<a href="/lieferung" class="text-sm text-gray-500 hover:text-gray-700">← {t('delivery.back')}</a>
</div>
<h1 class="mt-1 text-2xl font-bold">{t('delivery.title')}</h1>

<!-- Fortschritt -->
<div class="mt-3 max-w-md">
	<div class="flex items-center justify-between text-sm">
		<span class="font-medium">{t('delivery.progress', { checked: totalChecked, total: totalExpected })}</span>
		{#if allDone}<span class="font-semibold text-green-700">{t('delivery.allThere')}</span>{/if}
	</div>
	<div class="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
		<div class="h-full rounded-full bg-green-600 transition-all" style={`width: ${totalExpected ? (totalChecked / totalExpected) * 100 : 0}%`}></div>
	</div>

	<!-- Von Picnic storniert: gehört nicht ins Soll, muss aber erklärt werden -->
	{#if cancelledItems.length > 0}
		<div class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
			{#each cancelledItems as item (item.productId)}
				<div>
					<span class="font-medium">{item.name}</span> ·
					{t('delivery.cancelledNote', {
						n: item.cancelledQuantity,
						reason: cancelReasonText(item.cancelReason)
					})}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Sichtprüfung: alles auf einmal bestätigen -->
	{#if !allDone && !missingConfirmed}
		{#if !showBulk && !showMissing}
			<button
				type="button"
				onclick={() => (showBulk = true)}
				class="mt-3 w-full rounded-lg border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
			>
				{t('delivery.bulkOpen', { n: openCount })}
			</button>
			<!-- Abschluss trotz Fehlbestand: ohne das bliebe die Prüfung ewig offen,
			     wenn Picnic etwas schuldig geblieben ist -->
			<button
				type="button"
				onclick={() => (showMissing = true)}
				class="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				{t('delivery.finishOpen', { n: totalMissing })}
			</button>
		{:else if showMissing}
			<div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
				<p class="text-sm text-amber-900">{t('delivery.missingExplain')}</p>
				<ul class="mt-3 space-y-1 text-sm text-amber-900">
					{#each missingItems as missing (missing.item.productId)}
						<li class="flex items-baseline justify-between gap-2">
							<span class="min-w-0 truncate">{missing.item.name}</span>
							<span class="shrink-0 font-semibold">{missing.quantity}×</span>
						</li>
					{/each}
				</ul>
				<div class="mt-3 flex gap-2">
					<button
						type="button"
						onclick={confirmMissing}
						disabled={recordingMissing}
						class="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
					>
						{t('delivery.missingConfirm')}
					</button>
					<button type="button" onclick={() => (showMissing = false)} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
						{t('form.cancel')}
					</button>
				</div>
			</div>
		{:else}
			<div class="mt-3 rounded-xl border border-gray-200 bg-white p-4">
				<p class="text-sm text-gray-700">
					{t('delivery.bulkExplain')}
				</p>
				<label for="bulkLoc" class="mt-3 block text-xs font-medium text-gray-500">{t('delivery.bulkLocation')}</label>
				<select id="bulkLoc" bind:value={bulkLocation} class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600">
					{#each data.locations as location (location.id)}
						<option value={String(location.id)}>{location.name}</option>
					{/each}
				</select>
				<div class="mt-3 flex gap-2">
					<button type="button" onclick={confirmAll} class="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
						{t('delivery.bulkConfirm')}
					</button>
					<button type="button" onclick={() => (showBulk = false)} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
						{t('form.cancel')}
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

{#if toast}
	<div class="mt-4 max-w-md rounded-lg px-4 py-3 text-sm font-medium {toastKind === 'ok' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}">
		{toast}
		{#if unknownEan}
			<a href={`/artikel/neu?ean=${unknownEan}`} class="ml-1 underline">{t('delivery.createArticle')}</a>
		{/if}
	</div>
{/if}

<!-- Scanner oder Bestätigungskarte -->
<div class="mt-4 max-w-md">
	{#if pending}
		{@const item = pending.item}
		<div class="rounded-xl border border-gray-200 bg-white p-4">
			<div class="flex items-center gap-3">
				{#if item.articleId}
					<a href={`/artikel/${item.articleId}`} class="shrink-0">
						{#if itemImage(item)}
							<img src={itemImage(item)} alt="" class="h-12 w-12 rounded-lg border border-gray-100 bg-white object-contain" />
						{:else}
							<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-lg">📦</div>
						{/if}
					</a>
				{:else if itemImage(item)}
					<img src={itemImage(item)} alt="" class="h-12 w-12 shrink-0 rounded-lg border border-gray-100 bg-white object-contain" />
				{:else}
					<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg">📦</div>
				{/if}
				<div class="min-w-0">
					{#if item.articleId}
						<a href={`/artikel/${item.articleId}`} class="block truncate font-semibold hover:underline">{item.name}</a>
					{:else}
						<div class="truncate font-semibold">{item.name}</div>
					{/if}
					<div class="text-xs text-gray-500">{item.unitQuantity} · {t('delivery.checkedOf', { checked: checked[item.productId] ?? 0, total: item.quantity })}</div>
				</div>
			</div>
			<div class="mt-3 grid grid-cols-2 gap-2">
				<div>
					<label for="loc" class="block text-xs font-medium text-gray-500">{t('delivery.targetLocation')}</label>
					<select id="loc" bind:value={pending.locationId} class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600">
						<option value="" disabled>—</option>
						{#each data.locations as location (location.id)}
							<option value={String(location.id)}>{location.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="bb" class="block text-xs font-medium text-gray-500">{t('delivery.bestBefore')}</label>
					<input id="bb" type="date" bind:value={pending.bestBefore} class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
				</div>
			</div>
			<div class="mt-3 flex gap-2">
				<button type="button" onclick={confirmBooking} class="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
					{t('delivery.bookAndNext')}
				</button>
				<button type="button" onclick={resetScanner} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
					{t('delivery.skip')}
				</button>
			</div>
		</div>
	{:else if allDone || missingConfirmed}
		{@const withMissing = missingConfirmed && !allDone}
		<div class="rounded-xl border p-6 text-center {withMissing ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}">
			<div class="text-3xl">{withMissing ? '📋' : '✅'}</div>
			<p class="mt-2 font-semibold {withMissing ? 'text-amber-800' : 'text-green-800'}">
				{withMissing ? t('delivery.doneWithMissing') : t('delivery.done')}
			</p>
			{#if withMissing}
				<p class="mt-1 text-sm text-amber-700">{t('delivery.missingSummary', { n: totalMissing })}</p>
			{/if}
			<a href="/" class="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white {withMissing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}">{t('delivery.toStock')}</a>
		</div>
	{:else}
		{#key scannerKey}
			<BarcodeScanner {onDetect} />
		{/key}
	{/if}
</div>

<!-- Checkliste -->
<h2 class="mt-8 text-sm font-semibold text-gray-700">{t('delivery.lines')}</h2>
<ul class="mt-2 max-w-md divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
	{#each data.items as item (item.productId)}
		{@const done = itemStatus(item) === 'done'}
		<li class="flex items-center gap-3 px-4 py-2.5 {done ? 'bg-green-50/50' : ''}">
			{#if item.articleId}
				<a href={`/artikel/${item.articleId}`} class="flex min-w-0 flex-1 items-center gap-3">
					{#if itemImage(item)}
						<img src={itemImage(item)} alt="" loading="lazy" class="h-9 w-9 shrink-0 rounded-lg border border-gray-100 bg-white object-contain" />
					{:else}
						<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm">📦</div>
					{/if}
					<div class="min-w-0 flex-1">
						<div class="truncate text-sm font-medium hover:underline {done ? 'text-gray-500 line-through' : ''}">{item.name}</div>
						<div class="text-xs text-gray-500">
							{item.unitQuantity}
							{#if item.cancelledQuantity > 0}
								· <span class="text-amber-600">{t('delivery.cancelled')}</span>
							{/if}
						</div>
					</div>
				</a>
			{:else}
				{#if itemImage(item)}
					<img src={itemImage(item)} alt="" loading="lazy" class="h-9 w-9 shrink-0 rounded-lg border border-gray-100 bg-white object-contain" />
				{:else}
					<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm">📦</div>
				{/if}
				<div class="min-w-0 flex-1">
					<div class="truncate text-sm font-medium {done ? 'text-gray-500 line-through' : ''}">{item.name}</div>
					<div class="text-xs text-gray-500">
						{item.unitQuantity}
						{#if item.cancelledQuantity > 0}
							· <span class="text-amber-600">{t('delivery.cancelled')}</span>
						{/if}
						· <span class="text-amber-600">{t('delivery.notLinked')}</span>
						· <button
								type="button"
								onclick={() => importArticle(item)}
								disabled={importingProduct !== null}
								class="text-green-700 underline disabled:opacity-50"
							>{importingProduct === item.productId ? t('delivery.importing') : t('delivery.addArticle')}</button>
					</div>
				</div>
			{/if}
			<div class="flex shrink-0 items-center gap-1.5">
				<button type="button" onclick={() => unbook(item)} disabled={(checked[item.productId] ?? 0) === 0 || unbookingProduct !== null} class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30">−</button>
				<span class="w-10 text-center text-sm font-semibold {done ? 'text-green-700' : 'text-gray-700'}">{checked[item.productId] ?? 0}/{item.quantity}</span>
				<button type="button" onclick={() => bookAndCheck(item)} disabled={done || bookingProduct !== null} class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30">+</button>
			</div>
		</li>
	{/each}
</ul>
<p class="mt-2 max-w-md text-xs text-gray-500">
	{t('delivery.hint')}
</p>
