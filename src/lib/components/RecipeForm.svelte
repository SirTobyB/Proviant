<script lang="ts">
	import { enhance } from '$app/forms';

	type ArticleHit = {
		id: number;
		name: string;
		amount: number | null;
		unit: string | null;
		picnicId: string | null;
	};
	type IngredientRow = {
		articleId: number | null;
		articleName: string | null;
		freeText: string | null;
		amount: string;
		unit: string | null;
	};
	type RecipeValues = {
		name?: string | null;
		category?: 'meal' | 'cake';
		servings?: number | null;
		instructions?: string | null;
		imagePath?: string | null;
		tags?: string[];
		ingredients?: {
			articleId: number | null;
			articleName: string | null;
			freeText: string | null;
			amount: number | null;
			unit: string | null;
		}[];
	};

	let {
		recipe = {},
		allTags = [],
		submitLabel,
		errorMessage = null,
		action = ''
	}: {
		recipe?: RecipeValues;
		allTags?: string[];
		submitLabel: string;
		errorMessage?: string | null;
		action?: string;
	} = $props();

	const units = ['g', 'kg', 'ml', 'l', 'Stück'];

	// svelte-ignore state_referenced_locally
	const initial = { ...recipe };

	let name = $state(initial.name ?? '');
	let category = $state<'meal' | 'cake'>(initial.category ?? 'meal');
	let servings = $state(initial.servings ?? 4);
	let instructions = $state(initial.instructions ?? '');
	let uploadPreview = $state('');

	// Tags
	let recipeTagList = $state<string[]>([...(initial.tags ?? [])]);
	let tagInput = $state('');
	const tagSuggestions = $derived(
		allTags.filter(
			(t) =>
				!recipeTagList.includes(t) &&
				tagInput.trim() !== '' &&
				t.toLowerCase().includes(tagInput.trim().toLowerCase())
		)
	);
	const tagsJson = $derived(JSON.stringify(recipeTagList));

	function addTag(tag: string) {
		const clean = tag.trim();
		if (clean && !recipeTagList.includes(clean)) recipeTagList.push(clean);
		tagInput = '';
	}
	function removeTag(tag: string) {
		recipeTagList = recipeTagList.filter((t) => t !== tag);
	}
	function onTagKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			if (tagInput.trim()) addTag(tagInput);
		} else if (event.key === 'Backspace' && tagInput === '' && recipeTagList.length > 0) {
			recipeTagList.pop();
		}
	}

	let rows = $state<IngredientRow[]>(
		(initial.ingredients ?? []).map((i) => ({
			articleId: i.articleId,
			articleName: i.articleName,
			freeText: i.freeText,
			amount: i.amount != null ? String(i.amount) : '',
			unit: i.unit
		}))
	);
	if (rows.length === 0) rows.push({ articleId: null, articleName: null, freeText: null, amount: '', unit: null });

	// Artikel-Suche je Zeile
	let searchIndex = $state<number | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<ArticleHit[]>([]);

	const previewSrc = $derived(uploadPreview || (initial.imagePath ? `/api/images/${initial.imagePath}` : ''));

	const ingredientsJson = $derived(
		JSON.stringify(
			rows.map((r) => ({
				articleId: r.articleId,
				freeText: r.articleId ? null : r.freeText,
				amount: r.amount,
				unit: r.unit
			}))
		)
	);

	function addRow() {
		rows.push({ articleId: null, articleName: null, freeText: null, amount: '', unit: null });
	}
	function removeRow(index: number) {
		rows.splice(index, 1);
		if (rows.length === 0) addRow();
	}

	async function openSearch(index: number) {
		searchIndex = index;
		searchQuery = rows[index].articleName ?? rows[index].freeText ?? '';
		searchResults = [];
		if (searchQuery) await runSearch();
	}

	async function runSearch() {
		if (!searchQuery.trim()) {
			searchResults = [];
			return;
		}
		const response = await fetch(`/api/articles/search?q=${encodeURIComponent(searchQuery)}`);
		const data = await response.json();
		searchResults = data.results;
	}

	function pickArticle(index: number, article: ArticleHit) {
		rows[index].articleId = article.id;
		rows[index].articleName = article.name;
		rows[index].freeText = null;
		if (!rows[index].unit && article.unit) rows[index].unit = article.unit;
		searchIndex = null;
		searchResults = [];
	}

	function useFreeText(index: number) {
		rows[index].articleId = null;
		rows[index].articleName = null;
		rows[index].freeText = searchQuery.trim() || rows[index].freeText;
		searchIndex = null;
		searchResults = [];
	}

	function clearLink(index: number) {
		rows[index].articleId = null;
		rows[index].articleName = null;
	}

	function onFileSelected(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		uploadPreview = file ? URL.createObjectURL(file) : '';
	}
</script>

<form
	method="POST"
	{action}
	enctype="multipart/form-data"
	class="mt-6 flex max-w-2xl flex-col gap-4"
	use:enhance
