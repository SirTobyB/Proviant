<script lang="ts">
	import { deserialize } from '$app/forms';
	import { translator, BCP47, type MessageKey } from '#lib/i18n/index.js';
	import { refreshAll } from '$app/navigation';
	import { onDestroy } from 'svelte';

	let { data } = $props();

	const t = $derived(translator(data.locale));

	let query = $state('');
	// Auswahl je Produkt-ID; neu Ladbares (nicht Verknüpftes) ist vorausgewählt
	// svelte-ignore state_referenced_locally
	let selected = $state<Record<string, boolean>>(
		Object.fromEntries(data.products.map((p) => [p.productId, !data.linkedIds.includes(p.productId)]))
	);
	let defaultLocationId = $state('');

	const filtered = $derived(
		data.products.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
	);
	const selectedProducts = $derived(
		data.products.filter((p) => selected[p.productId] && !data.linkedIds.includes(p.productId))
	);

	type Bulk = {
		total: number;
		done: number;
		imported: number;
		skipped: number;
		withoutFacts: string[];
		running: boolean;
		cancelled: boolean;
		stopReason: string | null;
	};
	let bulk = $state<Bulk | null>(null);
	let cancelRequested = false;
	// Seite verlassen bricht ab, sonst liefe die Schleife unsichtbar weiter
	onDestroy(() => (cancelRequested = true));

	// Bei diesen Fehlern scheitert auch jeder weitere Artikel — weitermachen
	// hieße nur, Picnic weiter anzufragen (beim Ratelimit sogar schädlich)
	const FATAL_KINDS = new Set(['rateLimited', 'sessionExpired', 'needs2FA', 'notConfigured', 'invalidCredentials', 'unreachable']);

	// Bewusst ein Artikel nach dem anderen: Der Server drosselt die
	// Picnic-Abrufe zusätzlich auf einen Mindestabstand (picnic/throttle.ts).
	async function importSelected() {
		const queue = [...selectedProducts];
		cancelRequested = false;
		bulk = { total: queue.length, done: 0, imported: 0, skipped: 0, withoutFacts: [], running: true, cancelled: false, stopReason: null };
		for (const product of queue) {
			if (cancelRequested) {
				bulk.cancelled = true;
				break;
			}
			const body = new FormData();
			body.set('productId', product.productId);
			body.set('name', product.name);
			body.set('unitQuantity', product.unitQuantity);
			body.set('imageId', product.imageId ?? '');
			body.set('defaultLocationId', defaultLocationId);
			let result;
			try {
				const response = await fetch('?/importOne', { method: 'POST', body });
				result = deserialize(await response.text());
			} catch {
				result = null;
			}
			if (result?.type === 'success') {
				bulk.done++;
				if (result.data?.created) bulk.imported++;
				else bulk.skipped++;
				// Artikel ist angelegt, nur die Produktdaten fehlen
				const kind = result.data?.picnicError;
				if (typeof kind === 'string') {
					bulk.withoutFacts.push(product.name);
					if (FATAL_KINDS.has(kind)) {
						// Die Art kommt aus picnicErrorKind(), zu jeder gibt es einen Text
						bulk.stopReason = t(`picnic.error.${kind}` as MessageKey);
						break;
					}
				}
			} else if (result?.type === 'failure') {
				bulk.stopReason = String(result.data?.message ?? '');
				break;
			} else {
				// Netzfehler oder Umleitung (z.B. Anmeldung abgelaufen)
				bulk.stopReason = t('recipeImport.bulk.connectionLost');
				break;
			}
		}
		bulk.running = false;
		// Markierung „vorhanden" auffrischen
		await refreshAll();
	}

	const sources = [
		{ key: 'lieferungen', label: 'itemImport.source.deliveries' },
		{ key: 'favoriten', label: 'itemImport.source.favourites' }
	] as const;

	function isLinked(id: string): boolean {
		return data.linkedIds.includes(id);
	}

	function setAll(value: boolean) {
		for (const p of filtered) {
			if (!isLinked(p.productId)) selected[p.productId] = value;
		}
	}

	function formatDate(iso: string | null): string {
		return iso ? new Date(iso).toLocaleDateString(BCP47[data.locale]) : '';
	}
</script>

<svelte:head><title>{t('itemImport.title')} – Proviant</title></svelte:head>

<div class="flex items-center gap-2">
	<a href="/artikel" class="text-sm text-gray-500 hover:text-gray-700">← {t('itemImport.back')}</a>
</div>
<h1 class="mt-1 text-2xl font-bold">{t('itemImport.title')}</h1>
<p class="mt-1 text-sm text-gray-500">
	{t('itemImport.description')}
</p>

