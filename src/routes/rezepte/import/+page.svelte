<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import { translator } from '#lib/i18n/index.js';

	let { data, form } = $props();

	const t = $derived(translator(data.locale));

	let query = $state('');
	// Während des Imports den geklickten Eintrag markieren
	let importing = $state<string | null>(null);

	const filtered = $derived(
		data.tiles.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))
	);

	const sources = [
		{ key: 'katalog', label: 'recipeImport.source.catalog' },
		{ key: 'gespeichert', label: 'recipeImport.source.saved' },
		{ key: 'eigene', label: 'recipeImport.source.own' }
	] as const;

	function alreadyImported(name: string): boolean {
		return data.existingNames.includes(name.toLowerCase());
	}

	// „Alle importieren": alle angezeigten (also gefilterten) Rezepte, die es
	// noch nicht gibt
	const pending = $derived(filtered.filter((tile) => !alreadyImported(tile.name)));

	type Bulk = {
		total: number;
		done: number;
		imported: number;
		skipped: number;
		failed: string[];
		current: string | null;
		running: boolean;
		cancelled: boolean;
		stopReason: string | null;
	};
	let bulk = $state<Bulk | null>(null);
	let cancelRequested = false;
	// Seite verlassen bricht ab, sonst liefe die Schleife unsichtbar weiter
	onDestroy(() => (cancelRequested = true));

	// Bei diesen Fehlern scheitert auch jedes weitere Rezept — weitermachen
	// hieße nur, Picnic weiter anzufragen (beim Ratelimit sogar schädlich)
	const FATAL_KINDS = new Set(['rateLimited', 'sessionExpired', 'needs2FA', 'notConfigured', 'invalidCredentials', 'unreachable']);

	// Bewusst ein Rezept nach dem anderen: Der Server drosselt die
	// Picnic-Abrufe zusätzlich auf einen Mindestabstand (picnic/throttle.ts).
	async function importAll() {
		const queue = [...pending];
		cancelRequested = false;
		bulk = { total: queue.length, done: 0, imported: 0, skipped: 0, failed: [], current: null, running: true, cancelled: false, stopReason: null };
		for (const tile of queue) {
			if (cancelRequested) {
				bulk.cancelled = true;
				break;
			}
			bulk.current = tile.name;
			const body = new FormData();
			body.set('id', tile.id);
			body.set('name', tile.name);
			let result;
			try {
				const response = await fetch('?/importBulk', { method: 'POST', body });
				result = deserialize(await response.text());
			} catch {
				result = null;
			}
			bulk.done++;
			if (result?.type === 'success') {
				if (result.data?.skipped) bulk.skipped++;
				else bulk.imported++;
			} else if (result?.type === 'failure') {
				bulk.failed.push(tile.name);
				const kind = result.data?.kind;
				if (typeof kind === 'string' && FATAL_KINDS.has(kind)) {
					bulk.stopReason = String(result.data?.message ?? '');
					break;
				}
			} else {
				// Netzfehler oder Umleitung (z.B. Anmeldung abgelaufen)
				bulk.failed.push(tile.name);
				bulk.stopReason = t('recipeImport.bulk.connectionLost');
				break;
			}
		}
		bulk.current = null;
		bulk.running = false;
		// Markierung „bereits vorhanden" auffrischen
		await invalidateAll();
	}
</script>

<svelte:head><title>{t('recipeImport.title')} – Proviant</title></svelte:head>

<div class="flex items-center gap-2">
	<a href="/rezepte" class="text-sm text-gray-500 hover:text-gray-700">← {t('recipes.back')}</a>
</div>
<h1 class="mt-1 text-2xl font-bold">{t('recipeImport.title')}</h1>
<p class="mt-1 text-sm text-gray-500">
	{t('recipeImport.description')}
</p>

<nav class="mt-4 flex flex-wrap gap-1.5" aria-label={t('recipeImport.sources')}>
	{#each sources as source (source.key)}
		<a
			href={source.key === 'katalog' ? '/rezepte/import' : `/rezepte/import?quelle=${source.key}`}
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
	{#if form?.message}
		<div class="mt-4 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.message}</div>
	{/if}

	<input
		type="search"
		bind:value={query}
		placeholder={t('recipeImport.search')}
		class="mt-4 block w-full max-w-md rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
	/>

	<div class="mt-2 flex max-w-2xl flex-wrap items-center justify-between gap-2">
		<p class="text-xs text-gray-500">{t('recipeImport.counted', { shown: filtered.length, total: data.tiles.length })}</p>
		{#if bulk?.running}
			<button
				type="button"
				onclick={() => (cancelRequested = true)}
				class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				{t('recipeImport.bulk.cancel')}
			</button>
		{:else if pending.length > 0}
			<button
				type="button"
				onclick={importAll}
				disabled={importing !== null}
				class="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
			>
				{t('recipeImport.bulk.start', { n: pending.length })}
			</button>
		{/if}
	</div>

	{#if bulk}
		<div class="mt-2 max-w-2xl rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm" aria-live="polite">
			{#if bulk.running}
				<p class="font-medium">{t('recipeImport.bulk.progress', { done: bulk.done, total: bulk.total })}</p>
				<div class="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
					<div class="h-full rounded-full bg-green-600 transition-all" style="width: {bulk.total > 0 ? (bulk.done / bulk.total) * 100 : 0}%"></div>
				</div>
				{#if bulk.current}<p class="mt-1 truncate text-xs text-gray-500">{bulk.current}</p>{/if}
				<p class="mt-1 text-xs text-gray-500">{t('recipeImport.bulk.hint')}</p>
			{:else}
				<p class="font-medium">
					{bulk.cancelled ? t('recipeImport.bulk.cancelled') : bulk.stopReason ? t('recipeImport.bulk.stopped') : t('recipeImport.bulk.finished')}
				</p>
				<p class="mt-1 text-gray-600">{t('recipeImport.bulk.summary', { imported: bulk.imported, skipped: bulk.skipped })}</p>
				{#if bulk.stopReason}<p class="mt-1 text-red-700">{bulk.stopReason}</p>{/if}
				{#if bulk.failed.length > 0}
					<p class="mt-1 text-amber-700">{t('recipeImport.bulk.failed', { names: bulk.failed.join(', ') })}</p>
				{/if}
			{/if}
		</div>
	{/if}
	{#if data.tiles.length === 0}
		<div class="mt-2 max-w-2xl rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
			{t('recipeImport.emptySource')}
		</div>
	{/if}

	<ul class="mt-2 max-w-2xl divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
		{#each filtered as tile (tile.id)}
			<li class="flex items-center gap-3 px-4 py-2.5">
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm">🍲</div>
				<span class="min-w-0 flex-1 truncate text-sm font-medium">{tile.name}</span>
				{#if alreadyImported(tile.name)}
					<span class="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{t('recipeImport.exists')}</span>
				{/if}
				<form
					method="POST"
					action="?/import"
					use:enhance={() => {
						importing = tile.id;
						return async ({ update }) => {
							importing = null;
							await update();
						};
					}}
				>
					<input type="hidden" name="id" value={tile.id} />
					<input type="hidden" name="name" value={tile.name} />
					<button
						type="submit"
						disabled={importing !== null || bulk?.running}
						class="shrink-0 rounded-lg border border-green-600 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
					>
						{importing === tile.id ? t('recipeImport.importing') : t('recipeImport.import')}
					</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}