>
	{#if errorMessage}
		<div class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
	{/if}

	<div>
		<label for="name" class="block text-sm font-medium text-gray-700">Name *</label>
		<input id="name" name="name" type="text" required bind:value={name} class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
	</div>

	<div class="grid grid-cols-2 gap-3">
		<div>
			<label for="category" class="block text-sm font-medium text-gray-700">Kategorie</label>
			<select id="category" name="category" bind:value={category} class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600">
				<option value="meal">Warme Mahlzeit</option>
				<option value="cake">Kuchen</option>
			</select>
		</div>
		<div>
			<label for="servings" class="block text-sm font-medium text-gray-700">Portionen</label>
			<input id="servings" name="servings" type="number" min="1" bind:value={servings} class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
		</div>
	</div>

	<!-- Zutaten -->
	<div>
		<span class="block text-sm font-medium text-gray-700">Zutaten</span>
		<div class="mt-2 space-y-2">
			{#each rows as row, index (index)}
				<div class="rounded-lg border border-gray-200 bg-white p-2">
					<div class="flex items-center gap-2">
						<div class="min-w-0 flex-1">
							{#if row.articleId}
								<span class="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-sm text-green-700">
									{row.articleName}
									<button type="button" onclick={() => clearLink(index)} class="text-green-500 hover:text-green-700" aria-label="Verknüpfung lösen">×</button>
								</span>
							{:else if searchIndex === index}
								<div class="flex gap-1">
									<input type="text" bind:value={searchQuery} oninput={runSearch} placeholder="Artikel suchen oder Freitext" class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
									<button type="button" onclick={() => useFreeText(index)} class="shrink-0 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">Als Freitext</button>
								</div>
								{#if searchResults.length > 0}
									<ul class="mt-1 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
										{#each searchResults as hit (hit.id)}
											<li>
												<button type="button" onclick={() => pickArticle(index, hit)} class="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm hover:bg-green-50">
													<span class="truncate">{hit.name}</span>
													{#if hit.amount}<span class="shrink-0 text-xs text-gray-400">{hit.amount} {hit.unit ?? ''}</span>{/if}
												</button>
											</li>
										{/each}
									</ul>
								{/if}
							{:else}
								<button type="button" onclick={() => openSearch(index)} class="w-full rounded-lg border border-dashed border-gray-300 px-2 py-1.5 text-left text-sm text-gray-500 hover:bg-gray-50">
									{row.freeText ?? 'Artikel wählen oder Freitext …'}
								</button>
							{/if}
						</div>
						<input type="text" inputmode="decimal" bind:value={row.amount} placeholder="Menge" class="w-20 shrink-0 rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
						<select bind:value={row.unit} class="w-24 shrink-0 rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600">
							<option value={null}>—</option>
							{#each units as u (u)}<option value={u}>{u}</option>{/each}
						</select>
						<button type="button" onclick={() => removeRow(index)} class="shrink-0 text-gray-400 hover:text-red-600" aria-label="Zutat entfernen">🗑</button>
					</div>
				</div>
			{/each}
		</div>
		<button type="button" onclick={addRow} class="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">+ Zutat</button>
	</div>

	<!-- Tags -->
	<div>
		<span class="block text-sm font-medium text-gray-700">Tags</span>
		{#if recipeTagList.length > 0}
			<div class="mt-1 flex flex-wrap gap-1.5">
				{#each recipeTagList as tag (tag)}
					<span class="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-sm text-green-700">
						{tag}
						<button type="button" onclick={() => removeTag(tag)} class="text-green-500 hover:text-green-700" aria-label="Tag entfernen">×</button>
					</span>
				{/each}
			</div>
		{/if}
		<div class="relative mt-1">
			<input
				type="text"
				bind:value={tagInput}
				onkeydown={onTagKeydown}
				placeholder="Tag eingeben (z.B. vegetarisch, schnell) und Enter"
				class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
			/>
			{#if tagSuggestions.length > 0}
				<ul class="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
					{#each tagSuggestions as suggestion (suggestion)}
						<li>
							<button type="button" onclick={() => addTag(suggestion)} class="block w-full px-3 py-1.5 text-left text-sm hover:bg-green-50">{suggestion}</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
		{#if allTags.length > 0}
			<div class="mt-1.5 flex flex-wrap gap-1">
				{#each allTags.filter((t) => !recipeTagList.includes(t)).slice(0, 8) as tag (tag)}
					<button type="button" onclick={() => addTag(tag)} class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200">+ {tag}</button>
				{/each}
			</div>
		{/if}
	</div>

	<div>
		<label for="instructions" class="block text-sm font-medium text-gray-700">Zubereitung</label>
		<textarea id="instructions" name="instructions" rows="6" bind:value={instructions} class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"></textarea>
	</div>

	<div>
		<span class="block text-sm font-medium text-gray-700">Bild</span>
		<div class="mt-1 flex items-center gap-4">
			{#if previewSrc}
				<img src={previewSrc} alt="Vorschau" class="h-20 w-20 rounded-lg border border-gray-200 object-cover" />
			{:else}
				<div class="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">Kein Bild</div>
			{/if}
			<label class="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
				Bild wählen
				<input type="file" name="image" accept="image/*" class="hidden" onchange={onFileSelected} />
			</label>
		</div>
	</div>

	<input type="hidden" name="ingredients" value={ingredientsJson} />
	<input type="hidden" name="tags" value={tagsJson} />

	<div class="flex gap-3">
		<button type="submit" class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">{submitLabel}</button>
		<a href="/rezepte" class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Abbrechen</a>
	</div>
</form>
