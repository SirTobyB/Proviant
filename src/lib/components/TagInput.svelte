<script lang="ts">
	/**
	 * Wiederverwendbare Tag-Eingabe: Chips + Autocomplete + Quick-Add-Buttons.
	 * Rendert das versteckte `name="tags"`-Feld (JSON-Array) selbst — die
	 * umgebende Form muss es nur serverseitig parsen (parseTags-Muster).
	 */
	import { page } from '$app/state';
	import { translator } from '$lib/i18n';

	const t = $derived(translator(page.data.locale));

	let {
		tags = $bindable(),
		allTags = [],
		placeholder = undefined
	}: {
		tags: string[];
		allTags?: string[];
		placeholder?: string;
	} = $props();

	let tagInput = $state('');
	const tagSuggestions = $derived(
		allTags.filter(
			(t) =>
				!tags.includes(t) &&
				tagInput.trim() !== '' &&
				t.toLowerCase().includes(tagInput.trim().toLowerCase())
		)
	);
	const tagsJson = $derived(JSON.stringify(tags));

	function addTag(tag: string) {
		const clean = tag.trim();
		if (clean && !tags.includes(clean)) tags.push(clean);
		tagInput = '';
	}
	function removeTag(tag: string) {
		tags = tags.filter((t) => t !== tag);
	}
	function onTagKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			if (tagInput.trim()) addTag(tagInput);
		} else if (event.key === 'Backspace' && tagInput === '' && tags.length > 0) {
			tags.pop();
		}
	}
</script>

{#if tags.length > 0}
	<div class="mt-1 flex flex-wrap gap-1.5">
		{#each tags as tag (tag)}
			<span class="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-sm text-green-700">
				{tag}
				<button type="button" onclick={() => removeTag(tag)} class="text-green-500 hover:text-green-700" aria-label={t('tags.remove')}>×</button>
			</span>
		{/each}
	</div>
{/if}
<div class="relative mt-1">
	<input
		type="text"
		bind:value={tagInput}
		onkeydown={onTagKeydown}
		placeholder={placeholder ?? t('tags.placeholder')}
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
		{#each allTags.filter((t) => !tags.includes(t)).slice(0, 8) as tag (tag)}
			<button type="button" onclick={() => addTag(tag)} class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200">+ {tag}</button>
		{/each}
	</div>
{/if}
<input type="hidden" name="tags" value={tagsJson} />
