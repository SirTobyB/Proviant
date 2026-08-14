<script lang="ts">
	import { enhance } from '$app/forms';
	import TagInput from '$lib/components/TagInput.svelte';
	import { page } from '$app/state';
	import { translator } from '$lib/i18n';
	import { UNITS, unitLabel } from '$lib/format';

	type ArticleHit = {
		id: number;
		name: string;
		amount: number | null;
		unit: string | null;
		picnicId: string | null;
	};
	type ArticleRef = { id: number; name: string };
	type IngredientRow = {
		/** Akzeptierte Artikel (Hauptartikel + Alternativen). */
		articles: ArticleRef[];
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
			articles: ArticleRef[];
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

	// Sprache aus den Layout-Daten; page ist kontextgebunden und beim SSR pro Anfrage korrekt
	const t = $derived(translator(page.data.locale));

	// svelte-ignore state_referenced_locally
	const initial = { ...recipe };

	let name = $state(initial.name ?? '');
	let category = $state<'meal' | 'cake'>(initial.category ?? 'meal');
	let servings = $state(initial.servings ?? 4);
	let instructions = $state(initial.instructions ?? '');
	let uploadPreview = $state('');

	// Tags (Eingabe-UI in TagInput.svelte)
	let recipeTagList = $state<string[]>([...(initial.tags ?? [])]);

	let rows = $state<IngredientRow[]>(
		(initial.ingredients ?? []).map((i) => ({
			articles: [...i.articles],
			freeText: i.freeText,
			amount: i.amount != null ? String(i.amount) : '',
			unit: i.unit
		}))
	);
	if (rows.length === 0) rows.push({ articles: [], freeText: null, amount: '', unit: null });

	// Artikel-Suche je Zeile
	let searchIndex = $state<number | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<ArticleHit[]>([]);

	const previewSrc = $derived(uploadPreview || (initial.imagePath ? `/api/images/${initial.imagePath}` : ''));

	const ingredientsJson = $derived(
		JSON.stringify(
			rows.map((r) => ({
				articleIds: r.articles.map((a) => a.id),
				freeText: r.articles.length > 0 ? null : r.freeText,
				amount: r.amount,
				unit: r.unit
			}))
		)
	);

	function addRow() {
		rows.push({ articles: [], freeText: null, amount: '', unit: null });
	}
	function removeRow(index: number) {
		rows.splice(index, 1);
		if (rows.length === 0) addRow();
	}

	async function openSearch(index: number) {
		searchIndex = index;
		searchQuery = rows[index].freeText ?? '';
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
		if (!rows[index].articles.some((a) => a.id === article.id)) {
			rows[index].articles.push({ id: article.id, name: article.name });
		}
		rows[index].freeText = null;
		if (!rows[index].unit && article.unit) rows[index].unit = article.unit;
		searchIndex = null;
		searchQuery = '';
		searchResults = [];
	}

	function useFreeText(index: number) {
		rows[index].freeText = searchQuery.trim() || rows[index].freeText;
		searchIndex = null;
		searchResults = [];
	}

	function removeArticle(index: number, articleId: number) {
		rows[index].articles = rows[index].articles.filter((a) => a.id !== articleId);
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
		<label for="name" class="block text-sm font-medium text-gray-700">{t('form.name')}</label>
		<input id="name" name="name" type="text" required bind:value={name} class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
	</div>

	<div class="grid grid-cols-2 gap-3">
		<div>
			<label for="category" class="block text-sm font-medium text-gray-700">{t('recipeForm.category')}</label>
			<select id="category" name="category" bind:value={category} class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600">
				<option value="meal">{t('recipes.categoryMeal')}</option>
				<option value="cake">{t('recipes.categoryCake')}</option>
			</select>
		</div>
		<div>
			<label for="servings" class="block text-sm font-medium text-gray-700">{t('recipeForm.servings')}</label>
			<input id="servings" name="servings" type="number" min="1" bind:value={servings} class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
		</div>
	</div>

	<!-- Zutaten -->
	<div>
		<span class="block text-sm font-medium text-gray-700">{t('recipeForm.ingredients')}</span>
		<div class="mt-2 space-y-2">
			{#each rows as row, index (index)}
				<div class="rounded-lg border border-gray-200 bg-white p-2">
					<div class="flex items-start gap-2">
						<div class="min-w-0 flex-1">
							{#if row.articles.length > 0}
								<div class="flex flex-wrap gap-1">
									{#each row.articles as art (art.id)}
										<span class="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-sm text-green-700">
											{art.name}
											<button type="button" onclick={() => removeArticle(index, art.id)} class="text-green-500 hover:text-green-700" aria-label={t('recipeForm.removeArticle')}>×</button>
										</span>
									{/each}
								</div>
								{#if searchIndex === index}
									<div class="mt-1 flex gap-1">
										<input type="text" bind:value={searchQuery} oninput={runSearch} placeholder={t('recipeForm.searchAlternative')} class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
										<button type="button" onclick={() => (searchIndex = null)} class="shrink-0 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">{t('form.cancel')}</button>
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
									<button type="button" onclick={() => openSearch(index)} class="mt-1 text-xs font-medium text-green-700 hover:text-green-800">{t('recipeForm.addAlternative')}</button>
								{/if}
							{:else if searchIndex === index}
								<div class="flex gap-1">
									<input type="text" bind:value={searchQuery} oninput={runSearch} placeholder={t('recipeForm.searchOrFreeText')} class="block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
									<button type="button" onclick={() => useFreeText(index)} class="shrink-0 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">{t('recipeForm.useFreeText')}</button>
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
									{row.freeText ?? t('recipeForm.pickOrFreeText')}
								</button>
							{/if}
						</div>
						<input type="text" inputmode="decimal" bind:value={row.amount} placeholder={t('recipeForm.amount')} class="w-20 shrink-0 rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600" />
						<select bind:value={row.unit} class="w-24 shrink-0 rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600">
							<option value={null}>—</option>
							{#each UNITS as u (u)}<option value={u}>{unitLabel(u, t)}</option>{/each}
						</select>
						<button type="button" onclick={() => removeRow(index)} class="shrink-0 text-gray-400 hover:text-red-600" aria-label={t('recipeForm.removeIngredient')}>🗑</button>
					</div>
				</div>
			{/each}
		</div>
		<button type="button" onclick={addRow} class="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">{t('recipeForm.addIngredient')}</button>
	</div>

	<!-- Tags -->
	<div>
		<span class="block text-sm font-medium text-gray-700">{t('form.tags')}</span>
		<TagInput bind:tags={recipeTagList} {allTags} placeholder={t('recipeForm.tagsPlaceholder')} />
	</div>

	<div>
		<label for="instructions" class="block text-sm font-medium text-gray-700">{t('recipeForm.instructions')}</label>
		<textarea id="instructions" name="instructions" rows="6" bind:value={instructions} class="mt-1 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"></textarea>
	</div>

	<div>
		<span class="block text-sm font-medium text-gray-700">{t('form.image')}</span>
		<div class="mt-1 flex items-center gap-4">
			{#if previewSrc}
				<img src={previewSrc} alt={t('form.imagePreview')} class="h-20 w-20 rounded-lg border border-gray-200 object-cover" />
			{:else}
				<div class="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">{t('form.imageNone')}</div>
			{/if}
			<label class="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
				{t('recipeForm.chooseImage')}
				<input type="file" name="image" accept="image/*" class="hidden" onchange={onFileSelected} />
			</label>
		</div>
	</div>

	<input type="hidden" name="ingredients" value={ingredientsJson} />

	<div class="flex gap-3">
		<button type="submit" class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">{submitLabel}</button>
		<a href="/rezepte" class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{t('form.cancel')}</a>
	</div>
</form>
