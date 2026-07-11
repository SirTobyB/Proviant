<script lang="ts">
	import { enhance } from '$app/forms';
	import { mhdStatus, mhdLabel, formatDate, MHD_BADGE_CLASSES } from '$lib/mhd';

	let { data, form } = $props();

	// Welche Charge wird gerade bearbeitet?
	let editingId = $state<number | null>(null);

	function packageSize(amount: number | null, unit: string | null): string {
		if (amount == null) return '';
		return `${amount.toLocaleString('de-DE')} ${unit ?? ''}`.trim();
	}

	function articleTotal(entries: { quantity: number }[]): number {
		return entries.reduce((sum, entry) => sum + entry.quantity, 0);
	}
</script>

<svelte:head><title>{data.location.name} – LebensmittelKumpel</title></svelte:head>

<div class="flex items-center gap-2">
	<a href="/" class="text-sm text-gray-500 hover:text-gray-700">← Lager</a>
</div>
<h1 class="mt-1 text-2xl font-bold">{data.location.name}</h1>

{#if form?.message}
	<div class="mt-4 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.message}</div>
{/if}

{#if data.articles.length === 0}
	<div class="mt-6 max-w-2xl rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
		Keine Bestände in diesem Lagerort. Per <a href="/scan" class="text-green-700 underline">Scannen</a> einbuchen.
	</div>
{:else}
	<div class="mt-6 max-w-2xl space-y-4">
		{#each data.articles as article (article.articleId)}
			<div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
				<div class="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
					{#if article.imagePath}
						<img src={`/api/images/${article.imagePath}`} alt="" class="h-10 w-10 shrink-0 rounded-lg border border-gray-100 object-contain" />
					{:else}
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">📦</div>
					{/if}
					<a href={`/artikel/${article.articleId}`} class="min-w-0 flex-1">
						<span class="block truncate font-semibold hover:underline">{article.articleName}</span>
						{#if packageSize(article.amount, article.unit)}
							<span class="text-xs text-gray-500">{packageSize(article.amount, article.unit)}</span>
						{/if}
					</a>
					<span class="shrink-0 text-sm font-semibold text-gray-700">{articleTotal(article.entries)}×</span>
				</div>

				<ul class="divide-y divide-gray-50">
					{#each article.entries as entry (entry.id)}
						{@const status = mhdStatus(entry.bestBefore)}
						<li class="px-4 py-2.5">
							{#if editingId === entry.id}
								<form
									method="POST"
									action="?/updateEntry"
									use:enhance={() => async ({ update }) => { editingId = null; await update(); }}
									class="flex flex-wrap items-end gap-2"
								>
									<input type="hidden" name="entryId" value={entry.id} />
									<div>
										<label for={`q-${entry.id}`} class="block text-xs text-gray-500">Anzahl</label>
										<input id={`q-${entry.id}`} name="quantity" type="number" min="0" value={entry.quantity} class="mt-0.5 w-20 rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
									</div>
									<div>
										<label for={`b-${entry.id}`} class="block text-xs text-gray-500">MHD</label>
										<input id={`b-${entry.id}`} name="bestBefore" type="date" value={entry.bestBefore ?? ''} class="mt-0.5 rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
									</div>
									<button type="submit" class="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">Speichern</button>
									<button type="button" onclick={() => (editingId = null)} class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Abbrechen</button>
									<span class="ml-auto text-xs text-gray-400">Anzahl 0 = löschen</span>
								</form>
							{:else}
								<div class="flex items-center gap-3">
									<span class="w-10 shrink-0 text-sm font-medium text-gray-700">{entry.quantity}×</span>
									<span class="flex-1 text-sm text-gray-600">
										{#if entry.bestBefore}
											MHD {formatDate(entry.bestBefore)}
										{:else}
											<span class="text-gray-400">kein MHD</span>
										{/if}
									</span>
									<span class="rounded-full px-2.5 py-1 text-xs font-medium {MHD_BADGE_CLASSES[status]}">
										{mhdLabel(entry.bestBefore)}
									</span>
									<button type="button" onclick={() => (editingId = entry.id)} class="shrink-0 text-sm text-gray-500 underline hover:text-gray-700">Ändern</button>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
{/if}
