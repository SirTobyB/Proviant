<script lang="ts">
	/**
	 * Eine Charge in der Liste — mit Schnellkorrektur (+/−), Bearbeiten
	 * (Anzahl/MHD) und Umlagern. Wird von der Lagerort- und der Artikelseite
	 * gleichermaßen genutzt; beide Seiten stellen die Actions `?/updateEntry`
	 * und `?/moveEntry` bereit.
	 *
	 * Der geöffnete Zustand liegt bewusst außen: so bleibt wie bisher immer nur
	 * eine Zeile der Liste aufgeklappt.
	 */
	import { enhance } from '$app/forms';
	import { keepValues } from '$lib/forms';
	import { formatDate, mhdLabel, mhdStatus, MHD_BADGE_CLASSES } from '$lib/mhd';

	type Entry = { id: number; quantity: number; bestBefore: string | null };
	type Mode = 'view' | 'edit' | 'move';

	let {
		entry,
		moveTargets,
		mode = 'view',
		onMode
	}: {
		entry: Entry;
		/** Auswählbare Ziel-Lagerorte (ohne den eigenen). */
		moveTargets: { id: number; name: string }[];
		mode?: Mode;
		onMode: (mode: Mode) => void;
	} = $props();

	const status = $derived(mhdStatus(entry.bestBefore));
	let moveTarget = $state('');

	function openMove() {
		moveTarget = moveTargets[0] ? String(moveTargets[0].id) : '';
		onMode('move');
	}
</script>

<li class="px-4 py-2.5">
	{#if mode === 'edit'}
		<form
			method="POST"
			action="?/updateEntry"
			use:enhance={() => async ({ update }) => { onMode('view'); await update({ reset: false }); }}
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
			<button type="button" onclick={() => onMode('view')} class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Abbrechen</button>
			<span class="ml-auto text-xs text-gray-400">Anzahl 0 = löschen</span>
		</form>
	{:else if mode === 'move'}
		<form
			method="POST"
			action="?/moveEntry"
			use:enhance={() => async ({ update }) => { onMode('view'); await update({ reset: false }); }}
			class="flex flex-wrap items-end gap-2"
		>
			<input type="hidden" name="entryId" value={entry.id} />
			<div>
				<label for={`t-${entry.id}`} class="block text-xs text-gray-500">Neuer Lagerort</label>
				<select id={`t-${entry.id}`} name="targetLocationId" bind:value={moveTarget} class="mt-0.5 rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600">
					{#each moveTargets as target (target.id)}
						<option value={String(target.id)}>{target.name}</option>
					{/each}
				</select>
			</div>
			<button type="submit" class="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">Umlagern</button>
			<button type="button" onclick={() => onMode('view')} class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Abbrechen</button>
		</form>
	{:else}
		<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
			<!-- Schnellkorrektur: ein Klick = ein Gebinde mehr/weniger (0 löscht die Charge) -->
			<div class="flex shrink-0 items-center gap-1.5">
				<form method="POST" action="?/updateEntry" use:enhance={keepValues}>
					<input type="hidden" name="entryId" value={entry.id} />
					<input type="hidden" name="quantity" value={entry.quantity - 1} />
					<input type="hidden" name="bestBefore" value={entry.bestBefore ?? ''} />
					<button type="submit" class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-50" aria-label="Ein Gebinde weniger">−</button>
				</form>
				<span class="w-10 text-center text-sm font-medium text-gray-700">{entry.quantity}×</span>
				<form method="POST" action="?/updateEntry" use:enhance={keepValues}>
					<input type="hidden" name="entryId" value={entry.id} />
					<input type="hidden" name="quantity" value={entry.quantity + 1} />
					<input type="hidden" name="bestBefore" value={entry.bestBefore ?? ''} />
					<button type="submit" class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-50" aria-label="Ein Gebinde mehr">+</button>
				</form>
			</div>
			<span class="min-w-0 flex-1 text-sm text-gray-600">
				{#if entry.bestBefore}
					MHD {formatDate(entry.bestBefore)}
				{:else}
					<span class="text-gray-400">kein MHD</span>
				{/if}
			</span>
			<span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium {MHD_BADGE_CLASSES[status]}">
				{mhdLabel(entry.bestBefore)}
			</span>
			<div class="flex shrink-0 items-center gap-3">
				<button type="button" onclick={openMove} class="text-sm text-gray-500 underline hover:text-gray-700">Umlagern</button>
				<button type="button" onclick={() => onMode('edit')} class="text-sm text-gray-500 underline hover:text-gray-700">Ändern</button>
			</div>
		</div>
	{/if}
</li>
