<script lang="ts">
	let { data } = $props();

	function formatDate(iso: string | null): string {
		if (!iso) return '';
		return new Date(iso).toLocaleDateString('de-DE', {
			weekday: 'short',
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}

	function formatPrice(cents: number): string {
		return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
	}

	const statusLabel: Record<string, string> = {
		CURRENT: 'Unterwegs',
		COMPLETED: 'Geliefert',
		CANCELLED: 'Storniert'
	};
</script>

<svelte:head><title>Lieferung prüfen – LebensmittelKumpel</title></svelte:head>

<h1 class="text-2xl font-bold">Lieferung prüfen</h1>
<p class="mt-1 text-sm text-gray-500">Picnic-Lieferung auspacken, scannen und direkt einbuchen</p>

{#if data.connection !== 'connected'}
	<div class="mt-6 max-w-2xl rounded-xl border border-gray-200 bg-white p-6 text-center">
		<div class="text-3xl">🔌</div>
		<p class="mt-2 font-medium">Noch nicht mit Picnic verbunden</p>
		<p class="mt-1 text-sm text-gray-500">
			Stelle die Verbindung auf der Seite <a href="/bestellen" class="text-green-700 underline">Bestellen</a> her,
			dann erscheinen hier deine Lieferungen.
		</p>
	</div>
{:else if data.error}
	<div class="mt-6 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{data.error}</div>
{:else if data.deliveries.length === 0}
	<div class="mt-6 max-w-2xl rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
		Keine Lieferungen gefunden.
	</div>
{:else}
	<ul class="mt-6 max-w-2xl divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
		{#each data.deliveries as delivery (delivery.id)}
			<li>
				<a href={`/lieferung/${delivery.id}`} class="flex items-center gap-3 px-4 py-3 hover:bg-green-50">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg">🚚</div>
					<div class="min-w-0 flex-1">
						<div class="font-medium">{formatDate(delivery.deliveryStart)}</div>
						<div class="text-xs text-gray-500">{formatPrice(delivery.totalPrice)}</div>
					</div>
					<span
						class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium {delivery.status === 'CURRENT'
							? 'bg-amber-100 text-amber-800'
							: delivery.status === 'CANCELLED'
								? 'bg-gray-100 text-gray-500'
								: 'bg-green-100 text-green-700'}"
					>
						{statusLabel[delivery.status] ?? delivery.status}
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
