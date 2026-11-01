<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatPrice } from '#lib/format.js';
	import { BCP47, translator, type Locale } from '#lib/i18n/index.js';
	import { tierHint } from '#lib/priceTiers.js';
	import type { PriceTier } from '#lib/offers.js';

	/**
	 * Der Picnic-Warenkorb auf der Bestellseite: ansehen, Mengen ändern,
	 * entfernen, nicht Lieferbares tauschen. Bestellt wird weiterhin nur in der
	 * Picnic-App; auch das Lieferfenster wird hier nur angezeigt.
	 */
	type Line = {
		productId: string;
		name: string;
		unitQuantity: string;
		imageId: string | null;
		quantity: number;
		maxCount: number;
		linePrice: number;
		lineOriginalPrice: number | null;
		tiers: PriceTier[];
		labels: string[];
		isUnavailable: boolean;
		unavailableReason: string | null;
	};
	type Replacement = { id: string; name: string; unitQuantity: string; imageId: string | null; price: number };

	let {
		cart,
		replacements,
		articleIds,
		locale,
		message = null
	}: {
		cart: {
			lines: Line[];
			totalCount: number;
			totalPrice: number;
			minimumOrderValue: number | null;
			slot: { start: string; end: string; explicit: boolean } | null;
		};
		replacements: Record<string, Replacement[]>;
		articleIds: Record<string, number>;
		locale: Locale;
		message?: string | null;
	} = $props();

	const t = $derived(translator(locale));
	const missing = $derived(
		cart.minimumOrderValue != null ? Math.max(0, cart.minimumOrderValue - cart.totalPrice) : 0
	);
	// Während einer Änderung alle Knöpfe sperren: Picnic verarbeitet den Korb
	// nacheinander, ein Doppelklick liefe sonst gegen einen veralteten Stand
	let busy = $state(false);

	function slotText(slot: { start: string; end: string }): string {
		const start = new Date(slot.start);
		const end = new Date(slot.end);
		const day = start.toLocaleDateString(BCP47[locale], { weekday: 'short', day: 'numeric', month: 'numeric' });
		const time = (d: Date) => d.toLocaleTimeString(BCP47[locale], { hour: '2-digit', minute: '2-digit' });
		return `${day}, ${time(start)}–${time(end)}`;
	}

	function hintFor(line: Line) {
		const unitRegular = Math.round((line.lineOriginalPrice ?? line.linePrice) / line.quantity);
		return tierHint(line.quantity, unitRegular, line.tiers);
	}

	const submit = () => {
		busy = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			busy = false;
		};
	};
</script>

