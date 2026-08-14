<script lang="ts">
	import {
		movementAmountClass,
		movementAmountLabel,
		movementSourceLabel,
		movementTypeLabel
	} from '$lib/journal';
	import { formatDate } from '$lib/mhd';
	import { translator, BCP47 } from '$lib/i18n';

	let { data } = $props();

	const t = $derived(translator(data.locale));

	/**
	 * Zeitzone bewusst fest: sonst formatiert der Server (im Container UTC)
	 * anders als der Browser und die Hydration meldet eine Abweichung.
	 */
	function bookedAtLabel(value: Date | string): string {
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return String(value);
		return date.toLocaleString(BCP47[data.locale], {
			timeZone: 'Europe/Berlin',
			day: '2-digit',
			month: '2-digit',
			year: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	/** Link mit geänderten Filtern; leere Werte fallen raus. */
	function filterHref(changes: Record<string, string | number | null>): string {
		const params = new URLSearchParams();
		const current: Record<string, string | number | null> = {
			artikel: data.filters.article,
			ort: data.filters.location,
			benutzer: data.filters.user,
			typ: data.filters.type,
			...changes
		};
		for (const [key, value] of Object.entries(current)) {
			if (value !== null && value !== '' && value !== undefined) params.set(key, String(value));
		}
		const query = params.toString();
		return `/journal${query ? `?${query}` : ''}`;
	}

	const hasFilter = $derived(
		Boolean(data.filters.article || data.filters.location || data.filters.user || data.filters.type)
	);
</script>

<svelte:head><title>{t('journal.title')} – LebensmittelKumpel</title></svelte:head>

<div class="flex flex-wrap items-center justify-between gap-3">
	<div>
		<h1 class="text-2xl font-bold">{t('journal.title')}</h1>
		<p class="mt-1 text-sm text-gray-500">{t('journal.subtitle')}</p>
	</div>
	{#if hasFilter}
		<a href="/journal" class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
			{t('journal.resetFilter')}
		</a>
	{/if}
</div>

<!-- Filter: als Links, damit der Stand in der URL steht und teilbar bleibt -->
<form method="GET" class="mt-4 grid max-w-3xl gap-2 sm:grid-cols-4">
	<select
		name="artikel"
		onchange={(e) => (window.location.href = filterHref({ artikel: e.currentTarget.value || null }))}
		class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
	>
		<option value="">{t('journal.allArticles')}</option>
		{#each data.articleOptions as option (option.id)}
			<option value={option.id} selected={data.filters.article === option.id}>{option.name}</option>
		{/each}
	</select>
	<select
		name="ort"
		onchange={(e) => (window.location.href = filterHref({ ort: e.currentTarget.value || null }))}
		class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
	>
		<option value="">{t('journal.allLocations')}</option>
		{#each data.locationOptions as option (option.id)}
			<option value={option.id} selected={data.filters.location === option.id}>{option.name}</option>
		{/each}
	</select>
	<select
		name="benutzer"
		onchange={(e) => (window.location.href = filterHref({ benutzer: e.currentTarget.value || null }))}
		class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
	>
		<option value="">{t('journal.allUsers')}</option>
		{#each data.userOptions as name (name)}
			<option value={name} selected={data.filters.user === name}>{name}</option>
		{/each}
	</select>
	<select
		name="typ"
		onchange={(e) => (window.location.href = filterHref({ typ: e.currentTarget.value || null }))}
		class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
	>
		<option value="">{t('journal.allTypes')}</option>
		{#each ['in', 'out', 'move', 'correction'] as type (type)}
			<option value={type} selected={data.filters.type === type}>{movementTypeLabel(type, t)}</option>
		{/each}
	</select>
</form>

{#if data.movements.length === 0}
	<div class="mt-6 max-w-3xl rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
		{hasFilter
			? t('journal.emptyFiltered')
			: t('journal.empty')}
	</div>
{:else}
	<ul class="mt-4 max-w-3xl divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
		{#each data.movements as movement (movement.id)}
			<li class="flex items-start gap-3 px-4 py-2.5">
				<div class="w-28 shrink-0 text-xs text-gray-500">
					<div>{bookedAtLabel(movement.bookedAt)}</div>
					<div class="truncate">{movement.bookedBy ?? '—'}</div>
				</div>
				<div class="min-w-0 flex-1">
					{#if movement.articleId}
						<a href={`/artikel/${movement.articleId}`} class="block truncate text-sm font-medium hover:underline">
							{movement.articleName}
						</a>
					{:else}
						<div class="block truncate text-sm font-medium text-gray-500" title={t('journal.deletedArticle')}>
							{movement.articleName}
						</div>
					{/if}
					<div class="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
						<span>{movementTypeLabel(movement.type, t)}</span>
						{#if movement.type === 'move'}
							<span>{movement.fromLocationName ?? '?'} → {movement.locationName ?? '?'}</span>
						{:else if movement.locationName}
							<span>{movement.locationName}</span>
						{/if}
						{#if movement.bestBefore}
							<span>{t('mhd.label', { date: formatDate(movement.bestBefore, data.locale) })}</span>
						{/if}
						{#if movement.source}
							<span class="rounded bg-gray-100 px-1.5 py-0.5">{movementSourceLabel(movement.source, t)}</span>
						{/if}
					</div>
				</div>
				<span class="shrink-0 text-sm font-semibold {movementAmountClass(movement.type, movement.quantity)}">
					{movementAmountLabel(movement.type, movement.quantity, t)}
				</span>
			</li>
		{/each}
	</ul>

	<div class="mt-3 max-w-3xl text-center">
		{#if data.hasMore}
			<a
				href={filterHref({ limit: data.limit + 100 })}
				class="inline-block rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				{t('journal.showMore')}
			</a>
		{:else}
			<span class="text-xs text-gray-400">{t('journal.thatsAll', { n: data.movements.length })}</span>
		{/if}
	</div>
{/if}