<nav class="mt-4 flex flex-wrap gap-1.5" aria-label={t('itemImport.sources')}>
	{#each sources as source (source.key)}
		<a
			href={source.key === 'lieferungen' ? '/artikel/import' : `/artikel/import?quelle=${source.key}`}
			aria-current={data.source === source.key ? 'page' : undefined}
			class="rounded-full px-3 py-1 text-sm font-medium {data.source === source.key ? 'bg-green-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}"
		>
			{t(source.label)}
		</a>
	{/each}
</nav>

{#if data.connection !== 'connected'}
	<div class="mt-6 max-w-2xl rounded-xl border border-gray-200 bg-white p-6 text-center">
		<div class="text-3xl">🔌</div>
		<p class="mt-2 font-medium">{t('recipeImport.notConnected')}</p>
		<p class="mt-1 text-sm text-gray-500">
			{t('recipeImport.connectBefore')}<a href="/bestellen" class="text-green-700 underline">{t('nav.order')}</a>{t('recipeImport.connectAfter')}
		</p>
	</div>
{:else if data.error}
	<div class="mt-6 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{data.error}</div>
{:else}
	{#if bulk}
		<div class="mt-4 max-w-2xl rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm" aria-live="polite">
			{#if bulk.running}
				<p class="font-medium">{t('itemImport.progress', { done: bulk.done, total: bulk.total })}</p>
				<div class="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
					<div class="h-full rounded-full bg-green-600 transition-all" style="width: {bulk.total > 0 ? (bulk.done / bulk.total) * 100 : 0}%"></div>
				</div>
				<p class="mt-1 text-xs text-gray-500">{t('itemImport.hint')}</p>
				<button
					type="button"
					onclick={() => (cancelRequested = true)}
					class="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					{t('recipeImport.bulk.cancel')}
				</button>
			{:else}
				<p class="font-medium">
					{bulk.cancelled ? t('recipeImport.bulk.cancelled') : bulk.stopReason ? t('recipeImport.bulk.stopped') : t('recipeImport.bulk.finished')}
				</p>
				<p class="mt-1 text-gray-600">
					{t('itemImport.summary', { imported: bulk.imported, skipped: bulk.skipped })}
					<a href="/artikel" class="underline">{t('itemImport.toItems')}</a>
				</p>
				{#if bulk.stopReason}<p class="mt-1 text-red-700">{bulk.stopReason}</p>{/if}
				{#if bulk.withoutFacts.length > 0}
					<p class="mt-1 text-amber-700">{t('itemImport.withoutFacts', { names: bulk.withoutFacts.join(', ') })}</p>
				{/if}
			{/if}
		</div>
	{/if}

	<div class="mt-4 flex max-w-2xl flex-wrap items-center gap-2">
		<input
			type="search"
			bind:value={query}
			placeholder={t('itemImport.search')}
			class="block w-full max-w-xs rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
		/>
		<button type="button" onclick={() => setAll(true)} class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">{t('itemImport.selectAll')}</button>
		<button type="button" onclick={() => setAll(false)} class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">{t('itemImport.selectNone')}</button>
	</div>

	<p class="mt-2 text-xs text-gray-500">{t('itemImport.counted', { shown: filtered.length, total: data.products.length })}</p>

	<ul class="mt-2 max-w-2xl divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
		{#each filtered as product, index (product.productId)}
			{@const linked = isLinked(product.productId)}
			{#if product.aisle && product.aisle !== filtered[index - 1]?.aisle}
				<li class="bg-gray-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{product.aisle}</li>
			{/if}
			<li class="flex items-center gap-3 px-4 py-2.5 {linked ? 'opacity-60' : ''}">
				<input
					type="checkbox"
					checked={!linked && selected[product.productId]}
					disabled={linked || bulk?.running}
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
						{#if product.timesOrdered}· {t('itemImport.timesOrdered', { n: product.timesOrdered })}{/if}
						{#if product.lastOrderedAt}· {t('itemImport.lastOrdered', { date: formatDate(product.lastOrderedAt) })}{/if}
					</div>
				</div>
				{#if linked}
					<span class="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{t('itemImport.exists')}</span>
				{/if}
			</li>
		{/each}
	</ul>

	<div class="mt-4 flex max-w-2xl flex-wrap items-end gap-3">
		<div>
			<label for="loc" class="block text-xs font-medium text-gray-500">{t('itemImport.defaultLocation')}</label>
			<select id="loc" bind:value={defaultLocationId} disabled={bulk?.running} class="mt-1 block rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600">
				<option value="">—</option>
				{#each data.locations as location (location.id)}
					<option value={String(location.id)}>{location.name}</option>
				{/each}
			</select>
		</div>
		<button
			type="button"
			onclick={importSelected}
			disabled={bulk?.running || selectedProducts.length === 0}
			class="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
		>
			{bulk?.running ? t('recipeImport.importing') : t('itemImport.submit', { n: selectedProducts.length })}
		</button>
	</div>
{/if}
