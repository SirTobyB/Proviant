<script lang="ts">
	import { formatPrice } from '$lib/format';
	import { translator, BCP47 } from '$lib/i18n';
	let { data } = $props();

	const t = $derived(translator(data.locale));

	function formatDate(iso: string | null): string {
		if (!iso) return '';
		return new Date(iso).toLocaleDateString(BCP47[data.locale], {
			weekday: 'short',
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}


	// Picnic liefert genau diese drei Zustaende; Unbekanntes bleibt roh stehen
	const statusLabel = $derived((status: string) =>
		status === 'CURRENT' || status === 'COMPLETED' || status === 'CANCELLED'
			? t(`deliveries.status.${status}`)
			: status
	);
</script>

<svelte:head><title>{t('deliveries.title')} – LebensmittelKumpel</title></svelte:head>

<h1 class="text-2xl font-bold">{t('deliveries.title')}</h1>
<p class="mt-1 text-sm text-gray-500">{t('deliveries.subtitle')}</p>

{#if data.connection !== 'connected'}
	<div class="mt-6 max-w-2xl rounded-xl border border-gray-200 bg-white p-6 text-center">
		<div class="text-3xl">🔌</div>
		<p class="mt-2 font-medium">{t('deliveries.notConnected')}</p>
		<p class="mt-1 text-sm text-gray-500">
			{t('deliveries.connectBefore')}<a href="/bestellen" class="text-green-700 underline">{t('nav.order')}</a>{t('deliveries.connectAfter')}
		</p>
	</div>
{:else if data.error}
	<div class="mt-6 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{data.error}</div>
{:else if data.deliveries.length === 0}
	<div class="mt-6 max-w-2xl rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
		{t('deliveries.empty')}
	</div>
{:else}
	<ul class="mt-6 max-w-2xl divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
		{#each data.deliveries as delivery (delivery.id)}
			<li>
				<a href={`/lieferung/${delivery.id}`} class="flex items-center gap-3 px-4 py-3 hover:bg-green-50">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg">🚚</div>
					<div class="min-w-0 flex-1">
						<div class="font-medium">{formatDate(delivery.deliveryStart)}</div>
						<div class="text-xs text-gray-500">{formatPrice(delivery.totalPrice, data.locale)}</div>
					</div>
					<span
						class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium {delivery.status === 'CURRENT'
							? 'bg-amber-100 text-amber-800'
							: delivery.status === 'CANCELLED'
								? 'bg-gray-100 text-gray-500'
								: 'bg-green-100 text-green-700'}"
					>
						{statusLabel(delivery.status)}
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
