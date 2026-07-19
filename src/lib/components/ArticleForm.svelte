<script lang="ts">
	import { enhance } from '$app/forms';
	import TagInput from '$lib/components/TagInput.svelte';

	type Location = { id: number; name: string };
	type ArticleValues = {
		name?: string | null;
		amount?: number | null;
		unit?: string | null;
		ean?: string | null;
		picnicId?: string | null;
		minStock?: number | null;
		defaultLocationId?: number | null;
		imagePath?: string | null;
		tags?: string[];
	};
	type PicnicResult = {
		id: string;
		name: string;
		unitQuantity: string;
		price: number;
		imageId: string;
	};

	let {
		article = {},
		locations,
		allTags = [],
		submitLabel,
		errorMessage = null,
		autoLookup = false,
		action = ''
	}: {
		article?: ArticleValues;
		locations: Location[];
		allTags?: string[];
		submitLabel: string;
		errorMessage?: string | null;
		autoLookup?: boolean;
		action?: string;
	} = $props();

	const units = ['g', 'kg', 'ml', 'l', 'Stück'];

	// Bewusst nur die Initialwerte — bei Artikelwechsel wird die Komponente per {#key} neu erzeugt
	// svelte-ignore state_referenced_locally
	const initial = { ...article };

	let name = $state(initial.name ?? '');
	let amount = $state(initial.amount != null ? String(initial.amount) : '');
	let unit = $state(initial.unit ?? '');
	let ean = $state(initial.ean ?? '');
	let picnicId = $state(initial.picnicId ?? '');
	let minStock = $state(initial.minStock ?? 0);
	let defaultLocationId = $state(initial.defaultLocationId != null ? String(initial.defaultLocationId) : '');
	let articleTagList = $state<string[]>([...(initial.tags ?? [])]);

	// Bildquelle aus Lookups (Server lädt beim Speichern herunter)
	let imageUrl = $state('');
	let picnicImageId = $state('');
	let uploadPreview = $state('');

	let lookupState = $state<'idle' | 'loading' | 'notfound' | 'error'>('idle');
	let picnicQuery = $state('');
	let picnicResults = $state<PicnicResult[]>([]);
	let picnicState = $state<'idle' | 'loading' | 'empty' | 'error'>('idle');
	let picnicError = $state('');
	let directPicnicId = $state('');
	let submitting = $state(false);

	function applyDirectPicnicId() {
		const id = directPicnicId.trim();
		if (!id) return;
		picnicId = id;
		directPicnicId = '';
		picnicResults = [];
	}

	const previewSrc = $derived(
		uploadPreview ||
			imageUrl ||
			(picnicImageId ? `/api/picnic/image/${picnicImageId}` : '') ||
			(article.imagePath ? `/api/images/${article.imagePath}` : '')
	);

	async function lookupEan() {
		if (!ean) return;
		lookupState = 'loading';
		try {
			const response = await fetch(`/api/lookup/${encodeURIComponent(ean)}`);
			const data = await response.json();
			if (!data.found) {
				lookupState = 'notfound';
				return;
			}
			if (!name) name = data.name ?? '';
			if (!amount && data.amount != null) amount = String(data.amount);
			if (!unit && data.unit) unit = data.unit;
			if (data.imageUrl && !uploadPreview) {
				imageUrl = data.imageUrl;
				picnicImageId = '';
			}
			lookupState = 'idle';
		} catch {
			lookupState = 'error';
		}
	}

	async function searchPicnic() {
		const query = (picnicQuery || name).trim();
		if (!query) return;
		picnicState = 'loading';
		picnicResults = [];
		try {
			const response = await fetch(`/api/picnic/search?q=${encodeURIComponent(query)}`);
			const data = await response.json();
			if (!response.ok) {
				picnicError = data.error ?? 'Picnic-Suche fehlgeschlagen';
				picnicState = 'error';
				return;
			}
			picnicResults = normalizePicnicResults(data.results ?? []);
			picnicState = picnicResults.length === 0 ? 'empty' : 'idle';
		} catch {
			picnicError = 'Picnic-Suche fehlgeschlagen';
			picnicState = 'error';
		}
	}

	function selectPicnicProduct(result: PicnicResult) {
		picnicId = result.id;
		if (!name) name = result.name;
		if (!amount && result.unitQuantity) {
			const match = result.unitQuantity.match(/([\d.,]+)\s*(kg|g|ml|l)\b/i);
			if (match) {
				amount = match[1].replace(',', '.');
				unit = match[2].toLowerCase();
			}
		}
		if (!uploadPreview && !imageUrl) picnicImageId = result.imageId;
		picnicResults = [];
	}

	function normalizePicnicResults(results: PicnicResult[]) {
		const seen = new Set<string>();
		return results.filter((result) => {
			const key = result.id || `${result.name}-${result.imageId}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}

	function picnicResultKey(result: PicnicResult, index: number) {
		return `${result.id || 'unknown'}-${result.name || 'unknown'}-${result.imageId || 'unknown'}-${index}`;
	}

	function onFileSelected(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) {
			uploadPreview = '';
			return;
		}
		imageUrl = '';
		picnicImageId = '';
		uploadPreview = URL.createObjectURL(file);
	}

	$effect(() => {
		if (autoLookup && ean && !name) lookupEan();
	});

	function formatPrice(cents: number): string {
		return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
	}
</script>

<form
	method="POST"
	{action}
	enctype="multipart/form-data"
	class="mt-6 flex max-w-xl flex-col gap-4"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			submitting = false;
			await update();
		};
	}}
>
	{#if errorMessage}
		<div class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
	{/if}

	<!-- EAN + Lookup -->
	<div>
		<label for="ean" class="block text-sm font-medium text-gray-700">EAN / Barcode</label>
		<div class="mt-1 flex gap-2">
			<input
				id="ean"
				name="ean"
				type="text"
				inputmode="numeric"
				bind:value={ean}
				placeholder="z.B. 4311501043271"
				class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
			/>
			<button
				type="button"
				onclick={lookupEan}
				disabled={!ean || lookupState === 'loading'}
				class="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
			>
				{lookupState === 'loading' ? 'Suche …' : 'Nachschlagen'}
			</button>
		</div>
		{#if lookupState === 'notfound'}
			<p class="mt-1 text-sm text-amber-600">In Open Food Facts nicht gefunden — bitte von Hand ausfüllen.</p>
		{:else if lookupState === 'error'}
			<p class="mt-1 text-sm text-red-600">Lookup fehlgeschlagen.</p>
		{/if}
	</div>

	<!-- Name -->
	<div>
		<label for="name" class="block text-sm font-medium text-gray-700">Name *</label>
		<input
			id="name"
			name="name"
			type="text"
			required
			bind:value={name}
			class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
		/>
	</div>

	<!-- Menge + Einheit -->
	<div class="grid grid-cols-2 gap-3">
		<div>
			<label for="amount" class="block text-sm font-medium text-gray-700">Gebindegröße</label>
			<input
				id="amount"
				name="amount"
				type="text"
				inputmode="decimal"
				bind:value={amount}
				placeholder="z.B. 500"
				class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
			/>
		</div>
		<div>
			<label for="unit" class="block text-sm font-medium text-gray-700">Einheit</label>
			<select
				id="unit"
				name="unit"
				bind:value={unit}
				class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
			>
				<option value="">—</option>
				{#each units as u (u)}
					<option value={u}>{u}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Mindestbestand + Standard-Lagerort -->
	<div class="grid grid-cols-2 gap-3">
		<div>
			<label for="minStock" class="block text-sm font-medium text-gray-700">Mindestbestand</label>
			<input
				id="minStock"
				name="minStock"
				type="number"
				min="0"
				bind:value={minStock}
				class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
			/>
			<p class="mt-1 text-xs text-gray-500">0 = kein Bestellvorschlag</p>
		</div>
		<div>
			<label for="defaultLocationId" class="block text-sm font-medium text-gray-700">Standard-Lagerort</label>
			<select
				id="defaultLocationId"
				name="defaultLocationId"
				bind:value={defaultLocationId}
				class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
			>
				<option value="">—</option>
				{#each locations as location (location.id)}
					<option value={String(location.id)}>{location.name}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Tags -->
	<div>
		<span class="block text-sm font-medium text-gray-700">Tags</span>
		<TagInput bind:tags={articleTagList} {allTags} placeholder="Tag eingeben (z.B. Getränke, Tiefkühl) und Enter" />
	</div>

	<!-- Picnic-Verknüpfung -->
	<fieldset class="rounded-xl border border-gray-200 bg-white p-4">
		<legend class="px-1 text-sm font-medium text-gray-700">Picnic-Verknüpfung</legend>
		{#if picnicId}
			<div class="flex items-center justify-between gap-2">
				<span class="text-sm text-green-700">✓ Verknüpft (ID {picnicId})</span>
				<button
					type="button"
					onclick={() => (picnicId = '')}
					class="text-sm text-gray-500 underline hover:text-gray-700"
				>
					Entfernen
				</button>
			</div>
		{:else}
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={picnicQuery}
					placeholder={name || 'Suchbegriff'}
					class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
				/>
				<button
					type="button"
					onclick={searchPicnic}
					disabled={picnicState === 'loading' || (!picnicQuery && !name)}
					class="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
				>
					{picnicState === 'loading' ? 'Suche …' : 'In Picnic suchen'}
				</button>
			</div>
			{#if picnicState === 'error'}
				<p class="mt-2 text-sm text-red-600">{picnicError}</p>
			{:else if picnicState === 'empty'}
				<p class="mt-2 text-sm text-amber-600">Keine Treffer.</p>
			{/if}
			{#if picnicResults.length > 0}
				<ul class="mt-3 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
					{#each picnicResults as result, index (picnicResultKey(result, index))}
						<li>
							<button
								type="button"
								onclick={() => selectPicnicProduct(result)}
								class="flex w-full items-center gap-3 bg-white px-3 py-2 text-left hover:bg-green-50"
							>
								<img
									src={`/api/picnic/image/${result.imageId}`}
									alt=""
									loading="lazy"
									class="h-10 w-10 shrink-0 rounded object-contain"
								/>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-sm font-medium">{result.name}</span>
									<span class="block text-xs text-gray-500">{result.unitQuantity}</span>
								</span>
								<span class="shrink-0 text-sm text-gray-700">{formatPrice(result.price)}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			<!-- Alternative: Picnic-ID direkt eintragen (z.B. s1027848) -->
			<div class="mt-3 flex gap-2 border-t border-gray-100 pt-3">
				<input
					type="text"
					bind:value={directPicnicId}
					placeholder="Oder Picnic-ID direkt (z.B. s1027848)"
					class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
				/>
				<button
					type="button"
					onclick={applyDirectPicnicId}
					disabled={!directPicnicId.trim()}
					class="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
				>
					Übernehmen
				</button>
			</div>
		{/if}
		<input type="hidden" name="picnicId" value={picnicId} />
	</fieldset>

	<!-- Bild -->
	<div>
		<span class="block text-sm font-medium text-gray-700">Bild</span>
		<div class="mt-1 flex items-center gap-4">
			{#if previewSrc}
				<img src={previewSrc} alt="Vorschau" class="h-20 w-20 rounded-lg border border-gray-200 bg-white object-contain" />
			{:else}
				<div class="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">
					Kein Bild
				</div>
			{/if}
			<label class="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
				Foto wählen
				<input type="file" name="image" accept="image/*" capture="environment" class="hidden" onchange={onFileSelected} />
			</label>
		</div>
		<p class="mt-1 text-xs text-gray-500">Wird sonst automatisch aus Open Food Facts oder Picnic übernommen.</p>
		<input type="hidden" name="imageUrl" value={imageUrl} />
		<input type="hidden" name="picnicImageId" value={picnicImageId} />
	</div>

	<div class="flex gap-3">
		<button
			type="submit"
			disabled={submitting}
			class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
		>
			{submitting ? 'Speichern …' : submitLabel}
		</button>
		<a
			href="/artikel"
			class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
		>
			Abbrechen
		</a>
	</div>
</form>
