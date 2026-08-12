<script lang="ts">
	import { packageSize, tagFilterHref } from '$lib/format';
	import { keepValues } from '$lib/forms';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	// Zählwert je Artikel; ohne Eingabe wird der aktuelle Bestand vorbefüllt
	let counts = $state<Record<number, string>>({});

	// Nach erfolgreicher Buchung die Eingabe verwerfen — die Zeile zeigt dann
	// wieder den (frisch geladenen) Live-Bestand
	$effect(() => {
		if (form && 'adjusted' in form && form.adjusted != null) delete counts[form.adjusted];
	});

	function countFor(article: { id: number; stock: number }): string {
		return counts[article.id] ?? String(article.stock);
	}

	function isChanged(article: { id: number; stock: number }): boolean {
		return countFor(article) !== String(article.stock);
	}


	const tagHref = (tag: string) =>
		tagFilterHref('/inventur', tag, { query: data.query, activeTag: data.tagFilter });
</script>

<svelte:head><title>Inventur – LebensmittelKumpel</title></svelte:head>

<h1 class="text-2xl font-bold">Inventur</h1>
<p class="mt-1 text-sm text-gray-500">
	Alle Bestände auf einen Blick — Zählwert eintragen und speichern, die Differenz wird automatisch gebucht.
</p>

<form method="GET" class="mt-4 max-w-md">
	<input
		type="search"
		name="q"
		value={data.query}
		placeholder="Artikel suchen …"
		class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
	/>
	{#if data.tagFilter}<input type="hidden" name="tag" value={data.tagFilter} />{/if}
</form>

{#if data.allTags.length > 0}
	<div class="mt-3 flex max-w-2xl flex-wrap gap-1.5">
		{#each data.allTags as tag (tag)}
			<a
				href={tagHref(tag)}
				class="rounded-full px-3 py-1 text-sm font-medium {tag === data.tagFilter ? 'bg-green-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}"
			>
				{tag}
			</a>
		{/each}
	</div>
{/if}

{#if form?.message}
	<div class="mt-4 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.message}</div>
{/if}

{#if data.articles.length === 0}
	<div class="mt-8 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
		{data.query || data.tagFilter ? 'Keine passenden Bestände gefunden.' : 'Keine Bestände vorhanden.'}
	</div>
{:else}
	<ul class="mt-4 max-w-2xl divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
		{#each data.articles as article (article.id)}
			<li class="flex items-center gap-3 py-2.5 pl-4 pr-3">
				<a href={`/artikel/${article.id}`} class="shrink-0">
					{#if article.imagePath}
						<img
							src={`/api/images/${article.imagePath}`}
							alt=""
							loading="lazy"
							class="h-11 w-11 rounded-lg border border-gray-100 bg-white object-contain"
						/>
					{:else}
						<div class="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100 text-lg">📦</div>
					{/if}
				</a>
				<div class="min-w-0 flex-1">
					<a href={`/artikel/${article.id}`} class="block truncate text-sm font-medium hover:underline">{article.name}</a>
					<div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
						{#if packageSize(article.amount, article.unit)}
							<span>{packageSize(article.amount, article.unit)}</span>
						{/if}
						<span>{article.locations.join(', ')}</span>
						{#each article.tags.slice(0, 3) as tag (tag)}
							<span class="rounded-full bg-green-50 px-1.5 py-0.5 text-green-700">{tag}</span>
						{/each}
					</div>
				</div>
				<!-- Inventurkorrektur: gezählten Gesamtbestand eintragen -->
				<!-- reset: false — der Standard-Reset von enhance würde das Zählfeld leeren -->
				<form
					method="POST"
					action="?/setStock"
					use:enhance={keepValues}
					class="flex shrink-0 items-center gap-1.5"
				>
					<input type="hidden" name="articleId" value={article.id} />
					<input
						type="number"
						name="newTotal"
						min="0"
						max="999"
						inputmode="numeric"
						value={countFor(article)}
						oninput={(e) => (counts[article.id] = e.currentTarget.value)}
						aria-label="Gezählter Bestand"
						class="w-16 rounded-lg border-gray-300 px-1 py-1 text-center text-sm focus:border-green-600 focus:ring-green-600"
					/>
					<button
						type="submit"
						disabled={!isChanged(article)}
						class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold
							{isChanged(article) ? 'bg-green-600 text-white hover:bg-green-700' : 'border border-gray-200 text-gray-300'}"
						aria-label="Zählwert speichern"
					>
						✓
					</button>
				</form>
			</li>
		{/each}
	</ul>
	<p class="mt-3 max-w-2xl text-xs text-gray-500">
		Mehrbestand wird ohne MHD in den Standard-Lagerort gebucht, Minderbestand nach nächstem MHD zuerst
		ausgebucht. Für gezielte Korrekturen einzelner Chargen den jeweiligen Lagerort öffnen.
	</p>
{/if}
