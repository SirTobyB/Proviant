<script lang="ts">
	import { keepValues } from '$lib/forms';
	import { translator } from '$lib/i18n';
	import { packageSize } from '$lib/format';
	import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';

	let { data, form } = $props();

	// Vorerst nur für die Zahlformate; die Texte dieser Seite folgen später
	const t = $derived(translator(data.locale));

	type LookupResult = {
		found: boolean;
		article?: {
			id: number;
			name: string;
			imagePath: string | null;
			amount: number | null;
			unit: string | null;
			ean: string | null;
			defaultLocationId: number | null;
		};
		stock?: { locationId: number; locationName: string; quantity: number }[];
		totalStock?: number;
	};

	// Zustandsmaschine: scannen → Artikel gefunden / unbekannt → buchen → wieder scannen
	let mode = $state<'scan' | 'article' | 'unknown'>('scan');
	let scannedEan = $state('');
	let result = $state<LookupResult | null>(null);
	let scannerKey = $state(0);
	let toast = $state('');
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	let quantity = $state(1);
	let bestBefore = $state('');
	let locationId = $state('');

	async function onDetect(ean: string) {
		scannedEan = ean;
		const response = await fetch(`/api/articles/by-ean/${encodeURIComponent(ean)}`);
		result = (await response.json()) as LookupResult;
		if (result.found && result.article) {
			quantity = 1;
			bestBefore = '';
			locationId = result.article.defaultLocationId != null ? String(result.article.defaultLocationId) : '';
			mode = 'article';
		} else {
			mode = 'unknown';
		}
	}

	function backToScan() {
		mode = 'scan';
		result = null;
		scannerKey += 1;
	}

	function showToast(message: string) {
		toast = message;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 3000);
	}

	$effect(() => {
		const booking = form;
		if (booking?.booked) {
			// untrack: backToScan() liest/schreibt eigene $state-Werte — ohne untrack
			// würde der Effekt sich selbst erneut auslösen (Endlosschleife)
			untrack(() => {
				showToast(
					booking.booked === 'in'
						? `${booking.quantity}× ${booking.articleName} eingebucht`
						: `${booking.quantity}× ${booking.articleName} ausgebucht`
				);
				backToScan();
			});
		}
	});

</script>

<svelte:head><title>Scannen – LebensmittelKumpel</title></svelte:head>

<h1 class="text-2xl font-bold">Scannen</h1>
<p class="mt-1 text-sm text-gray-500">Barcode vor die Kamera halten — Ein- und Ausbuchen in Sekunden</p>

<div class="mt-4 max-w-md">
	{#if toast}
		<div class="mb-3 rounded-lg bg-green-100 px-4 py-3 text-sm font-medium text-green-800">{toast}</div>
	{/if}
	{#if form?.message}
		<div class="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.message}</div>
	{/if}

	{#if mode === 'scan'}
		{#key scannerKey}
			<BarcodeScanner {onDetect} />
		{/key}
	{:else if mode === 'unknown'}
		<div class="rounded-xl border border-gray-200 bg-white p-5 text-center">
			<div class="text-3xl">🤔</div>
			<p class="mt-2 font-medium">Unbekannter Barcode</p>
			<p class="mt-1 text-sm text-gray-500">EAN {scannedEan} ist noch nicht im Artikelstamm.</p>
			<div class="mt-4 flex justify-center gap-3">
				<a
					href={`/artikel/neu?ean=${scannedEan}`}
					class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
				>
					Artikel anlegen
				</a>
				<button
					type="button"
					onclick={backToScan}
					class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Weiter scannen
				</button>
			</div>
		</div>
	{:else if mode === 'article' && result?.article}
		{@const article = result.article}
		<div class="rounded-xl border border-gray-200 bg-white p-5">
			<div class="flex items-center gap-3">
				<a href={`/artikel/${article.id}`} class="shrink-0">
					{#if article.imagePath}
						<img
							src={`/api/images/${article.imagePath}`}
							alt=""
							class="h-14 w-14 rounded-lg border border-gray-100 object-contain"
						/>
					{:else}
						<div class="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 text-xl">📦</div>
					{/if}
				</a>
				<div class="min-w-0">
					<a href={`/artikel/${article.id}`} class="block truncate font-semibold hover:underline">{article.name}</a>
					<div class="text-sm text-gray-500">
						{packageSize(article.amount, article.unit, data.locale, t)}
						· Bestand: {result.totalStock ?? 0}×
					</div>
					{#if result.stock && result.stock.length > 0}
						<div class="mt-0.5 text-xs text-gray-400">
							{result.stock.map((entry) => `${entry.locationName}: ${entry.quantity}`).join(' · ')}
						</div>
					{/if}
				</div>
			</div>

			<!-- Einbuchen -->
			<form method="POST" action="?/einbuchen" use:enhance class="mt-4 border-t border-gray-100 pt-4">
				<input type="hidden" name="articleId" value={article.id} />
				<div class="grid grid-cols-3 gap-2">
					<div>
						<label for="quantity" class="block text-xs font-medium text-gray-500">Anzahl</label>
						<input
							id="quantity"
							name="quantity"
							type="number"
							min="1"
							bind:value={quantity}
							class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
						/>
					</div>
					<div>
						<label for="bestBefore" class="block text-xs font-medium text-gray-500">MHD</label>
						<input
							id="bestBefore"
							name="bestBefore"
							type="date"
							bind:value={bestBefore}
							class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
						/>
					</div>
					<div>
						<label for="locationId" class="block text-xs font-medium text-gray-500">Lagerort</label>
						<select
							id="locationId"
							name="locationId"
							bind:value={locationId}
							required
							class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
						>
							<option value="" disabled>—</option>
							{#each data.locations as location (location.id)}
								<option value={String(location.id)}>{location.name}</option>
							{/each}
						</select>
					</div>
				</div>
				<button
					type="submit"
					class="mt-3 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
				>
					＋ Einbuchen
				</button>
			</form>

			<!-- Ausbuchen -->
			<form method="POST" action="?/ausbuchen" use:enhance={keepValues} class="mt-3">
				<input type="hidden" name="articleId" value={article.id} />
				<input type="hidden" name="quantity" value={quantity} />
				<button
					type="submit"
					disabled={(result.totalStock ?? 0) === 0}
					class="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
				>
					－ Ausbuchen ({quantity}×, ältestes MHD zuerst)
				</button>
			</form>

			<button
				type="button"
				onclick={backToScan}
				class="mt-3 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				Weiter scannen
			</button>
		</div>
	{/if}
</div>
