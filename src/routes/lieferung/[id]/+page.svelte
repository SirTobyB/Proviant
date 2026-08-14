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

	const totalExpected = $derived(data.items.reduce((sum, i) => sum + i.quantity, 0));
	const totalChecked = $derived(Object.values(checked).reduce((sum, n) => sum + n, 0));
	const allDone = $derived(totalExpected > 0 && data.items.every((i) => (checked[i.productId] ?? 0) >= i.quantity));

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

	// "−": nur den Zähler korrigieren (bucht NICHT aus)
	function bump(item: Item, delta: number) {
		const next = Math.max(0, Math.min(item.quantity, (checked[item.productId] ?? 0) + delta));
		checked[item.productId] = next;
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
			const data_ = result.data as { created: boolean; locationName: string };
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

<svelte:head><title>{t('delivery.title')} – LebensmittelKumpel</title></svelte:head>

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

	<!-- Sichtprüfung: alles auf einmal bestätigen -->
	{#if !allDone}
		{#if !showBulk}
			<button
				type="button"
				onclick={() => (showBulk = true)}
				class="mt-3 w-full rounded-lg border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
			>
				{t('delivery.bulkOpen', { n: openCount })}
			</button>
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
	{:else if allDone}
		<div class="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
			<div class="text-3xl">✅</div>
			<p class="mt-2 font-semibold text-green-800">{t('delivery.done')}</p>
			<a href="/" class="mt-3 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">{t('delivery.toStock')}</a>
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
						<div class="text-xs text-gray-500">{item.unitQuantity}</div>
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
				<button type="button" onclick={() => bump(item, -1)} disabled={(checked[item.productId] ?? 0) === 0} class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30">−</button>
				<span class="w-10 text-center text-sm font-semibold {done ? 'text-green-700' : 'text-gray-700'}">{checked[item.productId] ?? 0}/{item.quantity}</span>
				<button type="button" onclick={() => bookAndCheck(item)} disabled={done || bookingProduct !== null} class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30">+</button>
			</div>
		</li>
	{/each}
</ul>
<p class="mt-2 max-w-md text-xs text-gray-500">
	{t('delivery.hint')}
</p>
