<script lang="ts">
	import { mhdStatus, mhdLabel, formatDate, MHD_BADGE_CLASSES } from '$lib/mhd';

	let { data } = $props();
</script>

<svelte:head><title>Lager – LebensmittelKumpel</title></svelte:head>

<div class="flex items-start justify-between gap-3">
	<div>
		<h1 class="text-2xl font-bold">Lager</h1>
		<p class="mt-1 text-sm text-gray-500">
			{data.stockCount} Gebinde im Bestand · {data.articleCount} Artikel im Stamm
		</p>
	</div>
	<a
		href="/lieferung"
		class="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 md:hidden"
	>
		🚚 Lieferung
	</a>
</div>

{#if data.expiring.length > 0}
	<section class="mt-6 max-w-2xl">
		<h2 class="text-sm font-semibold text-gray-700">Läuft bald ab</h2>
		<ul class="mt-2 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
			{#each data.expiring as entry (entry.id)}
				{@const status = mhdStatus(entry.bestBefore)}
				<li class="flex items-center gap-3 px-4 py-3">
					<a href={`/artikel/${entry.articleId}`} class="shrink-0">
						{#if entry.imagePath}
							<img src={`/api/images/${entry.imagePath}`} alt="" loading="lazy" class="h-10 w-10 rounded-lg border border-gray-100 object-contain" />
						{:else}
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">📦</div>
						{/if}
					</a>
					<div class="min-w-0 flex-1">
						<a href={`/artikel/${entry.articleId}`} class="block truncate font-medium hover:underline">{entry.articleName}</a>
						<div class="text-xs text-gray-500">{entry.quantity}× · {entry.locationName} · MHD {formatDate(entry.bestBefore)}</div>
					</div>
					<span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium {MHD_BADGE_CLASSES[status]}">
						{mhdLabel(entry.bestBefore)}
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<h2 class="mt-8 text-sm font-semibold text-gray-700">Lagerorte</h2>
<div class="mt-2 grid grid-cols-2 gap-3 md:max-w-2xl">
	{#each data.locations as location (location.id)}
		<a
			href={`/lager/${location.id}`}
			class="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-green-300 hover:bg-green-50"
		>
			<div class="font-semibold">{location.name}</div>
			<div class="mt-1 text-sm {location.quantity === 0 ? 'text-gray-400' : 'text-gray-600'}">
				{location.quantity === 0 ? 'Keine Bestände' : `${location.quantity} Gebinde`}
			</div>
		</a>
	{/each}
</div>
