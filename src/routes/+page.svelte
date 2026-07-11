<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Lager – LebensmittelKumpel</title></svelte:head>

<h1 class="text-2xl font-bold">Lager</h1>
<p class="mt-1 text-sm text-gray-500">
	{data.stockCount} Gebinde im Bestand · {data.articleCount} Artikel im Stamm
</p>

<div class="mt-6 grid grid-cols-2 gap-3 md:max-w-2xl">
	{#each data.locations as location (location.id)}
		<div class="rounded-xl border border-gray-200 bg-white p-4">
			<div class="font-semibold">{location.name}</div>
			<div class="mt-1 text-sm {location.quantity === 0 ? 'text-gray-400' : 'text-gray-600'}">
				{location.quantity === 0 ? 'Keine Bestände' : `${location.quantity} Gebinde`}
			</div>
		</div>
	{/each}
</div>

<div class="mt-8 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
	Hier entsteht die Lagerverwaltung: Ein-/Ausbuchen per Barcode-Scan,
	Chargen mit MHD und eine „Läuft bald ab“-Ansicht.
</div>
