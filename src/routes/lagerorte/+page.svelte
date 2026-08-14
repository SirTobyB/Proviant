<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepValues } from '$lib/forms';

	let { data, form } = $props();

	/** Welcher Lagerort wird gerade umbenannt? */
	let editing = $state<number | null>(null);
	let showCreate = $state(false);

	const active = $derived(data.locations.filter((l) => l.active));
	const inactive = $derived(data.locations.filter((l) => !l.active));
</script>

<svelte:head><title>Lagerorte – LebensmittelKumpel</title></svelte:head>

<div class="flex flex-wrap items-start justify-between gap-3">
	<div>
		<h1 class="text-2xl font-bold">Lagerorte</h1>
		<p class="mt-1 text-sm text-gray-500">
			{active.length} aktiv{inactive.length > 0 ? ` · ${inactive.length} stillgelegt` : ''}
		</p>
	</div>
	<button
		type="button"
		onclick={() => { showCreate = !showCreate; editing = null; }}
		class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
	>
		{showCreate ? 'Abbrechen' : '+ Neuer Lagerort'}
	</button>
</div>

{#if form?.message}
	<div class="mt-4 max-w-xl rounded-lg px-4 py-3 text-sm {form.ok ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}">
		{form.message}
	</div>
{/if}

{#if showCreate}
	<form
		method="POST"
		action="?/create"
		use:enhance={() => async ({ update, result }) => {
			await update();
			if (result.type === 'success') showCreate = false;
		}}
		class="mt-4 flex max-w-xl flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4"
	>
		<div class="min-w-0 flex-1">
			<label for="c-name" class="block text-xs font-medium text-gray-500">Name</label>
			<input
				id="c-name"
				name="name"
				type="text"
				required
				maxlength="40"
				placeholder="z.B. Speisekammer"
				class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
			/>
		</div>
		<button type="submit" class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
			Anlegen
		</button>
	</form>
{/if}

<ul class="mt-4 max-w-xl divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
	{#each data.locations as location, index (location.id)}
		<li class="px-4 py-3 {location.active ? '' : 'bg-gray-50'}">
			{#if editing === location.id}
				<form
					method="POST"
					action="?/rename"
					use:enhance={() => async ({ update, result }) => {
						await update({ reset: false });
						if (result.type === 'success') editing = null;
					}}
					class="flex flex-wrap items-end gap-2"
				>
					<input type="hidden" name="id" value={location.id} />
					<div class="min-w-0 flex-1">
						<label for={`e-name-${location.id}`} class="block text-xs text-gray-500">Name</label>
						<input
							id={`e-name-${location.id}`}
							name="name"
							type="text"
							value={location.name}
							required
							maxlength="40"
							class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
						/>
					</div>
					<button type="submit" class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">Speichern</button>
					<button type="button" onclick={() => (editing = null)} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Abbrechen</button>
				</form>
			{:else}
				<div class="flex items-center gap-3">
					<!-- Reihenfolge: bewusst über die ganze Liste, damit ein reaktivierter
					     Lagerort dort wieder auftaucht, wo er einsortiert war -->
					<div class="flex shrink-0 flex-col">
						<form method="POST" action="?/move" use:enhance={keepValues}>
							<input type="hidden" name="id" value={location.id} />
							<input type="hidden" name="direction" value="up" />
							<button
								type="submit"
								disabled={index === 0}
								aria-label="Nach oben"
								class="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-25"
							>▲</button>
						</form>
						<form method="POST" action="?/move" use:enhance={keepValues}>
							<input type="hidden" name="id" value={location.id} />
							<input type="hidden" name="direction" value="down" />
							<button
								type="submit"
								disabled={index === data.locations.length - 1}
								aria-label="Nach unten"
								class="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-25"
							>▼</button>
						</form>
					</div>

					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-2">
							{#if location.active}
								<a href={`/lager/${location.id}`} class="font-medium hover:underline">{location.name}</a>
							{:else}
								<span class="font-medium text-gray-500">{location.name}</span>
								<span class="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">stillgelegt</span>
							{/if}
						</div>
						<div class="text-xs text-gray-500">
							{location.quantity === 0 ? 'keine Bestände' : `${location.quantity} Gebinde`}
						</div>
					</div>

					<button
						type="button"
						onclick={() => { editing = location.id; showCreate = false; }}
						class="shrink-0 text-sm text-gray-500 underline hover:text-gray-700"
					>
						Umbenennen
					</button>
					<form method="POST" action="?/{location.active ? 'deactivate' : 'activate'}" use:enhance={keepValues}>
						<input type="hidden" name="id" value={location.id} />
						<button
							type="submit"
							class="shrink-0 text-sm underline {location.active ? 'text-amber-700 hover:text-amber-800' : 'text-green-700 hover:text-green-800'}"
						>
							{location.active ? 'Stilllegen' : 'Aktivieren'}
						</button>
					</form>
				</div>
			{/if}
		</li>
	{/each}
</ul>

<p class="mt-3 max-w-xl text-xs text-gray-500">
	Lagerorte werden nie gelöscht, sondern stillgelegt — so bleiben Bestandshistorie und
	Buchungsjournal lesbar. Stillgelegte Lagerorte erscheinen nirgends mehr zur Auswahl und
	müssen vorher leer geräumt sein.
</p>