<details class="mt-4 max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white" open={cart.lines.length > 0}>
	<summary class="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
		<span class="font-semibold">🛒 {t('order.cart.title')}</span>
		<span class="text-sm text-gray-600">
			{t('order.cart.summary', { n: cart.totalCount, total: formatPrice(cart.totalPrice, locale) })}
		</span>
	</summary>

	<div class="border-t border-gray-100 px-4 py-2 text-sm">
		{#if cart.slot}
			<div class="text-gray-600">
				{t('order.cart.slot', { slot: slotText(cart.slot) })}
				{#if !cart.slot.explicit}<span class="text-gray-400">· {t('order.cart.slotPreselected')}</span>{/if}
				<span class="text-xs text-gray-400">· {t('order.cart.slotInApp')}</span>
			</div>
		{:else}
			<div class="text-gray-500">{t('order.cart.noSlot')}</div>
		{/if}
		{#if cart.minimumOrderValue != null && cart.lines.length > 0}
			{#if missing > 0}
				<div class="mt-1 rounded bg-amber-50 px-2 py-1 text-amber-800">
					{t('order.cart.belowMinimum', { missing: formatPrice(missing, locale), minimum: formatPrice(cart.minimumOrderValue, locale) })}
				</div>
			{:else}
				<div class="mt-1 text-green-700">{t('order.cart.minimumReached', { minimum: formatPrice(cart.minimumOrderValue, locale) })}</div>
			{/if}
		{/if}
		{#if message}
			<div class="mt-2 rounded bg-red-50 px-2 py-1 text-red-700">{message}</div>
		{/if}
	</div>

	{#if cart.lines.length === 0}
		<p class="border-t border-gray-100 px-4 py-4 text-center text-sm text-gray-500">{t('order.cart.empty')}</p>
	{:else}
		<ul class="divide-y divide-gray-100 border-t border-gray-100">
			{#each cart.lines as line (line.productId)}
				{@const articleId = articleIds[line.productId]}
				{@const hint = line.isUnavailable ? null : hintFor(line)}
				<li class="px-4 py-2.5 {line.isUnavailable ? 'bg-red-50' : ''}">
					<div class="flex items-center gap-3">
						{#if line.imageId}
							<img src={`/api/picnic/image/${line.imageId}`} alt="" loading="lazy" class="h-10 w-10 shrink-0 rounded-lg border border-gray-100 bg-white object-contain" />
						{:else}
							<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">📦</div>
						{/if}
						<div class="min-w-0 flex-1">
							{#if articleId}
								<a href={`/artikel/${articleId}`} class="block truncate text-sm font-medium hover:underline">{line.name}</a>
							{:else}
								<span class="block truncate text-sm font-medium">{line.name}</span>
							{/if}
							<div class="text-xs text-gray-500">
								{line.unitQuantity}
								· {formatPrice(line.linePrice, locale)}
								{#if line.lineOriginalPrice}<span class="line-through">{formatPrice(line.lineOriginalPrice, locale)}</span>{/if}
								{#each line.labels as label (label)}<span class="ml-1 rounded bg-green-50 px-1 text-green-700">{label}</span>{/each}
							</div>
							{#if line.isUnavailable}
								<div class="text-xs font-medium text-red-700">⚠ {line.unavailableReason ?? t('order.cart.unavailable')}</div>
							{/if}
						</div>
						<div class="flex shrink-0 items-center gap-1">
							{#if !line.isUnavailable}
								<form method="POST" action="?/cartChange" use:enhance={submit}>
									<input type="hidden" name="productId" value={line.productId} />
									<input type="hidden" name="delta" value="-1" />
									<button type="submit" disabled={busy} aria-label={t('order.cart.less')} class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40">−</button>
								</form>
							{/if}
							<span class="w-6 text-center text-sm font-semibold">{line.quantity}</span>
							{#if !line.isUnavailable}
								<form method="POST" action="?/cartChange" use:enhance={submit}>
									<input type="hidden" name="productId" value={line.productId} />
									<input type="hidden" name="delta" value="1" />
									<button type="submit" disabled={busy || line.quantity >= line.maxCount} aria-label={t('order.cart.more')} class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40">+</button>
								</form>
							{/if}
							<form method="POST" action="?/cartRemove" use:enhance={submit}>
								<input type="hidden" name="productId" value={line.productId} />
								<button type="submit" disabled={busy} aria-label={t('order.cart.remove')} class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-40">🗑</button>
							</form>
						</div>
					</div>
					{#if hint}
						<form method="POST" action="?/cartChange" use:enhance={submit} class="mt-1 flex flex-wrap items-center gap-2 pl-13 text-xs text-green-800">
							<input type="hidden" name="productId" value={line.productId} />
							<input type="hidden" name="delta" value="1" />
							<span>{t('order.tierHint', { n: hint.fromQuantity, price: formatPrice(hint.unitPrice, locale), extra: formatPrice(hint.extraCost, locale) })}</span>
							<button type="submit" disabled={busy} class="rounded border border-green-600 px-2 py-0.5 font-medium text-green-700 hover:bg-green-50 disabled:opacity-40">+1</button>
						</form>
					{/if}
					{#if line.isUnavailable && replacements[line.productId]?.length}
						<ul class="mt-2 space-y-1 pl-13">
							{#each replacements[line.productId].slice(0, 3) as replacement (replacement.id)}
								<li class="flex items-center gap-2 text-xs">
									<span class="min-w-0 flex-1 truncate">{t('order.cart.replacement')}: {replacement.name} · {replacement.unitQuantity} · {formatPrice(replacement.price, locale)}</span>
									<form method="POST" action="?/cartSwap" use:enhance={submit}>
										<input type="hidden" name="productId" value={line.productId} />
										<input type="hidden" name="replacementId" value={replacement.id} />
										<button type="submit" disabled={busy} class="rounded border border-green-600 px-2 py-0.5 font-medium text-green-700 hover:bg-white disabled:opacity-40">{t('order.cart.swap')}</button>
									</form>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</details>
