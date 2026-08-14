<script lang="ts">
	import { translator } from '$lib/i18n';
	let { data, form } = $props();

	// locale kommt aus dem Root-Layout — die Anmeldeseite rendert ohne App-Chrome,
	// braucht die Sprache aber genauso
	const t = $derived(translator(data.locale));
</script>

<svelte:head><title>{t('login.title')} – LebensmittelKumpel</title></svelte:head>

<div class="flex min-h-dvh items-center justify-center bg-gray-50 p-4">
	<div class="w-full max-w-sm">
		<div class="mb-6 flex flex-col items-center gap-2">
			<img src="/icon.svg" alt="" class="h-12 w-12" />
			<h1 class="text-xl font-bold">LebensmittelKumpel</h1>
		</div>

		<form method="POST" class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			{#if form?.message}
				<div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.message}</div>
			{/if}

			<label for="username" class="block text-sm font-medium text-gray-700">{t('login.username')}</label>
			<input
				id="username"
				name="username"
				type="text"
				autocomplete="username"
				value={form?.username ?? ''}
				required
				class="mt-1 mb-4 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
			/>

			<label for="password" class="block text-sm font-medium text-gray-700">{t('login.password')}</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
				class="mt-1 mb-5 block w-full rounded-lg border-gray-300 text-sm focus:border-green-600 focus:ring-green-600"
			/>

			<button type="submit" class="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
				{t('login.submit')}
			</button>
		</form>
	</div>
</div>
