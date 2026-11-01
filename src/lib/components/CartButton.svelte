<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Translate } from '#lib/i18n/index.js';

	/**
	 * „In den Picnic-Warenkorb“ für einen Artikel (eine Packung je Klick).
	 * Erwartet auf der Seite eine Action `?/addToCart` mit `articleId`.
	 * `inCart` = Menge im Warenkorb; `null`, wenn Picnic nicht erreichbar ist —
	 * dann bleibt der Knopf gesperrt, statt ins Leere zu klicken.
	 */
	let {
		articleId,
		inCart,
		t,
		compact = false
	}: { articleId: number; inCart: number | null; t: Translate; compact?: boolean } = $props();

	let busy = $state(false);
</script>

<form
	method="POST"
	action="?/addToCart"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	}}
	class="shrink-0"
>
	<input type="hidden" name="articleId" value={articleId} />
	{#if compact}
		<button
			type="submit"
			disabled={busy || inCart === null}
			aria-label={t('cart.add')}
			title={inCart ? t('cart.inCart', { n: inCart }) : t('cart.add')}
			class="relative flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-sm hover:bg-gray-50 disabled:opacity-30"
		>
			🛒
			{#if inCart}
				<span class="absolute -right-1 -top-1 rounded-full bg-green-600 px-1 text-[10px] font-semibold leading-4 text-white">{inCart}</span>
			{/if}
		</button>
	{:else}
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="submit"
				disabled={busy || inCart === null}
				class="rounded-lg border border-green-600 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-40"
			>
				🛒 +1
			</button>
			{#if inCart}<span class="text-sm text-gray-600">{t('cart.inCart', { n: inCart })}</span>{/if}
		</div>
	{/if}
</form>
